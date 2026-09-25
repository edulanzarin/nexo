import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import type { FeriasSituacao } from "@/lib/types";

/*
 * A situação de férias de um funcionário, pelo período aquisitivo em aberto
 * mais crítico (`controle-ferias`): vencida é o concessivo esgotado, com risco
 * de pagar em dobro; a vencer é o limite a 120 dias ou menos; direito adquirido
 * tem prazo folgado; em dia não tem nada em aberto.
 */

export const ROTULO_FERIAS: Record<FeriasSituacao, string> = {
  vencida: "Vencida",
  a_vencer: "A vencer",
  adquirida: "Direito adquirido",
  em_dia: "Em dia",
};

export const TOM_FERIAS: Record<FeriasSituacao, Tom> = {
  vencida: "perigo",
  a_vencer: "atencao",
  adquirida: "rota",
  em_dia: "ok",
};

export function SeloFerias({ situacao }: { situacao: FeriasSituacao }) {
  return <Selo tom={TOM_FERIAS[situacao]}>{ROTULO_FERIAS[situacao]}</Selo>;
}
