"use client";

import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Dica } from "@/componentes/primitivos/dica";
import { brlCompact, num, pct } from "@/lib/format";
import { classeDaEspecie, ESPECIES_PROD } from "@/lib/fiscal-produtividade-tipos";
import type { EspecieResumo, Metrica } from "@/lib/types";

/** Uma espécie do catálogo com o que o período teve dela. */
export interface EspecieAgrupada {
  id: string;
  rotulo: string;
  descricao: string;
  cor: string;
  entradas: number;
  saidas: number;
  qtd: number;
}

const OUTRAS = "OUTRAS";

/**
 * Traz a lista da rota para o catálogo de espécies. A rota devolve as cinco
 * maiores pelo nome do banco e junta o resto em "Outras"; aqui toda espécie
 * fora do catálogo cai em Outras também, senão uma "CF" entre as cinco maiores
 * ganharia o mesmo cinza da sobra e a legenda teria duas linhas iguais. O que
 * foi parar em Outras vai escrito na descrição dela.
 */
export function agruparEspecies(dados: EspecieResumo[]): EspecieAgrupada[] {
  const mapa = new Map<string, EspecieAgrupada>();
  const dentro: string[] = [];
  let temResto = false;
  for (const d of dados) {
    const id = classeDaEspecie(d.especie);
    const info = ESPECIES_PROD.find((e) => e.id === id)!;
    let g = mapa.get(id);
    if (!g) {
      g = { id, rotulo: info.rotulo, descricao: info.descricao, cor: info.cor, entradas: 0, saidas: 0, qtd: 0 };
      mapa.set(id, g);
    }
    g.entradas += d.entradas;
    g.saidas += d.saidas;
    g.qtd += d.qtd;
    if (id === OUTRAS) {
      if (d.especie.trim().toUpperCase() === OUTRAS) temResto = true;
      else dentro.push(d.especie.trim() || "sem espécie");
    }
  }
  const outras = mapa.get(OUTRAS);
  if (outras && dentro.length)
    outras.descricao = `${dentro.join(", ")}${temResto ? " e as demais espécies" : ""}`;
  return [...mapa.values()];
}

/** O número da espécie na métrica do módulo. */
export const medirEspecie = (g: EspecieAgrupada, metrica: Metrica) =>
  metrica === "valor" ? g.entradas + g.saidas : g.qtd;

/**
 * De que espécie é feito o movimento do período: uma barra de composição e,
 * embaixo, cada espécie com o número na métrica escolhida, o peso e a divisão
 * entre entradas e saídas. A cor é a da espécie no catálogo (NF-e é sempre o
 * mesmo azul), nunca a da posição na lista, e Outras fecha a lista.
 */
export function ComposicaoEspecies({ dados, metrica }: { dados: EspecieResumo[]; metrica: Metrica }) {
  const grupos = agruparEspecies(dados);
  const medir = (g: EspecieAgrupada) => medirEspecie(g, metrica);
  const formatar = metrica === "valor" ? brlCompact : num;
  const ordenados = [...grupos].sort(
    (a, b) => Number(a.id === OUTRAS) - Number(b.id === OUTRAS) || medir(b) - medir(a)
  );
  const total = ordenados.reduce((s, g) => s + medir(g), 0);
  if (total === 0)
    return <p className="py-6 text-center text-corpo text-apagado italic">Nenhuma nota no recorte.</p>;
  return (
    <div className="flex flex-col gap-3">
      <BarraComposicao
        className="h-3"
        partes={ordenados.map((g) => ({ valor: medir(g), cor: g.cor, rotulo: `${g.rotulo}: ${formatar(medir(g))}` }))}
      />
      <ul className="flex flex-col">
        {ordenados.map((g) => (
          <li key={g.id} className="flex min-w-0 flex-col gap-0.5 border-b border-linha py-2 last:border-0 last:pb-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <Dica texto={g.descricao} className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5 text-corpo text-tinta-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: g.cor }} />
                  <span className="truncate">{g.rotulo}</span>
                </span>
              </Dica>
              <span className="num ml-auto text-corpo font-[600] text-tinta">{formatar(medir(g))}</span>
              <span className="num w-12 shrink-0 text-right text-pequeno text-apagado">{pct((medir(g) / total) * 100)}</span>
            </div>
            <p className="num truncate pl-3.5 text-micro text-apagado">
              {brlCompact(g.entradas)} em entradas · {brlCompact(g.saidas)} em saídas
              {metrica === "valor" && ` · ${num(g.qtd)} ${g.qtd === 1 ? "nota" : "notas"}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
