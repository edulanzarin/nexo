/**
 * Relatório Post Mortem — parte PURA (sem servidor). DTOs, rótulos e validação
 * compartilhados entre o formulário (client) e a submissão (server). Não importa
 * `pg` nem `server-only` para poder entrar no bundle do cliente.
 *
 * O relatório é do ESCRITÓRIO: o `setor` diz quem o preencheu e quais campos a
 * tela mostra — ver [[postmortem-setores]], que é a fonte dessa variação.
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

/**
 * Nota de gravidade do Societário: 1 baixo, 5 gravíssimo. Só as duas pontas têm
 * nome porque só elas foram definidas por quem pediu — inventar rótulo para 2, 3
 * e 4 seria escrever régua que ninguém combinou.
 */
export const GRAVIDADES = [1, 2, 3, 4, 5] as const;

export function rotuloGravidade(n: number): string {
  if (n === 1) return "1 — Baixo";
  if (n === 5) return "5 — Gravíssimo";
  return String(n);
}

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
  /** Nota de gravidade 1–5 (setor que a usa; null nos demais). */
  gravidade: number | null;
  grupoId: number | null;
  empresaAfetada: string;
  funcionariosAfetados: number | null;
  /** Quem comunicou que o erro tinha acontecido. */
  responsavelInfo: string;
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
  /** Setor dono do relatório — decide os campos da tela e onde ele é listado. */
  setor: string;
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
  setor: string;
  criticidade: Criticidade | null;
  gravidade: number | null;
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
    gravidade: null,
    grupoId: null,
    empresaAfetada: "",
    funcionariosAfetados: null,
    responsavelInfo: "",
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
/** Fora de 1–5 não é nota: vira "não informado" (a coluna tem o mesmo check). */
export function gravidadeValida(n: number | null): number | null {
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Sanea o corpo cru (JSON do cliente) em um `DadosPM` — o servidor nunca confia
 *  no formato de quem chama. Campo faltando ou de tipo errado vira o vazio. */
export function coerceDados(v: unknown): DadosPM {
  const dataOk = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    criticidade: criticidadeValida(campo(v, "criticidade")) ? (campo(v, "criticidade") as Criticidade) : null,
    gravidade: gravidadeValida(numOuNull(campo(v, "gravidade"))),
    grupoId: numOuNull(campo(v, "grupoId")),
    empresaAfetada: txt(campo(v, "empresaAfetada")),
    funcionariosAfetados: numOuNull(campo(v, "funcionariosAfetados")),
    responsavelInfo: txt(campo(v, "responsavelInfo")),
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
