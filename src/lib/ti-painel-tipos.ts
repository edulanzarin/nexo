/**
 * O Painel da TI: o que cobra ação agora (equipamento a recolher, manutenção
 * parada, garantia e licença vencendo, senha antiga) e o que aconteceu por
 * último, no inventário e no cofre.
 *
 * Cada lado só vem para quem tem a seção dele: quem não tem o cofre não fica
 * sabendo nem o nome dos acessos. `null` com a seção permitida é o bloco que
 * falhou no servidor, e vira buraco só nele.
 */

export interface PainelTiEquipamentos {
  ativos: number;
  uso: number;
  /** Quantas pessoas, do Diretório ou de fora, estão com algum equipamento. */
  pessoas: number;
  estoque: number;
  manutencao: number;
  baixados: number;
  /** `null`: o Diretório não respondeu, e não dá para dizer quem saiu. */
  aRecolher: number | null;
  /** Na manutenção há mais de `DIAS_MANUTENCAO_LONGA`. */
  manutencaoLonga: number;
  /** Garantia que vence nos próximos `DIAS_GARANTIA`. */
  garantiasVencendo: number;
  porTipo: { tipo: string; uso: number; estoque: number; manutencao: number }[];
}

export interface PainelTiAcessos {
  total: number;
  grupos: number;
  porTipo: { tipo: string; n: number }[];
  senhasAntigas: number;
  /** Vencidas e as que vencem em `DIAS_LICENCA`. */
  licencasVencendo: number;
  /** Segredos vistos ou copiados nos últimos 7 dias. */
  vistas7: number;
  /** Segredos trocados nos últimos 30 dias. */
  trocas30: number;
  chave: boolean;
  /** Acessos com segredo guardado por outra chave, que não abre com a de agora. */
  outraChave: number;
}

export type TipoPendenciaTi = "recolher" | "licenca" | "manutencao" | "garantia" | "senha";

export interface PendenciaTi {
  chave: string;
  tipo: TipoPendenciaTi;
  /** O que a pendência abre ao clicar. */
  alvo: { secao: "equipamentos" | "acessos"; id: number };
  titulo: string;
  apoio: string;
  /**
   * Recolher, manutenção e senha contam há quantos dias (desde `data`);
   * garantia e licença contam quanto falta (negativo: já venceu).
   */
  dias: number;
}

export interface AtividadeTi {
  chave: string;
  origem: "equipamentos" | "acessos";
  alvoId: number | null;
  icone: string;
  titulo: string;
  /** O equipamento ou o acesso. */
  alvo: string;
  por: string | null;
  /** "YYYY-MM-DDTHH:MM:SS", hora do escritório. */
  em: string;
}

export interface PainelTi {
  hoje: string;
  permitido: { equipamentos: boolean; acessos: boolean };
  equipamentos: PainelTiEquipamentos | null;
  acessos: PainelTiAcessos | null;
  pendencias: PendenciaTi[];
  atividade: AtividadeTi[];
}

export const DIAS_MANUTENCAO_LONGA = 30;
export const DIAS_GARANTIA = 60;
