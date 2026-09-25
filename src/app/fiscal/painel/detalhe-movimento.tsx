"use client";

import type { ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { brl, deltaPct, num, pct } from "@/lib/format";
import type { CancelamentosResumo, DevolucoesResumo, Overview } from "@/lib/types";

interface Linha {
  medida: string;
  ent: ReactNode;
  sai: ReactNode;
  total: ReactNode;
}

const COLUNAS: Coluna<Linha>[] = [
  { id: "medida", cabecalho: "", celula: (l) => l.medida, classe: "text-tinta-2" },
  { id: "ent", cabecalho: "Entradas", alinhar: "dir", celula: (l) => l.ent },
  { id: "sai", cabecalho: "Saídas", alinhar: "dir", celula: (l) => l.sai },
  { id: "total", cabecalho: "Total", alinhar: "dir", celula: (l) => l.total, classe: "font-[600] text-tinta" },
];

const razao = (parte: number, base: number) => (base > 0 ? (parte / base) * 100 : null);
const medio = (valor: number, qtd: number) => (qtd > 0 ? brl(valor / qtd) : "—");

/** Variação contra o período anterior, ou o travessão quando não houve período anterior. */
function variacao(atual: number, anterior: number) {
  return deltaPct(atual, anterior) == null ? "—" : <Variacao atual={atual} anterior={anterior} />;
}

/**
 * O movimento do período lado a lado: o que a faixa do Painel resume em cinco
 * números, aberto em entradas, saídas e total, com o valor cheio que a faixa
 * abrevia. Abre de qualquer indicador do movimento.
 */
export function DetalheMovimento({
  aberto,
  onFechar,
  periodo,
  overview,
  devolucoes,
  cancelamentos,
}: {
  aberto: boolean;
  onFechar: () => void;
  periodo?: string;
  overview: Overview;
  devolucoes: DevolucoesResumo;
  cancelamentos: CancelamentosResumo;
}) {
  const { entradas: e, saidas: s } = overview;
  const dv = devolucoes;
  const cc = cancelamentos;
  const valor = e.valor + s.valor;
  const qtd = e.qtd + s.qtd;
  const valorAnterior = e.valorAnterior + s.valorAnterior;
  const qtdAnterior = e.qtdAnterior + s.qtdAnterior;
  const canceladas = cc.ent.canceladas + cc.sai.canceladas;
  const lancadas = cc.ent.total + cc.sai.total;
  const devolvido = dv.ent.valor + dv.sai.valor;

  const linhas: Linha[] = [
    { medida: "Valor contábil", ent: brl(e.valor), sai: brl(s.valor), total: brl(valor) },
    { medida: "Notas", ent: num(e.qtd), sai: num(s.qtd), total: num(qtd) },
    { medida: "Ticket médio", ent: medio(e.valor, e.qtd), sai: medio(s.valor, s.qtd), total: medio(valor, qtd) },
    {
      medida: "Valor no período anterior",
      ent: brl(e.valorAnterior),
      sai: brl(s.valorAnterior),
      total: brl(valorAnterior),
    },
    {
      medida: "Variação do valor",
      ent: variacao(e.valor, e.valorAnterior),
      sai: variacao(s.valor, s.valorAnterior),
      total: variacao(valor, valorAnterior),
    },
    { medida: "Notas no período anterior", ent: num(e.qtdAnterior), sai: num(s.qtdAnterior), total: num(qtdAnterior) },
    {
      medida: "Variação das notas",
      ent: variacao(e.qtd, e.qtdAnterior),
      sai: variacao(s.qtd, s.qtdAnterior),
      total: variacao(qtd, qtdAnterior),
    },
    {
      medida: "Canceladas",
      ent: num(cc.ent.canceladas),
      sai: num(cc.sai.canceladas),
      total: num(canceladas),
    },
    {
      medida: "Taxa de cancelamento",
      ent: pct(razao(cc.ent.canceladas, cc.ent.total), 2),
      sai: pct(razao(cc.sai.canceladas, cc.sai.total), 2),
      total: pct(razao(canceladas, lancadas), 2),
    },
    { medida: "Devolvido", ent: brl(dv.ent.valor), sai: brl(dv.sai.valor), total: brl(devolvido) },
    { medida: "Notas com devolução", ent: num(dv.ent.qtd), sai: num(dv.sai.qtd), total: num(dv.ent.qtd + dv.sai.qtd) },
    {
      medida: "Devolvido sobre o movimento",
      ent: pct(razao(dv.ent.valor, dv.faturamentoEnt)),
      sai: pct(razao(dv.sai.valor, dv.faturamentoSai)),
      total: pct(razao(devolvido, dv.faturamentoEnt + dv.faturamentoSai)),
    },
  ];

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Movimento do Período"
      descricao={periodo}
      largura="g"
      corpo="p-0"
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <TabelaDados colunas={COLUNAS} linhas={linhas} chave={(l) => l.medida} rotulo="Movimento por lado" />
      <div className="border-t border-linha px-5 py-3">
        <Nota>
          Valor e notas sem as canceladas. Devolução na entrada é venda devolvida; na saída, compra devolvida.
        </Nota>
      </div>
    </Modal>
  );
}
