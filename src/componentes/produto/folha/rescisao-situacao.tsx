import { Par } from "@/componentes/primitivos/painel";
import { Ponto, Selo } from "@/componentes/primitivos/selo";
import type { Tom } from "@/componentes/primitivos/indicador";
import { dataBR } from "@/lib/format";
import type { RescisaoItem, RescisaoSituacao } from "@/lib/rescisoes-tipos";
import { DataComPrazo } from "./prazo-dp";

/*
 * A situação de uma rescisão na fila de pagamento, como a lib a deriva
 * (`rescisoes-calculo`): vencida, vence em breve (dentro da antecedência do
 * aviso), no prazo e paga. Paga é só a marcação manual do DP; o Questor nunca
 * fecha o item sozinho.
 */

export const ROTULO_RESCISAO: Record<RescisaoSituacao, string> = {
  vencida: "Vencida",
  vence_breve: "Vence em breve",
  no_prazo: "No prazo",
  resolvida: "Paga",
};

export const TOM_RESCISAO: Record<RescisaoSituacao, Tom> = {
  vencida: "perigo",
  vence_breve: "atencao",
  no_prazo: "rota",
  resolvida: "ok",
};

/** Selo da situação. A paga leva a data junto: é a primeira pergunta de quem vê "Paga". */
export function SeloRescisao({ item }: { item: Pick<RescisaoItem, "situacao" | "resolvidaEm" | "observacao"> }) {
  const paga = item.situacao === "resolvida";
  return (
    <Selo tom={TOM_RESCISAO[item.situacao]} title={paga && item.observacao ? item.observacao : undefined}>
      {paga && item.resolvidaEm ? `Paga em ${dataBR(item.resolvidaEm)}` : ROTULO_RESCISAO[item.situacao]}
    </Selo>
  );
}

/** Texto do sinal do Questor, também usado na exportação. */
export function textoSinalQuestor(item: Pick<RescisaoItem, "calculada" | "pgtoPrevisto">): string {
  if (!item.calculada) return "Não calculada";
  return item.pgtoPrevisto ? `Previsto para ${dataBR(item.pgtoPrevisto)}` : "Calculada";
}

/**
 * O que o Questor diz da rescisão: se a folha de rescisão foi calculada e a
 * data de pagamento PREVISTA nela. É apoio para conferir, e por isso não muda a
 * situação: a data prevista é gravada no cálculo, antes do pagamento de fato.
 */
export function SinalQuestor({ item }: { item: Pick<RescisaoItem, "calculada" | "pgtoPrevisto"> }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Ponto tom={item.calculada ? "ok" : "atencao"} />
      <span className={item.calculada ? "text-tinta-2" : "text-atencao"}>{textoSinalQuestor(item)}</span>
    </span>
  );
}

/** O detalhe de uma rescisão, para o modal que a linha abre. */
export function CorpoRescisao({ item }: { item: RescisaoItem }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <Par rotulo="Empresa" className="sm:col-span-2">
        {item.empresa} <span className="num text-apagado">{item.codigoempresa}</span>
      </Par>
      <Par rotulo="Contrato">
        <span className="num">{item.contrato}</span>
      </Par>
      <Par rotulo="Motivo">{item.causa ?? <span className="text-apagado">Sem rescisão calculada</span>}</Par>
      <Par rotulo="Desligamento">
        <span className="num">{dataBR(item.dataDesligamento)}</span>
      </Par>
      <Par rotulo="Aviso prévio">
        {item.dataAviso ? <span className="num">{dataBR(item.dataAviso)}</span> : <span className="text-apagado">Sem aviso</span>}
      </Par>
      <Par rotulo="Prazo de pagamento">
        <DataComPrazo data={item.prazo} dias={item.diasParaPrazo} />
      </Par>
      <Par rotulo="Situação">
        <SeloRescisao item={item} />
      </Par>
      <Par rotulo="No Questor" className="sm:col-span-2">
        <SinalQuestor item={item} />
      </Par>
      {item.observacao && (
        <Par rotulo="Observação" className="sm:col-span-2">
          <span className="whitespace-pre-line">{item.observacao}</span>
        </Par>
      )}
    </dl>
  );
}
