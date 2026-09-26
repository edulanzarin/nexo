"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { mutar } from "@/hooks/mutar";
import {
  chaveExterno,
  chavePessoa,
  type DadosPessoaExterna,
  type PessoaExterna,
  type PessoaTi,
} from "@/lib/ti-tipos";

/** As opções de quem recebe: o Diretório primeiro, depois quem é de fora e está ativo. */
export function opcoesRecebedor(pessoas: PessoaTi[] | undefined, externos: PessoaExterna[] | undefined): Opcao[] {
  return [
    ...(pessoas ?? []).map((p) => ({
      valor: chavePessoa(p.empresa, p.contrato),
      rotulo: p.nome,
      detalhe: p.setor ?? undefined,
    })),
    ...(externos ?? [])
      .filter((x) => x.ativo)
      .map((x) => ({
        valor: chaveExterno(x.id),
        rotulo: x.nome,
        detalhe: x.vinculo ? `De fora · ${x.vinculo}` : "De fora",
      })),
  ];
}

/** O nome de quem a chave aponta, nos dois cadastros. */
export function nomeRecebedor(
  chave: string | null,
  pessoas: PessoaTi[] | undefined,
  externos: PessoaExterna[] | undefined
): string {
  if (!chave) return "";
  return (
    pessoas?.find((p) => chavePessoa(p.empresa, p.contrato) === chave)?.nome ??
    externos?.find((x) => chaveExterno(x.id) === chave)?.nome ??
    ""
  );
}

/**
 * Quem recebe o equipamento: uma busca só no Diretório do RH e em quem é de
 * fora dele. O terceirizado que não está em lugar nenhum se cadastra aqui
 * mesmo, sem sair da entrega: a janela não fecha, e ele já sai escolhido.
 *
 * Os campos do cadastro rápido vivem dentro do formulário da entrega; o Enter
 * neles cadastra a pessoa em vez de enviar a entrega pela metade.
 */
export function CampoRecebedor({
  pessoas,
  externos,
  valor,
  onMudar,
  onCadastrado,
  rotuloAcessivel = "Quem recebe",
  novoAberto = false,
}: {
  pessoas: PessoaTi[] | undefined;
  externos: PessoaExterna[] | undefined;
  valor: string | null;
  onMudar: (chave: string) => void;
  /** Cadastrou alguém de fora: a tela recarrega a lista. */
  onCadastrado?: (x: PessoaExterna) => void;
  rotuloAcessivel?: string;
  /** O catálogo mostra o cadastro rápido aberto. */
  novoAberto?: boolean;
}) {
  const id = useId();
  const [novo, setNovo] = useState(novoAberto);
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("");
  const [contato, setContato] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const opcoes = useMemo(() => opcoesRecebedor(pessoas, externos), [pessoas, externos]);

  async function cadastrar() {
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const x = await mutar<PessoaExterna>("/api/ti/externos", "POST", { nome, vinculo, contato });
      avisar.ok("Pessoa de fora cadastrada", x.nome);
      onCadastrado?.(x);
      onMudar(chaveExterno(x.id));
      setNovo(false);
      setNome("");
      setVinculo("");
      setContato("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const enter = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      cadastrar();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Combo
        opcoes={opcoes}
        valor={valor}
        onMudar={onMudar}
        placeholder={pessoas ? "Buscar no Diretório ou entre os de fora" : "Carregando o Diretório"}
        busca
        icone="usuario"
        rotuloAcessivel={rotuloAcessivel}
        desabilitado={!pessoas && !externos}
      />
      {!novo ? (
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="self-start text-pequeno font-[560] text-rota hover:underline"
        >
          Não está no Diretório? Cadastrar alguém de fora
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-controle border border-linha bg-poco p-3">
          <p className="text-pequeno font-[600] text-tinta-2">Alguém de fora do Diretório</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Rotulado rotulo="Nome" htmlFor={`${id}-nome`}>
              <Campo
                id={`${id}-nome`}
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setErro(null);
                }}
                onKeyDown={enter}
                maxLength={120}
                autoFocus={!novoAberto}
              />
            </Rotulado>
            <Rotulado rotulo="Empresa ou vínculo" htmlFor={`${id}-vinculo`}>
              <Campo
                id={`${id}-vinculo`}
                value={vinculo}
                onChange={(e) => setVinculo(e.target.value)}
                onKeyDown={enter}
                placeholder="Limpa Tudo Terceirizada, Estagiário"
                maxLength={120}
              />
            </Rotulado>
          </div>
          <Rotulado rotulo="Contato" htmlFor={`${id}-contato`}>
            <Campo
              id={`${id}-contato`}
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              onKeyDown={enter}
              placeholder="Telefone ou e-mail, opcional"
              maxLength={120}
            />
          </Rotulado>
          {erro && (
            <Nota tom="perigo" icone="erro">
              {erro}
            </Nota>
          )}
          <div className="flex justify-end gap-2">
            <Botao variante="fantasma" onClick={() => setNovo(false)}>
              Cancelar
            </Botao>
            <Botao icone="mais" carregando={salvando} onClick={cadastrar}>
              Cadastrar e escolher
            </Botao>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cadastro de alguém de fora ───────────────────────────────────────────────

interface PropsExterno {
  /** Sem cadastro, é uma pessoa nova. */
  externo?: PessoaExterna | null;
  onFechar: () => void;
  onSalvo?: () => void;
}

/**
 * O cadastro de quem é de fora do Diretório. Encerrar é o fim do vínculo (o
 * contrato da terceirizada acabou): a pessoa não recebe mais nada, e o que
 * estiver com ela passa a aparecer como a recolher. Apagar só vale para quem
 * nunca recebeu; depois, ela fica no histórico.
 */
export function ModalExterno({ aberto, ...props }: PropsExterno & { aberto: boolean }) {
  if (!aberto) return null;
  return <FormExterno {...props} />;
}

export function ExternoEstatico(props: PropsExterno) {
  return <FormExterno {...props} estatico />;
}

function FormExterno({ externo, onFechar, onSalvo, estatico }: PropsExterno & { estatico?: boolean }) {
  const id = useId();
  const [d, setD] = useState<DadosPessoaExterna>({
    nome: externo?.nome ?? "",
    vinculo: externo?.vinculo ?? "",
    documento: externo?.documento ?? "",
    contato: externo?.contato ?? "",
    observacao: externo?.observacao ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<"salvar" | "ativo" | "apagar" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const mudar = (p: Partial<DadosPessoaExterna>) => {
    setD((a) => ({ ...a, ...p }));
    setErro(null);
  };

  async function gravar(acao: "salvar" | "ativo" | "apagar") {
    if (acao !== "apagar" && !d.nome.trim()) return setErro("Informe o nome.");
    setSalvando(acao);
    try {
      if (acao === "apagar" && externo) {
        await mutar(`/api/ti/externos/${externo.id}`, "DELETE");
        avisar.ok("Cadastro apagado");
      } else if (externo) {
        const ativo = acao === "ativo" ? !externo.ativo : externo.ativo;
        await mutar(`/api/ti/externos/${externo.id}`, "PATCH", { ...d, ativo });
        avisar.ok(acao === "ativo" ? (ativo ? "Cadastro reativado" : "Cadastro encerrado") : "Cadastro salvo");
      } else {
        await mutar("/api/ti/externos", "POST", d);
        avisar.ok("Pessoa de fora cadastrada");
      }
      onSalvo?.();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
      setConfirmando(false);
    } finally {
      setSalvando(null);
    }
  }

  const campo = (chave: keyof DadosPessoaExterna, rotulo: string, extra: Record<string, unknown> = {}) => (
    <Rotulado rotulo={rotulo} htmlFor={`${id}-${chave}`}>
      <Campo
        id={`${id}-${chave}`}
        value={d[chave] ?? ""}
        onChange={(e) => mudar({ [chave]: e.target.value })}
        maxLength={120}
        {...extra}
      />
    </Rotulado>
  );

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        gravar("salvar");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nome", "Nome", { "data-autofoco": true })}
        {campo("vinculo", "Empresa ou vínculo", { placeholder: "Limpa Tudo Terceirizada, Estagiário" })}
        {campo("documento", "Documento", { placeholder: "CPF ou RG, opcional", maxLength: 30 })}
        {campo("contato", "Contato", { placeholder: "Telefone ou e-mail" })}
      </div>
      <Rotulado rotulo="Observação" htmlFor={`${id}-obs`}>
        <AreaTexto
          id={`${id}-obs`}
          value={d.observacao ?? ""}
          onChange={(e) => mudar({ observacao: e.target.value })}
          placeholder="Contrato até dezembro, trabalha no turno da noite"
          maxLength={1000}
        />
      </Rotulado>
      {externo && !externo.ativo && (
        <Nota tom="atencao" icone="alerta">
          Cadastro encerrado: esta pessoa não recebe equipamento até ser reativada.
        </Nota>
      )}
      {erro && (
        <Nota tom="perigo" icone="erro">
          {erro}
        </Nota>
      )}
    </form>
  );

  const rodape = (
    <>
      {externo && (
        <div className="mr-auto flex flex-wrap gap-2">
          <Botao
            variante="fantasma"
            icone={externo.ativo ? "bloqueado" : "reabrir"}
            carregando={salvando === "ativo"}
            onClick={() => gravar("ativo")}
          >
            {externo.ativo ? "Encerrar cadastro" : "Reativar"}
          </Botao>
          {confirmando ? (
            <Botao variante="perigo" icone="apagar" carregando={salvando === "apagar"} onClick={() => gravar("apagar")}>
              Confirmar exclusão
            </Botao>
          ) : (
            <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)}>
              Apagar
            </Botao>
          )}
        </div>
      )}
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="salvar" type="submit" form={id} carregando={salvando === "salvar"}>
        {externo ? "Salvar" : "Cadastrar"}
      </Botao>
    </>
  );

  const titulo = externo ? "Pessoa de fora" : "Nova pessoa de fora";
  const descricao = "Recebe equipamento sem estar no Diretório do RH";
  if (estatico)
    return (
      <PainelModal estatico titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {corpo}
      </PainelModal>
    );
  return (
    <Modal aberto titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar} fecharNoVeu={false}>
      {corpo}
    </Modal>
  );
}
