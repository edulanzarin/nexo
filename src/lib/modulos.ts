import { SECOES_CONTABIL } from "./secoes/contabil";
import { SECOES_FISCAL } from "./secoes/fiscal";
import { SECOES_FOLHA } from "./secoes/folha";
import { SECOES_CONFIG, SECOES_OBRIGACOES, SECOES_SOCIETARIO } from "./secoes/outros";
import { SECOES_RH } from "./secoes/rh";
import type { Aba, Secao } from "./secoes/tipos";

export type ModuloId =
  | "fiscal"
  | "contabil"
  | "folha"
  | "societario"
  | "rh"
  | "obrigacoes"
  | "config";

/**
 * Catálogo dos módulos. É a fonte única da navegação: dirige o início, a barra
 * lateral, a paleta de comandos e o gate de permissão (o id casa com o prefixo
 * `/api/<id>` das rotas e com a chave `modulo/secao` dos cargos).
 */
export interface Modulo {
  id: ModuloId;
  titulo: string;
  descricao: string;
  /** Nome no registro de ícones. */
  icone: string;
  /**
   * Cor de identidade do módulo (a paleta é do Eduardo). Só pinta a marca do
   * módulo; nunca estado, nunca acento de interface.
   */
  cor: "amarelo" | "vermelho" | "azul" | "rosa" | "laranja" | "cinza" | "verde";
  /** O módulo já foi refeito no NaveX. Os outros aparecem como "a caminho". */
  pronto: boolean;
}

export const MODULOS: Modulo[] = [
  {
    id: "contabil",
    titulo: "Contábil",
    descricao: "Conciliação, conferência, balancetes e a produtividade do time",
    icone: "setor-contabil",
    cor: "vermelho",
    pronto: true,
  },
  {
    id: "fiscal",
    titulo: "Fiscal",
    descricao: "Painéis, análises e tributos sobre as notas",
    icone: "setor-fiscal",
    cor: "amarelo",
    pronto: true,
  },
  {
    id: "folha",
    titulo: "DP",
    descricao: "Rotatividade, custo de folha, férias, rescisões e eSocial",
    icone: "setor-dp",
    cor: "azul",
    pronto: true,
  },
  {
    id: "rh",
    titulo: "RH",
    descricao: "Pessoal da Navecon: diretório, experiência e canais",
    icone: "setor-rh",
    cor: "rosa",
    pronto: true,
  },
  {
    id: "obrigacoes",
    titulo: "Obrigações",
    descricao: "Fila de entregas do Acessórias, por setor e responsável",
    icone: "setor-obrigacoes",
    cor: "laranja",
    pronto: false,
  },
  {
    id: "societario",
    titulo: "Societário",
    descricao: "Contratos, alterações, aberturas e baixas",
    icone: "setor-societario",
    cor: "verde",
    pronto: false,
  },
  {
    id: "config",
    titulo: "Configurações",
    descricao: "Cadastros do sistema, como grupos de empresa",
    icone: "setor-config",
    cor: "cinza",
    pronto: false,
  },
];

const SECOES: Record<ModuloId, Secao[]> = {
  contabil: SECOES_CONTABIL,
  fiscal: SECOES_FISCAL,
  folha: SECOES_FOLHA,
  rh: SECOES_RH,
  obrigacoes: SECOES_OBRIGACOES,
  societario: SECOES_SOCIETARIO,
  config: SECOES_CONFIG,
};

export function getModulo(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

export function secoesDoModulo(id: ModuloId): Secao[] {
  return SECOES[id];
}

export interface Local {
  modulo: Modulo;
  secao: Secao;
  aba: Aba | undefined;
}

// Aba mais específica primeiro: /conciliacao/regras antes de /conciliacao.
const TODAS_ABAS = MODULOS.flatMap((modulo) =>
  SECOES[modulo.id].flatMap((secao) => secao.abas.map((aba) => ({ modulo, secao, aba })))
).sort((a, b) => b.aba.path.length - a.aba.path.length);

function casa(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}

/** Onde o caminho está: módulo, seção e aba. `undefined` fora de um módulo. */
export function localDoCaminho(pathname: string): Local | undefined {
  const porAba = TODAS_ABAS.find((x) => casa(pathname, x.aba.path));
  if (porAba) return porAba;
  for (const modulo of MODULOS) {
    const secao = SECOES[modulo.id].find((s) => casa(pathname, s.path));
    if (secao) return { modulo, secao, aba: undefined };
  }
  return undefined;
}

export function moduloDoCaminho(pathname: string): Modulo | undefined {
  return getModulo(pathname.split("/")[1] ?? "");
}
