"use client";

import { useState, type ReactNode } from "react";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao } from "@/componentes/primitivos/tabela";
import type { RespostaClima } from "@/lib/clima-tipos";
import { dataBR, num } from "@/lib/format";
import type { FormularioCampo } from "@/lib/formularios-tipos";
import { CamposFormulario } from "./campos-formulario";

/** Uma resposta inteira ocupa meia tela: dez por página ainda se lê sem cansar. */
const POR_PAGINA = 10;

/**
 * As respostas de uma avaliação anônima, uma a uma, lidas com as perguntas do
 * formulário. Só a data, sem a hora: numa equipe pequena a hora ajuda a
 * adivinhar quem respondeu. A numeração conta da primeira para a última, então
 * a resposta 1 é sempre a mesma, chegue quantas chegarem depois.
 */
export function RespostasClima({
  campos,
  respostas,
  vazio,
}: {
  campos: FormularioCampo[];
  /** Mais recentes primeiro, como a lib devolve. */
  respostas: RespostaClima[];
  /** O que mostrar sem nenhuma resposta. */
  vazio?: ReactNode;
}) {
  const [pagina, setPagina] = useState(1);
  const total = respostas.length;
  if (total === 0) return <>{vazio}</>;

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // A lista pode encolher (troca de rodada) com a página lá atrás.
  const p = Math.min(pagina, paginas);
  const inicio = (p - 1) * POR_PAGINA;
  const visiveis = respostas.slice(inicio, inicio + POR_PAGINA);
  const paginacao =
    total > POR_PAGINA ? (
      <Paginacao pagina={p} porPagina={POR_PAGINA} total={total} onPagina={setPagina} />
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-corpo text-tinta-2">
          <span className="num font-[600] text-tinta">{num(total)}</span>{" "}
          {total === 1 ? "resposta anônima" : "respostas anônimas"}, da mais recente para a mais antiga
        </p>
        {paginacao}
      </div>
      {visiveis.map((r, i) => {
        const numero = total - (inicio + i);
        return (
          <Painel
            key={numero}
            titulo={`Resposta ${num(numero)}`}
            acoes={<span className="num text-pequeno text-apagado">{dataBR(r.criadoEm)}</span>}
          >
            <CamposFormulario campos={campos} valores={r.valores} somenteLeitura />
          </Painel>
        );
      })}
      {paginacao && <div className="px-1">{paginacao}</div>}
    </div>
  );
}
