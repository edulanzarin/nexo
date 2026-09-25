"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Campo } from "@/componentes/primitivos/campo";
import { EsqueletoTabela, Nota } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna, type Ordem } from "@/componentes/primitivos/tabela";
import { normalizar } from "@/componentes/primitivos/combo";
import { brlCompact, dataBR, num } from "@/lib/format";
import { faixaDe, type Faixa } from "@/lib/prod-escala";
import { useEstadoTela } from "@/hooks/use-estado-modulo";

/**
 * O que a tabela precisa de uma linha de carteira. O que ela CONTA muda por
 * módulo (lançamentos no Contábil, notas no Fiscal) e entra pelo acessor
 * `itens`, então nenhum dos dois renomeia o próprio campo para caber aqui.
 */
export interface LinhaCarteira {
  codigo: number;
  nome: string;
  ativa: boolean;
  valor: number;
  pessoas: number;
  principal: string | null;
  ultimo: string | null;
  diasParada: number | null;
}

type Recorte = "todas" | "atendidas" | "paradas";

const POR_PAGINA = 50;

/** Empresa que nunca teve movimento vai para o fim da escada sem fingir uma idade. */
const parada = (e: LinhaCarteira) => e.diasParada ?? Number.POSITIVE_INFINITY;

function comparar(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

/**
 * A carteira inteira numa tabela: o que teve movimento no período e,
 * sobretudo, o que não teve. O recorte "Sem movimento" é o motivo de a aba
 * existir: empresa parada não aparece em ranking nenhum, porque ranking só
 * lista quem produziu.
 *
 * Busca e recorte são leitura da lista que já veio (não voltam ao banco) e
 * sobrevivem à troca de seção. A carteira passa de mil empresas, então a lista
 * pagina de 50 em 50 depois de ordenar.
 */
export function TabelaCarteira<T extends LinhaCarteira>({
  linhas,
  itens,
  faixas,
  rotuloItem,
  rotuloPrincipal,
  carregando,
  onLinha,
  titulo = "Empresa por empresa",
  descricao = "Movimento no período e tempo desde o último de todos os tempos",
}: {
  linhas: T[] | undefined;
  /** Quantos itens do período a empresa teve (lançamentos, notas). */
  itens: (e: T) => number;
  /** Escada que colore a coluna "Parada há"; cada módulo tem a sua. */
  faixas: Faixa[];
  rotuloItem: string;
  rotuloPrincipal: string;
  carregando?: boolean;
  onLinha?: (e: T) => void;
  titulo?: ReactNode;
  descricao?: ReactNode;
}) {
  const [busca, setBusca] = useEstadoTela("carteira-busca", "");
  const [recorte, setRecorte] = useEstadoTela<Recorte>("carteira-recorte", "todas");
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "itens", sentido: "desc" });
  const [pagina, setPagina] = useState(1);

  const colunas = useMemo<Coluna<T>[]>(
    () => [
      {
        id: "codigo",
        cabecalho: "Código",
        largura: "76px",
        ordenar: (e) => e.codigo,
        classe: "num text-apagado",
        celula: (e) => e.codigo,
      },
      {
        id: "nome",
        cabecalho: "Empresa",
        // Em porcentagem para o nome truncar: sem largura, a razão social mais
        // longa alargava a tabela e empurrava Último e Parada há para fora da
        // vista, e essas são as colunas que a aba existe para mostrar.
        largura: "34%",
        ordenar: (e) => e.nome,
        celula: (e) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-tinta">{e.nome}</span>
            {!e.ativa && <Selo>Baixada</Selo>}
          </span>
        ),
      },
      {
        id: "itens",
        cabecalho: rotuloItem,
        alinhar: "dir",
        largura: "112px",
        ordenar: itens,
        celula: (e) => <span className={itens(e) === 0 ? "text-apagado" : "text-tinta"}>{num(itens(e))}</span>,
      },
      {
        id: "pessoas",
        cabecalho: "Pessoas",
        alinhar: "dir",
        largura: "80px",
        secundaria: true,
        ordenar: (e) => e.pessoas,
        celula: (e) => <span className={e.pessoas === 0 ? "text-apagado" : undefined}>{num(e.pessoas)}</span>,
      },
      {
        id: "principal",
        cabecalho: rotuloPrincipal,
        largura: "20%",
        secundaria: true,
        ordenar: (e) => e.principal ?? "",
        celula: (e) => <span className="block truncate">{e.principal ?? "—"}</span>,
      },
      {
        id: "valor",
        cabecalho: "Valor",
        alinhar: "dir",
        largura: "112px",
        ordenar: (e) => e.valor,
        celula: (e) => <span className={e.valor === 0 ? "text-apagado" : undefined}>{brlCompact(e.valor)}</span>,
      },
      {
        id: "ultimo",
        cabecalho: "Último",
        alinhar: "dir",
        largura: "104px",
        secundaria: true,
        ordenar: (e) => e.ultimo ?? "",
        celula: (e) => dataBR(e.ultimo),
      },
      {
        id: "parada",
        cabecalho: "Parada há",
        alinhar: "dir",
        largura: "112px",
        ordenar: parada,
        celula: (e) => (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: faixas[faixaDe(faixas, parada(e))]?.cor }}
            />
            {e.diasParada == null ? "nunca" : `${num(e.diasParada)} d`}
          </span>
        ),
      },
    ],
    [itens, faixas, rotuloItem, rotuloPrincipal]
  );

  const filtradas = useMemo(() => {
    const t = normalizar(busca.trim());
    const lista = (linhas ?? []).filter((e) => {
      if (recorte === "atendidas" && itens(e) === 0) return false;
      if (recorte === "paradas" && itens(e) > 0) return false;
      return !t || normalizar(`${e.nome} ${e.codigo}`).includes(t);
    });
    const col = colunas.find((c) => c.id === ordem?.coluna);
    if (!ordem || !col?.ordenar) return lista;
    const f = col.ordenar;
    const s = ordem.sentido === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => s * comparar(f(a) ?? "", f(b) ?? ""));
  }, [linhas, busca, recorte, itens, colunas, ordem]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      corpo="p-0"
      acoes={
        <>
          <Campo
            icone="buscar"
            placeholder="Empresa ou código"
            classeCaixa="w-56"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
          <Segmentado<Recorte>
            rotulo="Recorte da carteira"
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "atendidas", rotulo: "Atendidas" },
              { valor: "paradas", rotulo: "Sem movimento" },
            ]}
            valor={recorte}
            onMudar={(v) => {
              setRecorte(v);
              setPagina(1);
            }}
          />
        </>
      }
      rodape={
        carregando ? undefined : (
          <div className="flex flex-col gap-2">
            <Paginacao pagina={atual} porPagina={POR_PAGINA} total={filtradas.length} onPagina={setPagina} />
            <Nota>A coluna Parada há olha o histórico inteiro do Questor, não só o período.</Nota>
          </div>
        )
      }
    >
      {carregando ? (
        <EsqueletoTabela linhas={10} colunas={6} />
      ) : (
        <TabelaDados
          colunas={colunas}
          linhas={visiveis}
          chave={(e) => String(e.codigo)}
          ordem={ordem}
          onOrdem={(o) => {
            setOrdem(o ?? { coluna: "itens", sentido: "desc" });
            setPagina(1);
          }}
          onLinha={onLinha}
          rotulo="Carteira"
          vazio={
            <p className="py-10 text-center text-corpo text-apagado italic">
              {busca || recorte !== "todas"
                ? "Nenhuma empresa neste recorte. Limpe a busca ou volte para Todas."
                : "Nenhuma empresa na carteira do escopo."}
            </p>
          }
        />
      )}
    </Painel>
  );
}
