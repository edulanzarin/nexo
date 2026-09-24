import type { NomeIcone } from "@/componentes/primitivos/icone";
import type { TipoAchado } from "@/lib/types";

/**
 * As seis checagens da auditoria, na voz da tela. A rota só devolve os tipos
 * que acenderam; a tela precisa das seis para dizer quais passaram, porque
 * silêncio sobre o que foi conferido lê-se como "não conferido".
 */
export const CHECAGENS: Record<TipoAchado, { rotulo: string; icone: NomeIcone; criterio: string; severidade: "alta" | "media" }> = {
  sintetica: {
    rotulo: "Lançamento em conta sintética",
    icone: "camadas",
    criterio: "Débito ou crédito numa conta agrupadora. Só analítica recebe lançamento, e o valor some do balancete.",
    severidade: "alta",
  },
  orfa: {
    rotulo: "Conta fora do plano",
    icone: "bloqueado",
    criterio: "O débito ou o crédito aponta para uma conta que não existe no plano da empresa.",
    severidade: "alta",
  },
  sem_historico: {
    rotulo: "Lançamento sem histórico",
    icone: "editar",
    criterio: "Sem histórico padrão nem complemento. A ECD exige histórico no registro I200 e a validação rejeita.",
    severidade: "media",
  },
  extemporaneo: {
    rotulo: "Ajuste de período anterior",
    icone: "historico",
    criterio: "Origem XX (extemporâneo) ou AA (ajuste de exercício anterior): corrige um período já encerrado.",
    severidade: "media",
  },
  manual_controle: {
    rotulo: "Ajuste manual em conta de controle",
    icone: "editar",
    criterio: "Lançamento a dedo numa conta patrimonial que os módulos deveriam conciliar sozinhos.",
    severidade: "media",
  },
  duplicado: {
    rotulo: "Partida repetida",
    icone: "copiar",
    criterio: "Mesma data, contas, valor, origem e histórico mais de uma vez no período. O valor é o excedente.",
    severidade: "media",
  },
};

/** A ordem de apresentação: as graves primeiro, como a rota ordena. */
export const ORDEM_CHECAGENS: TipoAchado[] = [
  "sintetica",
  "orfa",
  "sem_historico",
  "extemporaneo",
  "manual_controle",
  "duplicado",
];

/** Rótulo do código de origem do lançamento (`codigooriglctoctb`). */
export const ORIGEM: Record<string, string> = {
  FP: "Folha",
  FI: "Fiscal",
  CP: "Contas a pagar",
  CR: "Contas a receber",
  FN: "Financeiro",
  IM: "Patrimônio",
  IP: "Importação",
  CB: "Manual",
  CC: "Cartão",
  CE: "Empréstimos",
  LA: "Lalur",
  AA: "Ajuste anterior",
  XX: "Extemporâneo",
  ZZ: "Zeramento",
};

/** Origens digitadas ou importadas à mão, fora dos módulos automáticos. */
export const ORIGENS_MANUAIS = new Set(["CB", "IP", "LA", "ZZ", "AA", "XX"]);
