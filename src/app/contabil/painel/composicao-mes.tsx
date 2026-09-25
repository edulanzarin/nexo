"use client";

import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Esqueleto, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { trabalhoContabil } from "@/componentes/produto/contabil/painel-atividade";
import { num, pct } from "@/lib/format";
import type { ContabilAtividade } from "@/lib/painel-contabil-tipos";

/*
 * Os gestos do mês e a classe de cada um no catálogo de trabalhos do app: a cor
 * da conciliação aqui é a mesma do feed ao lado e da Produtividade.
 */
const PARTES: { classe: string; rotulo: string; valor: (a: ContabilAtividade) => number }[] = [
  { classe: "conciliacao", rotulo: "Conciliações", valor: (a) => a.conciliacoes },
  { classe: "laudo", rotulo: "Laudos", valor: (a) => a.laudos },
  { classe: "implantacao", rotulo: "Implantações", valor: (a) => a.implantacoes },
  { classe: "triagem", rotulo: "Triagens", valor: (a) => a.pendenciasTriadas },
  { classe: "leitura", rotulo: "Exportações", valor: (a) => a.exportacoes },
];

/**
 * Como o mês da pessoa se divide entre os tipos de trabalho. O painel do
 * analista não tem série (ela é do time), e a pergunta que sobra para ele é de
 * proporção: o mês foi de conciliar, de triar ou de exportar?
 */
export function ComposicaoMes({
  atividade,
  carregando,
}: {
  atividade: ContabilAtividade | null | undefined;
  carregando?: boolean;
}) {
  // Bloco que não veio já aparece como indisponível na faixa de cima; aqui só some.
  if (!carregando && !atividade) return null;
  const partes = atividade
    ? PARTES.map((p) => ({ ...trabalhoContabil(p.classe), rotulo: p.rotulo, valor: p.valor(atividade) }))
    : [];
  const total = partes.reduce((s, p) => s + p.valor, 0);

  return (
    <Painel titulo="Como o Seu Mês Se Divide" descricao="Por Tipo de Trabalho" icone="grafico">
      {carregando ? (
        <div aria-busy className="flex flex-col gap-3">
          <Esqueleto className="h-2 w-full" />
          {PARTES.map((p) => (
            <Esqueleto key={p.classe} className="h-4 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <Vazio compacto icone="grafico" titulo="Nada rodado no mês ainda" />
      ) : (
        <div className="flex flex-col gap-3">
          <BarraComposicao partes={partes} />
          <ul className="flex flex-col">
            {partes.map((p) => (
              <li
                key={p.rotulo}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-2 border-b border-linha py-1.5 last:border-0"
              >
                <span aria-hidden className="size-2 rounded-[3px]" style={{ background: p.cor }} />
                <span className="truncate text-corpo text-tinta-2">{p.rotulo}</span>
                <span className="num text-corpo font-[600] text-tinta">{num(p.valor)}</span>
                <span className="num text-right text-pequeno text-apagado">{pct((p.valor / total) * 100)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Painel>
  );
}
