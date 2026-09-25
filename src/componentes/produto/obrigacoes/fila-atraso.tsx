import { Selo } from "@/componentes/primitivos/selo";
import { emDiasTexto } from "@/componentes/produto/folha/prazo-dp";

/*
 * O atraso de uma entrega do Acessórias, em dias corridos desde o prazo
 * (`diasAtraso`: negativo é futuro, null é entrega sem prazo). A régua é a da
 * lib: vencida é a de prazo ANTERIOR a hoje, então o prazo de hoje ainda está
 * no prazo, e é assim que o indicador de Vencidas conta.
 */

/** Acima disto o atraso é perigo; de 1 até aqui, atenção. */
export const ATRASO_CRITICO = 30;

export function SeloAtraso({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-apagado">—</span>;
  if (dias > ATRASO_CRITICO) return <Selo tom="perigo">{emDiasTexto(dias)}</Selo>;
  if (dias > 0) return <Selo tom="atencao">{emDiasTexto(dias)}</Selo>;
  return <span className="text-apagado">No prazo</span>;
}
