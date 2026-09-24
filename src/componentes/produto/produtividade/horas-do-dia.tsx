"use client";

import { useMemo, type ReactNode } from "react";
import { CaixaGrafico, GraficoBarrasCor, Legenda } from "@/componentes/produto/graficos";
import { num, pct } from "@/lib/format";
import { foraDoExpediente, rotuloHora } from "./recorte";

const COR_EXPEDIENTE = "var(--serie-1)";
const COR_FORA = "var(--atencao)";

/**
 * Quando o trabalho acontece, pela hora do dia. Serve para ver hábito e
 * horário incomum: madrugada e fim de expediente são rotina automática rodando
 * fora de hora ou gente virando a noite no fechamento, e por isso ganham a cor
 * de atenção e a porcentagem no cabeçalho.
 */
export function HorasDoDia({
  porHora,
  rotuloItem = "Lançamentos",
  titulo = "Hora do dia",
  descricao,
  carregando,
}: {
  /** 24 posições, da 0h às 23h. */
  porHora: number[] | undefined;
  rotuloItem?: string;
  titulo?: ReactNode;
  descricao?: ReactNode;
  carregando?: boolean;
}) {
  const pontos = useMemo(
    () => (porHora ?? []).map((qtd, h) => ({ hora: rotuloHora(h), inicio: h, qtd, fora: foraDoExpediente(h) })),
    [porHora]
  );
  const total = pontos.reduce((s, p) => s + p.qtd, 0);
  const fora = pontos.reduce((s, p) => s + (p.fora ? p.qtd : 0), 0);
  return (
    <CaixaGrafico
      titulo={titulo}
      descricao={descricao}
      altura={200}
      carregando={carregando || !porHora}
      vazio={total === 0 ? "Nada registrado no período." : false}
      acoes={
        total > 0 ? (
          <span className="text-pequeno text-apagado">
            <span className="num font-[600] text-tinta-2">{pct((fora / total) * 100)}</span> fora do horário
            comercial
          </span>
        ) : undefined
      }
      legenda={
        <Legenda
          itens={[
            { rotulo: "Das 7h às 19h", cor: COR_EXPEDIENTE },
            { rotulo: "Antes das 7h ou a partir das 19h", cor: COR_FORA },
          ]}
        />
      }
    >
      <GraficoBarrasCor
        dados={pontos}
        x="hora"
        y="qtd"
        rotulo={rotuloItem}
        cor={(p) => (p.fora ? COR_FORA : COR_EXPEDIENTE)}
        formatar={num}
        tituloDica={(p) => `${rotuloHora(p.inicio)} às ${String(p.inicio).padStart(2, "0")}:59`}
      />
    </CaixaGrafico>
  );
}
