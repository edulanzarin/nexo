"use client";

import { useId, useState, type ReactNode } from "react";
import { ZonaArquivo } from "@/componentes/primitivos/arquivo";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { decimal, num } from "@/lib/format";

/**
 * PDF com senha traz o dicionário de criptografia (`/Encrypt`) no próprio
 * arquivo. Ler isso no navegador evita mandar o PDF ao servidor só para ouvir
 * que falta a senha.
 */
export async function pdfProtegido(arquivo: File): Promise<boolean> {
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) return false;
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    return new TextDecoder("latin1").decode(bytes).includes("/Encrypt");
  } catch {
    return false;
  }
}

/** O servidor recusou pela senha (faltando ou errada)? Então a tela pede de novo. */
export function erroDeSenha(mensagem: string): boolean {
  return /senha|protegid|password|encrypt/i.test(mensagem);
}

function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${num(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${decimal(bytes / (1024 * 1024), 1)} MB`;
}

export interface SenhaArquivo {
  /** O arquivo é um PDF trancado (ou o servidor disse que falta a senha). */
  protegido: boolean;
  valor: string;
  onMudar: (senha: string) => void;
}

/**
 * A entrada das telas que executam pelo arquivo (extrato, balancete, relatório
 * de bens). Escolher o arquivo NÃO processa: só guarda. Quem lê é o botão, e o
 * botão diz se o que está na tela é deste arquivo. Escolher é escolher, ler é
 * ler: soltar o arquivo errado não pode custar uma leitura nem apagar a prévia
 * que já está conferida.
 *
 * Vazia, é a zona grande que ensina o que soltar. Com arquivo, vira uma linha
 * com o nome, o estado da leitura e o botão; é o resultado que ocupa a tela.
 */
export function EnvioArquivo({
  aceita,
  arquivo,
  lido,
  lendo,
  onArquivo,
  onLer,
  rotuloLer,
  bloqueio,
  titulo,
  descricao,
  icone = "enviar-arquivo",
  senha,
  className,
}: {
  /** Extensões aceitas: ".ofx,.qfx,.pdf". */
  aceita: string;
  arquivo: File | null;
  /** O resultado na tela é deste arquivo e das escolhas atuais. */
  lido: boolean;
  lendo?: boolean;
  onArquivo: (arquivo: File, protegido: boolean) => void;
  onLer: () => void;
  /** Verbo do botão antes da primeira leitura: "Ler extrato". */
  rotuloLer: string;
  /** Por que ainda não dá para ler (falta a conta do banco, por exemplo). */
  bloqueio?: string | null;
  /** Título da zona vazia. */
  titulo: string;
  descricao?: ReactNode;
  icone?: NomeIcone;
  /** Presente quando o arquivo pode vir trancado (PDF de banco). */
  senha?: SenhaArquivo;
  className?: string;
}) {
  const [pedindo, setPedindo] = useState(false);
  // Quando o arquivo passa a ser protegido (escolhido agora ou recusado pelo
  // servidor), a janela da senha abre sozinha. Estado derivado no render, não
  // em efeito: a comparação com o valor anterior é o gatilho.
  const protegido = senha?.protegido ?? false;
  const [visto, setVisto] = useState(protegido);
  if (protegido !== visto) {
    setVisto(protegido);
    if (protegido && !senha?.valor) setPedindo(true);
  }

  const escolher = async (lista: File[]) => {
    const f = lista[0];
    if (!f) return;
    onArquivo(f, senha ? await pdfProtegido(f) : false);
  };

  if (!arquivo) {
    return (
      <ZonaArquivo
        aceita={aceita}
        onArquivos={escolher}
        titulo={titulo}
        descricao={descricao}
        icone={icone}
        className={className}
      />
    );
  }

  const estado = lendo ? (
    "Lendo o arquivo"
  ) : bloqueio ? (
    <span className="text-atencao">{bloqueio}</span>
  ) : lido ? (
    `${tamanho(arquivo.size)} · lido`
  ) : (
    `${tamanho(arquivo.size)} · ainda não lido`
  );

  return (
    <>
      <ZonaArquivo
        compacta
        aceita={aceita}
        onArquivos={escolher}
        carregando={lendo}
        icone="nota"
        titulo={<span className="block truncate">{arquivo.name}</span>}
        descricao={estado}
        className={className}
        extra={
          <>
            {protegido && senha && (
              <Botao variante={senha.valor ? "fantasma" : "secundario"} icone="chave" onClick={() => setPedindo(true)}>
                {senha.valor ? "Senha informada" : "Informar senha"}
              </Botao>
            )}
            <Botao
              variante={lido ? "secundario" : "primario"}
              icone={lido ? "atualizar" : "executar"}
              carregando={lendo}
              disabled={!!bloqueio}
              title={bloqueio ?? undefined}
              onClick={onLer}
            >
              {lido ? "Ler de novo" : rotuloLer}
            </Botao>
          </>
        }
      />
      {pedindo && senha && (
        <JanelaSenha
          onFechar={() => setPedindo(false)}
          onConfirmar={(s) => {
            senha.onMudar(s);
            setPedindo(false);
          }}
        />
      )}
    </>
  );
}

/**
 * A senha do PDF. Janela e não campo fixo na linha: a maioria dos extratos não
 * tem senha, e um campo sempre à vista seria ruído para todos eles.
 * `estatico` é a mesma peça parada, para o catálogo.
 */
export function JanelaSenha({
  onConfirmar,
  onFechar,
  estatico,
}: {
  onConfirmar: (senha: string) => void;
  onFechar: () => void;
  estatico?: boolean;
}) {
  const [rascunho, setRascunho] = useState("");
  const id = useId();
  const corpo = (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        if (rascunho) onConfirmar(rascunho);
      }}
    >
      <Rotulado rotulo="Senha do PDF" htmlFor={`${id}-senha`}>
        <Campo
          id={`${id}-senha`}
          type="password"
          autoComplete="off"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
        />
      </Rotulado>
    </form>
  );
  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" type="submit" form={id} disabled={!rascunho}>
        Confirmar
      </Botao>
    </>
  );
  const texto = { titulo: "PDF Protegido", descricao: "O arquivo só abre com a senha que o banco definiu." };
  if (estatico) {
    return (
      <PainelModal estatico largura="p" {...texto} rodape={rodape} onFechar={onFechar}>
        {corpo}
      </PainelModal>
    );
  }
  return (
    <Modal aberto largura="p" {...texto} rodape={rodape} onFechar={onFechar} fecharNoVeu={false}>
      {corpo}
    </Modal>
  );
}
