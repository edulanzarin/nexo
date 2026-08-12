/**
 * Relatório Post Mortem do DP — parte PURA (sem servidor). DTOs, rótulos e
 * validação compartilhados entre o formulário (client) e a submissão (server).
 * Não importa `pg` nem `server-only` para poder entrar no bundle do cliente.
 */

export const CRITICIDADES = ["baixa", "media", "alta", "critica"] as const;
export type Criticidade = (typeof CRITICIDADES)[number];

export const CRITICIDADE_ROTULO: Record<Criticidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

/** Definição de cada nível (do Word) — mostrada como ajuda ao escolher. */
export const CRITICIDADE_DEF: Record<Criticidade, string> = {
  baixa: "Sem impacto financeiro/legal",
  media: "Impacto financeiro limitado, corrigível",
  alta: "Impacto financeiro relevante ou risco trabalhista",
  critica: "Autuação, passivo trabalhista, dano irreversível ao cliente",
};

export type StatusPM = "rascunho" | "enviado";

export interface EventoLinha {
  data: string;
  evento: string;
  responsavel: string;
}

export interface Impactos {
  financeiro: string;
  trabalhista: string;
  cliente: string;
  funcionarios: string;
  reputacional: string;
  outros: string;
}

export interface Fatores {
  processo: string;
  pessoas: string;
  sistema: string;
  comunicacao: string;
  prazo: string;
}

export interface AcaoCorretiva {
  acao: string;
  responsavel: string;
  prazo: string;
  status: string;
}

export interface AcaoPreventiva {
  acao: string;
  responsavel: string;
  prazo: string;
  validacao: string;
  status: string;
}

/**
 * O corpo editável do relatório (o que o formulário manda no salvar/enviar).
 * Tudo é opcional de fato: rascunho salva parcial; só o ENVIO cobra os campos
 * essenciais (ver `validarEnvio`).
 */
export interface DadosPM {
  criticidade: Criticidade | null;
  grupoId: number | null;
  empresaAfetada: string;
  funcionariosAfetados: number | null;
  processo: string;
  dataOcorrido: string | null;
  dataIdentificado: string | null;
  quemIdentificou: string;
  comoIdentificou: string;
  descricao: string;
  linhaTempo: EventoLinha[];
  impactos: Impactos;
  cincoPorques: string[];
  fatores: Fatores;
  causaRaiz: string;
  acoesCorretivas: AcaoCorretiva[];
  acoesPreventivas: AcaoPreventiva[];
  licoes: string;
}

/** Relatório completo, como o servidor devolve. */
export interface RelatorioPM extends DadosPM {
  id: number;
  numero: number | null;
  status: StatusPM;
  autorId: string;
  autorNome: string;
  grupoNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Item de lista (sem o corpo pesado). */
export interface ResumoPM {
  id: number;
  numero: number | null;
  status: StatusPM;
  criticidade: Criticidade | null;
  empresaAfetada: string;
  grupoNome: string | null;
  autorNome: string;
  processo: string;
  dataOcorrido: string | null;
  atualizadoEm: string;
}

export interface GrupoOpcao {
  id: number;
  nome: string;
}

export function impactosVazio(): Impactos {
  return { financeiro: "", trabalhista: "", cliente: "", funcionarios: "", reputacional: "", outros: "" };
}

export function fatoresVazio(): Fatores {
  return { processo: "", pessoas: "", sistema: "", comunicacao: "", prazo: "" };
}

/** Corpo em branco — base de um relatório novo e do estado inicial do form. */
export function pmVazio(): DadosPM {
  return {
    criticidade: null,
    grupoId: null,
    empresaAfetada: "",
    funcionariosAfetados: null,
    processo: "",
    dataOcorrido: null,
    dataIdentificado: null,
    quemIdentificou: "",
    comoIdentificou: "",
    descricao: "",
    linhaTempo: [],
    impactos: impactosVazio(),
    cincoPorques: ["", "", "", "", ""],
    fatores: fatoresVazio(),
    causaRaiz: "",
    acoesCorretivas: [],
    acoesPreventivas: [],
    licoes: "",
  };
}

export function criticidadeValida(v: unknown): v is Criticidade {
  return typeof v === "string" && (CRITICIDADES as readonly string[]).includes(v);
}

/**
 * Cobra os campos essenciais para ENVIAR (indicador não pode nascer vazio).
 * Devolve as pendências (vazio = pode enviar). Rascunho não passa por aqui.
 */
// Lê um campo de um valor desconhecido sem estourar (corpo vindo do cliente).
function campo(o: unknown, k: string): unknown {
  return o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined;
}
function txt(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function numOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Sanea o corpo cru (JSON do cliente) em um `DadosPM` — o servidor nunca confia
 *  no formato de quem chama. Campo faltando ou de tipo errado vira o vazio. */
export function coerceDados(v: unknown): DadosPM {
  const dataOk = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    criticidade: criticidadeValida(campo(v, "criticidade")) ? (campo(v, "criticidade") as Criticidade) : null,
    grupoId: numOuNull(campo(v, "grupoId")),
    empresaAfetada: txt(campo(v, "empresaAfetada")),
    funcionariosAfetados: numOuNull(campo(v, "funcionariosAfetados")),
    processo: txt(campo(v, "processo")),
    dataOcorrido: dataOk(campo(v, "dataOcorrido")),
    dataIdentificado: dataOk(campo(v, "dataIdentificado")),
    quemIdentificou: txt(campo(v, "quemIdentificou")),
    comoIdentificou: txt(campo(v, "comoIdentificou")),
    descricao: txt(campo(v, "descricao")),
    linhaTempo: lista(campo(v, "linhaTempo")).map((e) => ({
      data: txt(campo(e, "data")),
      evento: txt(campo(e, "evento")),
      responsavel: txt(campo(e, "responsavel")),
    })),
    impactos: {
      financeiro: txt(campo(campo(v, "impactos"), "financeiro")),
      trabalhista: txt(campo(campo(v, "impactos"), "trabalhista")),
      cliente: txt(campo(campo(v, "impactos"), "cliente")),
      funcionarios: txt(campo(campo(v, "impactos"), "funcionarios")),
      reputacional: txt(campo(campo(v, "impactos"), "reputacional")),
      outros: txt(campo(campo(v, "impactos"), "outros")),
    },
    cincoPorques: (() => {
      const a = lista(campo(v, "cincoPorques")).map(txt);
      return Array.from({ length: 5 }, (_, i) => a[i] ?? "");
    })(),
    fatores: {
      processo: txt(campo(campo(v, "fatores"), "processo")),
      pessoas: txt(campo(campo(v, "fatores"), "pessoas")),
      sistema: txt(campo(campo(v, "fatores"), "sistema")),
      comunicacao: txt(campo(campo(v, "fatores"), "comunicacao")),
      prazo: txt(campo(campo(v, "fatores"), "prazo")),
    },
    causaRaiz: txt(campo(v, "causaRaiz")),
    acoesCorretivas: lista(campo(v, "acoesCorretivas")).map((a) => ({
      acao: txt(campo(a, "acao")),
      responsavel: txt(campo(a, "responsavel")),
      prazo: txt(campo(a, "prazo")),
      status: txt(campo(a, "status")),
    })),
    acoesPreventivas: lista(campo(v, "acoesPreventivas")).map((a) => ({
      acao: txt(campo(a, "acao")),
      responsavel: txt(campo(a, "responsavel")),
      prazo: txt(campo(a, "prazo")),
      validacao: txt(campo(a, "validacao")),
      status: txt(campo(a, "status")),
    })),
    licoes: txt(campo(v, "licoes")),
  };
}

export function validarEnvio(d: DadosPM): string[] {
  const faltando: string[] = [];
  if (!d.criticidade) faltando.push("Criticidade");
  if (!d.grupoId) faltando.push("Grupo");
  if (!d.empresaAfetada.trim()) faltando.push("Cliente / Empresa afetada");
  if (!d.processo.trim()) faltando.push("Processo / Rotina envolvida");
  if (!d.dataOcorrido) faltando.push("Data em que o erro ocorreu");
  if (!d.descricao.trim()) faltando.push("Descrição do erro");
  if (!d.causaRaiz.trim()) faltando.push("Causa raiz identificada");
  return faltando;
}
