"use client";

import { useMemo, useState } from "react";
import { BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { brl, decimal, num } from "@/lib/format";
import type { NotaItem } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import type { ModuloNotas } from "./bloco-detalhe";

/**
 * Os itens (produtos) de uma nota, com filtro de produto e a soma de total,
 * ICMS e IPI. A soma respeita o filtro: filtrar por produto soma só o que
 * ficou à vista, que é a pergunta de quem filtra ("quanto deu de ICMS nesse
 * item?").
 */
export function TabelaItensNota({ itens }: { itens: NotaItem[] }) {
  const [filtro, setFiltro] = useState("");

  const filtrados = useMemo(() => {
    const q = normalizar(filtro.trim());
    if (!q) return itens;
    return itens.filter((it) => String(it.produto).includes(q) || normalizar(it.descricao ?? "").includes(q));
  }, [itens, filtro]);

  const totais = useMemo(
    () =>
      filtrados.reduce(
        (a, it) => ({ total: a.total + it.valorTotal, icms: a.icms + it.icms, ipi: a.ipi + it.ipi }),
        { total: 0, icms: 0, ipi: 0 }
      ),
    [filtrados]
  );
  const filtrando = filtrados.length !== itens.length;

  const colunas = useMemo<Coluna<NotaItem>[]>(
    () => [
      {
        id: "produto",
        classe: "max-w-0",
        cabecalho: "Produto",
        ordenar: (it) => it.descricao,
        celula: (it) => (
          <span className="block truncate" title={it.descricao ?? undefined}>
            <span className="num text-apagado">{it.produto}</span> {it.descricao ?? "Sem descrição"}
          </span>
        ),
        rodape: filtrando ? "Soma do filtro" : "Soma",
      },
      {
        id: "cfop",
        cabecalho: "CFOP",
        largura: "72px",
        ordenar: (it) => it.cfop,
        celula: (it) => (
          <span className="num text-apagado" title={it.cfopDescr ?? undefined}>
            {it.cfop}
          </span>
        ),
      },
      {
        id: "qtd",
        cabecalho: "Qtd",
        alinhar: "dir",
        largura: "110px",
        ordenar: (it) => it.quantidade,
        // Quantidade física (KG, UN): pode ter casa decimal.
        celula: (it) => (
          <>
            {decimal(it.quantidade, 2)}
            {it.unidade && <span className="text-apagado"> {it.unidade}</span>}
          </>
        ),
      },
      {
        id: "unitario",
        cabecalho: "V. unit.",
        alinhar: "dir",
        largura: "120px",
        secundaria: true,
        ordenar: (it) => it.valorUnitario,
        celula: (it) => brl(it.valorUnitario),
      },
      {
        id: "total",
        cabecalho: "Total",
        alinhar: "dir",
        largura: "130px",
        ordenar: (it) => it.valorTotal,
        classe: "font-[600] text-tinta",
        celula: (it) => brl(it.valorTotal),
        rodape: brl(totais.total),
      },
      {
        id: "icms",
        cabecalho: "ICMS",
        alinhar: "dir",
        largura: "110px",
        ordenar: (it) => it.icms,
        celula: (it) => brl(it.icms),
        rodape: brl(totais.icms),
      },
      {
        id: "ipi",
        cabecalho: "IPI",
        alinhar: "dir",
        largura: "110px",
        ordenar: (it) => it.ipi,
        celula: (it) => brl(it.ipi),
        rodape: brl(totais.ipi),
      },
    ],
    [filtrando, totais]
  );

  if (itens.length === 0)
    return <Vazio compacto icone="nota" titulo="Sem itens de produto nesta nota" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num text-pequeno text-apagado">
          {filtrando
            ? `${num(filtrados.length)} de ${num(itens.length)} itens`
            : `${num(itens.length)} ${itens.length === 1 ? "item" : "itens"}`}
        </p>
        <Campo
          icone="buscar"
          placeholder="Filtrar produto"
          classeCaixa="w-60"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          fim={
            filtro ? <BotaoIcone icone="fechar" rotulo="Limpar filtro" linha onClick={() => setFiltro("")} /> : undefined
          }
        />
      </div>
      <div className="overflow-hidden rounded-controle border border-linha">
        <TabelaDados
          rotulo="Itens da nota"
          colunas={colunas}
          linhas={filtrados}
          chave={(it) => String(it.seq)}
          vazio={<p className="py-6 text-center text-corpo text-apagado italic">Nenhum item com esse filtro.</p>}
        />
      </div>
    </div>
  );
}

/**
 * Os itens buscados sob demanda, pela rota do módulo que serve a tela. Abrir a
 * nota é o que dispara a consulta, e a rota registra a abertura na trilha.
 */
export function ItensNota({
  modulo,
  tipo,
  empresa,
  chave,
}: {
  modulo: ModuloNotas;
  tipo: "ent" | "sai";
  empresa: number;
  chave: string;
}) {
  const url = `/api/${modulo}/nota-itens?${new URLSearchParams({ tipo, empresa: String(empresa), chave })}`;
  // Sem manter o anterior: trocar de nota com o dado da nota de antes na tela
  // mostraria os produtos de outra nota enquanto carrega.
  const itens = useConsulta<NotaItem[]>("nota-itens", url, { manterAnterior: false, staleTime: 5 * 60_000 });

  if (itens.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar os itens"
        mensagem={(itens.error as Error).message}
        onTentar={() => itens.refetch()}
      />
    );
  if (itens.isLoading || !itens.data)
    return (
      <div className="overflow-hidden rounded-controle border border-linha">
        <EsqueletoTabela linhas={3} colunas={6} />
      </div>
    );
  return <TabelaItensNota itens={itens.data} />;
}
