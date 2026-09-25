"use client";

import { Esqueleto } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { RankingBarras } from "@/componentes/produto/graficos";
import { brl, pct } from "@/lib/format";
import type { CustoRubrica } from "@/lib/types";
import { COR_CUSTO } from "./custo-cores";

function Lado({
  titulo,
  rubricas,
  total,
  cor,
  vazio,
  carregando,
}: {
  titulo: string;
  rubricas: CustoRubrica[] | undefined;
  total: number;
  cor: string;
  vazio: string;
  carregando?: boolean;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 px-2 text-pequeno font-[600] text-tinta-2">
        <span aria-hidden className="size-2 rounded-[3px]" style={{ background: cor }} />
        {titulo}
      </h3>
      {carregando || !rubricas ? (
        <div aria-busy className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2 py-2">
              <Esqueleto className="h-3 w-44" />
              <Esqueleto className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <RankingBarras
          itens={rubricas}
          rotulo={(r) => (
            <>
              <span className="num text-pequeno text-apagado">{r.codigo}</span> {r.descricao}
            </>
          )}
          valor={(r) => r.total}
          formatar={brl}
          cor={() => cor}
          detalhe={(r) => (total > 0 ? `${pct((r.total / total) * 100)} do total` : undefined)}
          vazio={vazio}
        />
      )}
    </section>
  );
}

/**
 * As rubricas que mais pesaram, proventos e descontos lado a lado: é a memória
 * do custo, o "de onde saiu esse número" que o DP confere contra o espelho da
 * folha. O código vai ao lado do nome porque é por ele que o DP acha a rubrica
 * no Questor. A porcentagem é sobre o total do lado, não só sobre as da lista.
 */
export function PainelRubricas({
  proventos,
  descontos,
  totalProventos,
  totalDescontos,
  carregando,
  className,
}: {
  proventos: CustoRubrica[] | undefined;
  descontos: CustoRubrica[] | undefined;
  totalProventos: number;
  totalDescontos: number;
  carregando?: boolean;
  className?: string;
}) {
  return (
    <Painel
      className={className}
      titulo="Principais Rubricas"
      descricao="As que mais pesaram no período, de cada lado da folha"
      corpo="p-2"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
        <Lado
          titulo="Proventos"
          rubricas={proventos}
          total={totalProventos}
          cor={COR_CUSTO.proventos}
          vazio="Nenhum provento no período."
          carregando={carregando}
        />
        <Lado
          titulo="Descontos"
          rubricas={descontos}
          total={totalDescontos}
          cor={COR_CUSTO.descontos}
          vazio="Nenhum desconto no período."
          carregando={carregando}
        />
      </div>
    </Painel>
  );
}
