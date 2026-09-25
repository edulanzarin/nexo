"use client";

import { useMemo } from "react";
import { CaixaGrafico, GraficoSerie, Legenda, type Serie } from "@/componentes/produto/graficos";
import { nomeMes } from "@/lib/contexto";
import { mesBR, num, pct } from "@/lib/format";
import type { TurnoverPonto } from "@/lib/types";
import { COR_MOVIMENTO } from "./cores";
import { pctTurnover } from "./quebra-turnover";

const SERIES: Serie[] = [
  { chave: "admissoes", rotulo: "Admissões", cor: COR_MOVIMENTO.admissoes, tipo: "barra" },
  { chave: "desligamentos", rotulo: "Desligamentos", cor: COR_MOVIMENTO.desligamentos, tipo: "barra" },
  { chave: "turnover", rotulo: "Turnover", cor: COR_MOVIMENTO.turnover, tipo: "linha", eixoDireito: true },
];

/**
 * Rotatividade mês a mês: entradas e saídas em barras, na escala de pessoas, e
 * o índice na linha, no eixo da direita. Pessoas e porcentagem na mesma régua
 * achatariam uma das duas.
 *
 * Só faz sentido com dois meses ou mais; quem decide mostrar é a tela, pelo
 * período executado, para o painel não surgir e sumir quando o dado chega.
 */
export function SerieTurnover({
  pontos,
  carregando,
  className,
}: {
  pontos: TurnoverPonto[] | undefined;
  carregando?: boolean;
  className?: string;
}) {
  const dados = useMemo(
    () =>
      (pontos ?? []).map(
        (p) => ({ ...p, rotulo: mesBR(p.mes) }) as unknown as Record<string, unknown>
      ),
    [pontos]
  );
  const parado = pontos != null && pontos.every((p) => p.admissoes + p.desligamentos === 0);
  return (
    <CaixaGrafico
      className={className}
      titulo="Rotatividade Mês a Mês"
      descricao="Admissões e desligamentos em barras, turnover na linha"
      legenda={<Legenda itens={SERIES.map((s) => ({ rotulo: s.rotulo, cor: s.cor }))} />}
      carregando={carregando || !pontos}
      vazio={parado ? "Ninguém entrou nem saiu no período." : false}
      altura={280}
    >
      <GraficoSerie
        dados={dados}
        x="rotulo"
        series={SERIES}
        formatar={(v, s) => (s.chave === "turnover" ? pctTurnover(v) : num(v))}
        // Pessoa não se fraciona: com poucas movimentações a escala divide em
        // 0,5 e o rótulo arredondado repetia "1, 1, 2".
        formatarEixo={(v) => (Number.isInteger(v) ? num(v) : "")}
        formatarEixoDireito={(v) => pct(v, 0)}
        tituloDica={(l) => (
          <>
            {nomeMes(String(l.mes).slice(0, 7), true)}
            <span className="block font-[400] text-apagado">
              {num(Number(l.ativos))} ativos no fim do mês
            </span>
          </>
        )}
      />
    </CaixaGrafico>
  );
}
