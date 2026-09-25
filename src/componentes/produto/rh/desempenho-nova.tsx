"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { num } from "@/lib/format";
import type { FormularioResumo } from "@/lib/formularios-tipos";
import { nomeEmpresaRh } from "@/lib/rh";
import type { FuncionarioDiretorio, GestorRh } from "@/lib/rh-tipos";
import { mutar } from "@/hooks/mutar";
import { useFormulariosRh, useRhFuncionarios, useRhGestores } from "@/hooks/use-rh";
import { SeletorEmpresaRh, empresasDoFiltroRh, type FiltroEmpresaRh } from "./empresa-rh";

/*
 * Nova avaliação de desempenho: o formulário, sobre quem e o texto do e-mail.
 * Cada pessoa vira uma avaliação, enviada a todos os gestores ativos do setor
 * dela. Quem está em setor sem gestor fica de fora no servidor, então a janela
 * mostra antes do envio quantas saem e quem fica, com a mesma regra.
 *
 * Os setores da escolha saem do próprio Diretório (quem trabalha hoje), e não do
 * cadastro de setores: setor sem ninguém ativo não daria avaliação nenhuma.
 */

type Modo = "pessoas" | "setor" | "escritorio";

/** O corpo do POST de `/api/rh/desempenho`, nos dois caminhos que a rota aceita. */
export type EnvioNovaAvaliacao = {
  formularioId: number;
  titulo: string | null;
  mensagem: string | null;
} & (
  | {
      colaboradores: { codigoempresa: number; codigofunccontr: number; nome: string; classiforgan: string | null }[];
    }
  | { escritorio: true; empresa?: number; setor?: string }
);

/** O que a rota devolve ao criar a rodada. */
export interface ResultadoNovaAvaliacao {
  rodadaId: number;
  avaliacoes: number;
  /** E-mails que saíram de fato. Sem SMTP o servidor só registra no log e conta zero. */
  enviados: number;
  semGestor: string[];
}

export interface DadosNovaAvaliacao {
  formularios: FormularioResumo[] | undefined;
  funcionarios: FuncionarioDiretorio[] | undefined;
  gestores: GestorRh[] | undefined;
  /** O primeiro erro de carga, com a mensagem do servidor. */
  erro: string | null;
  onTentar?: () => void;
}

/** Estado inicial da janela; o catálogo usa para mostrar uma escolha já feita. */
export interface RascunhoNovaAvaliacao {
  formulario: string | null;
  modo: Modo;
  selecionados: string[];
  setor: string | null;
  empresa: FiltroEmpresaRh;
  titulo: string;
  mensagem: string;
}

const RASCUNHO_VAZIO: RascunhoNovaAvaliacao = {
  formulario: null,
  modo: "pessoas",
  selecionados: [],
  setor: null,
  empresa: "todas",
  titulo: "",
  mensagem: "",
};

const TITULO = "Nova Avaliação de Desempenho";
const DESCRICAO = "Os gestores do setor de cada pessoa recebem o link por e-mail.";

const chaveDe = (f: Pick<FuncionarioDiretorio, "codigoempresa" | "contrato">) => `${f.codigoempresa}:${f.contrato}`;
const avaliacoes = (n: number) => `${num(n)} ${n === 1 ? "avaliação" : "avaliações"}`;

/** Até quatro nomes e o resto em número: a lista de quem fica de fora cabe numa linha. */
function nomesCurtos(nomes: string[]): string {
  if (nomes.length <= 4) return nomes.join(", ");
  return `${nomes.slice(0, 4).join(", ")} e mais ${num(nomes.length - 4)}`;
}

export function ModalNovaAvaliacao({
  aberto,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (r: ResultadoNovaAvaliacao) => void;
}) {
  // Monta a cada abertura: a janela começa limpa e os cadastros chegam frescos.
  if (!aberto) return null;
  return <JanelaNova onFechar={onFechar} onCriada={onCriada} />;
}

function JanelaNova({ onFechar, onCriada }: { onFechar: () => void; onCriada: (r: ResultadoNovaAvaliacao) => void }) {
  const formularios = useFormulariosRh();
  const funcionarios = useRhFuncionarios();
  const gestores = useRhGestores();
  const consultas = [formularios, funcionarios, gestores];
  const falha = consultas.find((c) => c.error);

  const enviar = async (corpo: EnvioNovaAvaliacao) => {
    try {
      const r = await mutar<ResultadoNovaAvaliacao>("/api/rh/desempenho", "POST", corpo);
      onCriada(r);
      return true;
    } catch (e) {
      avisar.erro("Não deu para enviar a avaliação", (e as Error).message);
      return false;
    }
  };

  return (
    <FormNovaAvaliacao
      dados={{
        formularios: formularios.data,
        funcionarios: funcionarios.data,
        gestores: gestores.data,
        erro: falha ? (falha.error as Error).message : null,
        onTentar: () => consultas.forEach((c) => c.error && c.refetch()),
      }}
      onEnviar={enviar}
      onFechar={onFechar}
    />
  );
}

/**
 * A janela, desenhada a partir do dado de quem chama. `estatico` troca o
 * modal pela mesma aparência parada, para o catálogo.
 */
export function FormNovaAvaliacao({
  dados,
  onEnviar,
  onFechar,
  estatico,
  inicial = RASCUNHO_VAZIO,
}: {
  dados: DadosNovaAvaliacao;
  onEnviar: (corpo: EnvioNovaAvaliacao) => Promise<boolean>;
  onFechar: () => void;
  estatico?: boolean;
  inicial?: RascunhoNovaAvaliacao;
}) {
  const [formulario, setFormulario] = useState(inicial.formulario);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const [selecionados, setSelecionados] = useState(() => new Set(inicial.selecionados));
  const [setor, setSetor] = useState(inicial.setor);
  const [empresa, setEmpresa] = useState<FiltroEmpresaRh>(inicial.empresa);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [mensagem, setMensagem] = useState(inicial.mensagem);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { formularios, funcionarios, gestores } = dados;
  const pronto = formularios != null && funcionarios != null && gestores != null;

  const ativos = useMemo(() => (formularios ?? []).filter((f) => f.status === "ativo"), [formularios]);
  const escolhido = ativos.find((f) => String(f.id) === formulario) ?? null;

  // A mesma régua do servidor (`contagemGestoresPorSetor`): setor com ao menos um gestor ativo.
  const comGestor = useMemo(
    () => new Set((gestores ?? []).filter((g) => g.ativo).map((g) => g.classiforgan)),
    [gestores]
  );
  const semGestor = (f: FuncionarioDiretorio) => !f.classiforgan || !comGestor.has(f.classiforgan);

  const pessoas = useMemo(
    () => [...(funcionarios ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [funcionarios]
  );

  const setores = useMemo(() => {
    const m = new Map<string, { nome: string; pessoas: number }>();
    for (const f of pessoas) {
      if (!f.classiforgan) continue;
      const s = m.get(f.classiforgan) ?? { nome: f.setor ?? f.classiforgan, pessoas: 0 };
      s.pessoas++;
      m.set(f.classiforgan, s);
    }
    return [...m.entries()]
      .map(([classiforgan, s]) => ({ classiforgan, ...s }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [pessoas]);

  const listadas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return pessoas;
    return pessoas.filter((f) => normalizar(`${f.nome} ${f.setor ?? ""} ${f.cargo ?? ""}`).includes(termo));
  }, [pessoas, busca]);
  const todasListadas = listadas.length > 0 && listadas.every((f) => selecionados.has(chaveDe(f)));

  // Quem vira avaliação no modo escolhido, já separado de quem fica sem destinatário.
  const alvo = useMemo(() => {
    const empresas = empresasDoFiltroRh(empresa);
    const escolhidos =
      modo === "pessoas"
        ? pessoas.filter((f) => selecionados.has(chaveDe(f)))
        : modo === "setor"
          ? setor
            ? pessoas.filter((f) => f.classiforgan === setor && empresas.includes(f.codigoempresa))
            : []
          : pessoas.filter((f) => empresas.includes(f.codigoempresa));
    const fora = escolhidos.filter((f) => !f.classiforgan || !comGestor.has(f.classiforgan));
    return { escolhidos, validos: escolhidos.length - fora.length, fora: fora.map((f) => f.nome) };
  }, [pessoas, modo, selecionados, setor, empresa, comGestor]);

  const alternar = (f: FuncionarioDiretorio) =>
    setSelecionados((s) => {
      const n = new Set(s);
      const k = chaveDe(f);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const marcarListadas = () =>
    setSelecionados((s) => {
      const n = new Set(s);
      for (const f of listadas) {
        if (todasListadas) n.delete(chaveDe(f));
        else n.add(chaveDe(f));
      }
      return n;
    });

  const podeEnviar = escolhido != null && alvo.validos > 0 && !enviando;

  async function enviar() {
    if (!escolhido) return;
    const base = {
      formularioId: escolhido.id,
      titulo: titulo.trim() || null,
      mensagem: mensagem.trim() || null,
    };
    const empresaCod = empresa === "todas" ? undefined : Number(empresa);
    const corpo: EnvioNovaAvaliacao =
      modo === "pessoas"
        ? {
            ...base,
            colaboradores: alvo.escolhidos.map((f) => ({
              codigoempresa: f.codigoempresa,
              codigofunccontr: f.contrato,
              nome: f.nome,
              classiforgan: f.classiforgan,
            })),
          }
        : // Setor e escritório vão pelo mesmo caminho da rota, que resolve o
          // Diretório no disparo; o setor é só um recorte a mais.
          { ...base, escritorio: true, empresa: empresaCod, setor: modo === "setor" ? (setor ?? undefined) : undefined };
    setEnviando(true);
    const ok = await onEnviar(corpo);
    setEnviando(false);
    if (ok) onFechar();
  }

  const opcoesFormulario: Opcao[] = ativos.map((f) => ({
    valor: String(f.id),
    rotulo: f.nome,
    detalhe: `${num(f.campos)} ${f.campos === 1 ? "pergunta" : "perguntas"}`,
    // A rota recusa formulário sem pergunta: nem deixa escolher.
    desabilitado: f.campos === 0,
  }));

  const opcoesSetor: Opcao[] = setores.map((s) => ({
    valor: s.classiforgan,
    rotulo: s.nome,
    detalhe: comGestor.has(s.classiforgan) ? `${num(s.pessoas)} ${s.pessoas === 1 ? "pessoa" : "pessoas"}` : "sem gestor",
  }));

  let corpo: ReactNode;
  if (dados.erro)
    corpo = <PainelErro titulo="Não deu para carregar os cadastros" mensagem={dados.erro} onTentar={dados.onTentar} />;
  else if (!pronto)
    corpo = (
      <div aria-busy className="flex flex-col gap-4">
        <Esqueleto className="h-controle w-full" />
        <Esqueleto className="h-controle w-72" />
        <Esqueleto className="h-48 w-full" />
      </div>
    );
  else if (ativos.length === 0)
    corpo = (
      <Vazio
        compacto
        icone="relatorio"
        titulo="Nenhum formulário ativo"
        descricao="Monte o formulário de desempenho e ative para enviar daqui."
        acao={
          <BotaoLink href="/rh/formularios" iconeFim="seta-direita">
            Ir para Formulários
          </BotaoLink>
        }
      />
    );
  else
    corpo = (
      <div className="flex flex-col gap-5">
        <Rotulado rotulo="Formulário">
          <Combo
            opcoes={opcoesFormulario}
            valor={formulario}
            onMudar={setFormulario}
            placeholder="Escolha um formulário ativo"
            rotuloAcessivel="Formulário da avaliação"
            larguraMin={300}
          />
        </Rotulado>

        <div className="flex flex-col gap-2">
          <Rotulado rotulo="Sobre quem">
            <div className="max-w-full overflow-x-auto">
              <Segmentado<Modo>
                rotulo="Sobre quem"
                valor={modo}
                onMudar={setModo}
                opcoes={[
                  { valor: "pessoas", rotulo: "Pessoas", icone: "usuario" },
                  { valor: "setor", rotulo: "Um setor", icone: "camadas" },
                  { valor: "escritorio", rotulo: "Escritório inteiro", icone: "empresa" },
                ]}
              />
            </div>
          </Rotulado>

          {modo === "pessoas" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Campo
                  icone="buscar"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, setor ou cargo"
                  aria-label="Buscar pessoa"
                  classeCaixa="min-w-0 flex-1 basis-56"
                />
                <Botao variante="fantasma" onClick={marcarListadas} disabled={listadas.length === 0}>
                  {todasListadas ? "Desmarcar as listadas" : "Marcar as listadas"}
                </Botao>
              </div>
              {listadas.length === 0 ? (
                <div className="rounded-controle border border-linha">
                  <Vazio
                    compacto
                    icone="buscar"
                    titulo={pessoas.length === 0 ? "Ninguém no Diretório" : "Ninguém com esse nome"}
                    descricao={pessoas.length === 0 ? "Não há colaborador ativo nas empresas do RH." : "Tente parte do nome, o setor ou o cargo."}
                  />
                </div>
              ) : (
                <ul className="max-h-64 overflow-y-auto rounded-controle border border-linha">
                  {listadas.map((f) => (
                    <li
                      key={chaveDe(f)}
                      className="flex items-center gap-2 border-b border-linha px-2.5 py-1.5 last:border-0 hover:bg-poco"
                    >
                      <Caixa
                        className="min-w-0 flex-1"
                        marcada={selecionados.has(chaveDe(f))}
                        onMudar={() => alternar(f)}
                        rotulo={f.nome}
                        detalhe={`${f.setor ?? "Sem setor"} · ${nomeEmpresaRh(f.codigoempresa)}`}
                      />
                      {semGestor(f) && (
                        <Selo tom="atencao" icone="alerta">
                          Sem gestor
                        </Selo>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="num text-pequeno text-apagado">
                {num(selecionados.size)} {selecionados.size === 1 ? "pessoa marcada" : "pessoas marcadas"}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              {modo === "setor" && (
                <Rotulado rotulo="Setor" className="min-w-0 flex-1 basis-56">
                  <Combo
                    opcoes={opcoesSetor}
                    valor={setor}
                    onMudar={setSetor}
                    placeholder="Escolha o setor"
                    rotuloAcessivel="Setor avaliado"
                    larguraMin={280}
                  />
                </Rotulado>
              )}
              <Rotulado rotulo="Empresa">
                <div className="max-w-full overflow-x-auto">
                  <SeletorEmpresaRh valor={empresa} onMudar={setEmpresa} />
                </div>
              </Rotulado>
            </div>
          )}
        </div>

        <Rotulado rotulo="Título" ajuda="Nomeia a rodada na lista e vai no assunto do e-mail.">
          <Campo
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={escolhido?.nome ?? "O nome do formulário"}
            aria-label="Título da rodada"
          />
        </Rotulado>
        <Rotulado rotulo="Mensagem" ajuda="Opcional. Vai no e-mail, acima do link.">
          <AreaTexto
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            placeholder="Texto para os gestores"
            aria-label="Mensagem do e-mail"
          />
        </Rotulado>

        <div className="flex flex-col gap-1.5 rounded-controle border border-linha bg-poco px-3 py-2.5">
          <p className="text-corpo text-tinta">
            {alvo.validos > 0 ? (
              <>
                <span className="num font-[620]">{avaliacoes(alvo.validos)}</span>{" "}
                {alvo.validos === 1 ? "sai" : "saem"} para os gestores
              </>
            ) : modo === "pessoas" && alvo.escolhidos.length === 0 ? (
              "Marque quem vai ser avaliado."
            ) : modo === "setor" && !setor ? (
              "Escolha o setor."
            ) : (
              "Nenhuma avaliação sai com essa escolha."
            )}
          </p>
          {alvo.fora.length > 0 && (
            <Nota tom="atencao" icone="alerta">
              {num(alvo.fora.length)} {alvo.fora.length === 1 ? "fica" : "ficam"} de fora por setor sem gestor:{" "}
              {nomesCurtos(alvo.fora)}.{" "}
              <Link href="/rh/gestores" className="not-italic underline">
                Cadastrar gestores
              </Link>
            </Nota>
          )}
        </div>
      </div>
    );

  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar} disabled={enviando}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="email" carregando={enviando} disabled={!podeEnviar} onClick={enviar}>
        {alvo.validos > 0 ? `Enviar ${avaliacoes(alvo.validos)}` : "Enviar"}
      </Botao>
    </>
  );

  if (estatico)
    return (
      <PainelModal estatico titulo={TITULO} descricao={DESCRICAO} onFechar={onFechar} rodape={rodape}>
        {corpo}
      </PainelModal>
    );
  return (
    <Modal
      aberto
      titulo={TITULO}
      descricao={DESCRICAO}
      onFechar={enviando ? () => {} : onFechar}
      rodape={rodape}
      largura="m"
      fecharNoVeu={false}
    >
      {corpo}
    </Modal>
  );
}
