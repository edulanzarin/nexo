"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarraProporcao } from "@/componentes/primitivos/barra";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { brl, num } from "@/lib/format";
import type { CustoGrupo } from "@/lib/types";
import { COR_CUSTO } from "./custo-cores";

/**
 * O custo de folha por uma dimensão (setor, cargo, estabelecimento): quanto o
 * grupo custou em proventos, quantas pessoas e o custo médio. A barra ao lado
 * do valor responde "onde está o dinheiro" sem ler número por número; a régua é
 * o maior grupo.
 *
 * Cada contrato cai num grupo só (a lotação atual), então pessoas e custo somam
 * no total. Com busca o total some: somado sobre o que sobrou, diria outro
 * número com o nome de total.
 */
export function PainelCustoQuebra({
  titulo,
  rotuloColuna,
  grupos,
  carregando,
  className,
}: {
  titulo: ReactNode;
  /** Nome da primeira coluna ("Setor", "Cargo"). */
  rotuloColuna: string;
  grupos: CustoGrupo[] | undefined;
  carregando?: boolean;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => {
    if (!grupos) return undefined;
    const q = normalizar(busca.trim());
    return q ? grupos.filter((g) => normalizar(g.grupo).includes(q)) : grupos;
  }, [grupos, busca]);

  const colunas = useMemo<Coluna<CustoGrupo>[]>(() => {
    const lista = grupos ?? [];
    const maior = Math.max(0, ...lista.map((g) => g.proventos));
    const tot = busca.trim()
      ? null
      : {
          custo: lista.reduce((s, g) => s + g.proventos, 0),
          pessoas: lista.reduce((s, g) => s + g.funcionarios, 0),
        };
    return [
      {
        id: "grupo",
        cabecalho: rotuloColuna,
        largura: "40%",
        ordenar: (g) => g.grupo,
        classe: "font-[560] text-tinta",
        celula: (g) => (
          <span className="block truncate" title={g.grupo}>
            {g.grupo}
          </span>
        ),
        rodape: tot ? "Total" : undefined,
      },
      {
        id: "custo",
        cabecalho: "Custo",
        alinhar: "dir",
        ordenar: (g) => g.proventos,
        celula: (g) => (
          <span className="flex items-center justify-end gap-2">
            <BarraProporcao
              className="hidden w-14 sm:block"
              valor={maior > 0 ? g.proventos / maior : 0}
              cor={COR_CUSTO.proventos}
              rotulo={`Custo de ${g.grupo}`}
            />
            <span className="font-[560] text-tinta">{brl(g.proventos)}</span>
          </span>
        ),
        rodape: tot ? brl(tot.custo) : undefined,
      },
      {
        id: "pessoas",
        cabecalho: "Pessoas",
        alinhar: "dir",
        ordenar: (g) => g.funcionarios,
        celula: (g) => num(g.funcionarios),
        rodape: tot ? num(tot.pessoas) : undefined,
      },
      {
        id: "medio",
        cabecalho: "Custo médio",
        alinhar: "dir",
        ordenar: (g) => g.custoMedio,
        celula: (g) => <span className="text-apagado">{brl(g.custoMedio)}</span>,
        rodape: tot ? brl(tot.pessoas > 0 ? tot.custo / tot.pessoas : 0) : undefined,
      },
    ];
  }, [grupos, busca, rotuloColuna]);

  const n = visiveis?.length ?? 0;
  return (
    <Painel
      className={className}
      corpo="p-0"
      titulo={titulo}
      descricao={visiveis ? `${num(n)} ${n === 1 ? "grupo" : "grupos"}` : undefined}
      acoes={
        <Campo
          icone="buscar"
          placeholder={`Buscar ${rotuloColuna.toLowerCase()}`}
          classeCaixa="nx-sem-papel w-48"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label={`Buscar ${rotuloColuna.toLowerCase()}`}
        />
      }
    >
      {carregando || !grupos || !visiveis ? (
        <EsqueletoTabela colunas={4} linhas={6} />
      ) : (
        <TabelaDados
          colunas={colunas}
          linhas={visiveis}
          chave={(g) => g.grupo}
          ordemInicial={{ coluna: "custo", sentido: "desc" }}
          alturaMax="26rem"
          className="print:!max-h-none print:!overflow-visible"
          rotulo={typeof titulo === "string" ? titulo : rotuloColuna}
          vazio={
            grupos.length === 0 ? (
              <Vazio compacto icone="moedas" titulo="Nenhum provento no período" />
            ) : (
              <Vazio
                compacto
                icone="buscar"
                titulo="Nenhum grupo com essa busca"
                acao={
                  <Botao variante="fantasma" icone="fechar" onClick={() => setBusca("")}>
                    Limpar busca
                  </Botao>
                }
              />
            )
          }
        />
      )}
    </Painel>
  );
}
