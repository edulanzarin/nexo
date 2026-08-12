import { SECOES_FISCAL, type SecaoFiscal } from "./fiscal-secoes";
import { SECOES_CONTABIL } from "./contabil-secoes";
import { SECOES_FOLHA } from "./folha-secoes";
import { SECOES_RH } from "./rh-secoes";
import { SECOES_CONFIG } from "./config-secoes";

export type ModuloId = "fiscal" | "contabil" | "folha" | "rh" | "config";

/**
 * Catálogo dos módulos do Nexo. É a fonte única: dirige o launcher, a
 * sidebar de cada módulo e o gate de permissão (o id casa com o nível do perfil
 * em [[sessao]] e com o prefixo /api/<id> das rotas). Módulo novo é uma entrada
 * aqui — não três lugares para editar e um para esquecer.
 */
export interface Modulo {
  id: ModuloId;
  titulo: string;
  descricao: string;
  /** Ícone do módulo em /public/images. */
  icone: string;
  /** Primeira tela ao entrar no módulo pelo launcher. */
  home: string;
}

export const MODULOS: Modulo[] = [
  {
    id: "fiscal",
    titulo: "Fiscal",
    descricao: "Painéis, análises e tributos sobre as notas",
    icone: "/images/fiscal.png",
    home: "/fiscal/painel",
  },
  {
    id: "contabil",
    titulo: "Contábil",
    descricao: "Conferência fiscal e conciliação bancária",
    icone: "/images/contabil.png",
    home: "/contabil/conciliacao",
  },
  {
    id: "folha",
    titulo: "DP",
    descricao: "Departamento Pessoal: rotatividade, custo, eSocial e post mortem",
    icone: "/images/folha.png",
    // Home = o índice do módulo, que redireciona pra 1ª seção que a pessoa vê.
    // Analista do DP (só Post Mortem) cai direto na dele; quem tem tudo, na 1ª.
    home: "/folha",
  },
  {
    id: "rh",
    titulo: "RH",
    descricao: "Pessoal da Navecon: diretório e experiência",
    icone: "/images/rh.png",
    home: "/rh/diretorio",
  },
  {
    id: "config",
    titulo: "Configurações",
    descricao: "Configs de domínio do sistema, como grupos de empresa",
    icone: "/images/config.png",
    home: "/config",
  },
];

export function getModulo(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

const SECOES: Record<ModuloId, SecaoFiscal[]> = {
  fiscal: SECOES_FISCAL,
  contabil: SECOES_CONTABIL,
  folha: SECOES_FOLHA,
  rh: SECOES_RH,
  config: SECOES_CONFIG,
};

/** Seções que a sidebar do módulo lista. A sidebar só usa o recorte SecaoFiscal. */
export function secoesDoModulo(id: ModuloId): SecaoFiscal[] {
  return SECOES[id];
}
