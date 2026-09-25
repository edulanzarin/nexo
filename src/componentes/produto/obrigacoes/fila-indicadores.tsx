"use client";

import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { num, pct } from "@/lib/format";
import type { PainelObrigacoes } from "@/lib/obrigacoes-tipos";
import type { RecorteFila } from "./fila-filtros";

/*
 * Os números da fila. Saem da mesma consulta que a tabela, com os mesmos
 * filtros, então nunca discordam dela. Vencidas e Com multa são também o
 * atalho do recorte: o clique liga o recorte, o segundo clique solta, e a
 * lâmpada fica na cor da seleção enquanto ele vale.
 */
export function FaixaFila({
  dados,
  carregando,
  recorte = "todas",
  onRecorte,
}: {
  dados?: Pick<PainelObrigacoes, "total" | "atrasadas" | "comMulta" | "semParNoQuestor" | "setores">;
  carregando?: boolean;
  recorte?: RecorteFila;
  onRecorte?: (r: RecorteFila) => void;
}) {
  const esperando = carregando || !dados;
  const total = dados?.total ?? 0;
  const vencidas = dados?.atrasadas ?? 0;
  const multa = dados?.comMulta ?? 0;
  const semPar = dados?.semParNoQuestor ?? 0;
  const setores = dados?.setores;
  const alternar = (r: RecorteFila) => (onRecorte ? () => onRecorte(recorte === r ? "todas" : r) : undefined);

  return (
    <FaixaIndicadores colunas={4}>
      <Indicador
        rotulo="Na fila"
        icone="fila"
        carregando={esperando}
        valor={num(total)}
        detalhe="Entregas em aberto"
      />
      <Indicador
        rotulo="Vencidas"
        icone="alerta"
        carregando={esperando}
        valor={num(vencidas)}
        detalhe={total > 0 ? `${pct((vencidas / total) * 100, 0)} da fila` : "Prazo anterior a hoje"}
        tom={recorte === "vencidas" ? "rota" : vencidas > 0 ? "perigo" : "neutro"}
        valorNoTom={vencidas > 0 && recorte !== "vencidas"}
        onClick={alternar("vencidas")}
      />
      <Indicador
        rotulo="Com multa"
        icone="recibo"
        carregando={esperando}
        valor={num(multa)}
        detalhe="O atraso gera multa"
        tom={recorte === "multa" ? "rota" : "neutro"}
        onClick={alternar("multa")}
      />
      <Indicador
        rotulo="Setores com fila"
        icone="camadas"
        carregando={esperando}
        valor={setores ? num(setores.length) : "—"}
        detalhe={
          semPar > 0
            ? `${num(semPar)} ${semPar === 1 ? "entrega sem par" : "entregas sem par"} no Questor`
            : "Toda empresa da fila casa com o Questor"
        }
      />
    </FaixaIndicadores>
  );
}
