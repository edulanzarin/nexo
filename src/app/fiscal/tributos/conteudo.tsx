"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { BarraProporcao } from "@/componentes/primitivos/barra";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  ComposicaoImpostos,
  somaDestacados,
  TODOS_IMPOSTOS,
} from "@/componentes/produto/fiscal/composicao-impostos";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { ROTULO_LADO, type Lado } from "@/componentes/produto/fiscal/lado";
import { PainelRanking } from "@/componentes/produto/fiscal/painel-ranking";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, num, pct } from "@/lib/format";
import type { Impostos, TopItem, TributosCargaEmpresa } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const ITENS = { singular: "item", plural: "itens" };

const razao = (parte: number, base: number) => (base > 0 ? (parte / base) * 100 : null);

interface LinhaCarga extends TributosCargaEmpresa {
  /** Posição no ranking da rota (por tributo), que a ordenação da tabela não muda. */
  posicao: number;
}

/**
 * Tributos: quanto imposto as saídas destacaram, a carga sobre o faturado, o
 * DIFAL por UF de destino, o regime de PIS/COFINS e a carga de cada empresa.
 * A faixa lê sempre as saídas; a composição tem o próprio lado.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const { especies } = useEspecies();
  const [lado, setLado] = useEstadoTela<Lado>("impostos", "sai");

  // Nenhuma rota daqui recorta por espécie: o imposto mora no item da nota, e o
  // item não guarda a espécie. A URL vai sem ela (trocar a espécie não refaz a
  // consulta) e o filtro aparece travado, com a nota dizendo o que vale.
  const url = (rota: string, extra = "") => (qs == null ? null : `/api/fiscal/${rota}?${qs}${extra}`);

  // A faixa e a composição nas saídas são a mesma consulta: a chave igual faz
  // o cache servir as duas com uma ida só.
  const saidas = useConsulta<Impostos>("fiscal-impostos", url("impostos", "&tipo=sai"));
  const composicao = useConsulta<Impostos>("fiscal-impostos", url("impostos", `&tipo=${lado}`), {
    manterAnterior: false,
  });
  const difal = useConsulta<TopItem[]>("fiscal-tributos-difal", url("tributos-difal"));
  const cst = useConsulta<TopItem[]>("fiscal-tributos-cst", url("tributos-cst"));
  const carga = useConsulta<TributosCargaEmpresa[]>("fiscal-tributos-carga-empresas", url("tributos-carga-empresas"));

  const d = saidas.data;
  const destacados = d ? somaDestacados(d) : 0;
  const faturado = d?.totalItens ?? 0;

  const linhasCarga = useMemo<LinhaCarga[] | undefined>(
    () => carga.data?.map((e, i) => ({ ...e, posicao: i + 1 })),
    [carga.data]
  );

  const colunasCarga = useMemo<Coluna<LinhaCarga>[]>(() => {
    const linhas = linhasCarga ?? [];
    const maior = Math.max(0, ...linhas.map((l) => l.carga));
    const fat = linhas.reduce((s, l) => s + l.faturamento, 0);
    const trib = linhas.reduce((s, l) => s + l.tributos, 0);
    return [
      { id: "posicao", cabecalho: "#", alinhar: "dir", largura: "44px", celula: (l) => l.posicao, classe: "text-apagado" },
      {
        id: "empresa",
        cabecalho: "Empresa",
        largura: "46%",
        ordenar: (l) => l.nome,
        celula: (l) => (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-[560] text-tinta" title={l.nome}>
              {l.nome}
            </span>
            <span className="num shrink-0 text-pequeno text-apagado">{l.codigo}</span>
          </span>
        ),
        rodape: `Total das ${num(linhas.length)}`,
      },
      {
        id: "faturamento",
        cabecalho: "Faturamento",
        alinhar: "dir",
        ordenar: (l) => l.faturamento,
        celula: (l) => <span title={brl(l.faturamento)}>{brlCompact(l.faturamento)}</span>,
        rodape: <span title={brl(fat)}>{brlCompact(fat)}</span>,
      },
      {
        id: "tributos",
        cabecalho: "Tributos",
        alinhar: "dir",
        ordenar: (l) => l.tributos,
        celula: (l) => <span title={brl(l.tributos)}>{brlCompact(l.tributos)}</span>,
        rodape: <span title={brl(trib)}>{brlCompact(trib)}</span>,
      },
      {
        id: "carga",
        cabecalho: "Carga",
        alinhar: "dir",
        largura: "150px",
        ordenar: (l) => l.carga,
        celula: (l) => (
          <span className="flex items-center justify-end gap-2">
            <BarraProporcao
              className="hidden w-16 sm:block"
              valor={maior > 0 ? l.carga / maior : 0}
              cor="var(--serie-4)"
              rotulo={`Carga de ${l.nome}`}
            />
            <span className="w-12 font-[600] text-tinta">{pct(l.carga)}</span>
          </span>
        ),
        rodape: pct(razao(trib, fat)),
      },
    ];
  }, [linhasCarga]);

  const cortes = useMemo<CorteExportar[]>(() => {
    const p = new URLSearchParams(qs ?? "");
    const sufixo = `${p.get("inicio")}_${p.get("fim")}`;
    const lista: CorteExportar[] = [];
    const impostos = composicao.data;
    if (impostos)
      lista.push({
        id: "impostos",
        rotulo: `Impostos das ${ROTULO_LADO[lado].toLowerCase()}`,
        nome: `tributos-fiscal-impostos-${lado === "ent" ? "entradas" : "saidas"}-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Imposto", "Valor", "% do valor dos itens"],
          linhas: [
            ...TODOS_IMPOSTOS.map((i) => [
              i.rotulo,
              decimalBR(impostos[i.chave]),
              decimalBR(razao(impostos[i.chave], impostos.totalItens)),
            ]),
            ["Valor dos itens", decimalBR(impostos.totalItens), ""],
          ],
        }),
      });
    if (difal.data) {
      const linhas = difal.data;
      lista.push({
        id: "difal",
        rotulo: "DIFAL e FCP por UF",
        nome: `tributos-fiscal-difal-${sufixo}`,
        montar: () => ({
          cabecalhos: ["UF de destino", "Estado", "DIFAL e FCP", "Notas"],
          linhas: linhas.map((i) => [i.nome, i.detalhe ?? "", decimalBR(i.valor), i.qtd]),
        }),
      });
    }
    if (cst.data) {
      const linhas = cst.data;
      lista.push({
        id: "cst",
        rotulo: "Regime de PIS e COFINS",
        nome: `tributos-fiscal-cst-${sufixo}`,
        montar: () => ({
          cabecalhos: ["CST", "Itens", "PIS"],
          linhas: linhas.map((i) => [i.nome, i.qtd, decimalBR(i.valor)]),
        }),
      });
    }
    if (linhasCarga)
      lista.push({
        id: "carga",
        rotulo: "Carga por empresa",
        nome: `tributos-fiscal-carga-empresas-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Posição", "Código", "Empresa", "Faturamento", "Tributos", "Carga (%)"],
          linhas: linhasCarga.map((l) => [
            l.posicao, l.codigo, l.nome, decimalBR(l.faturamento), decimalBR(l.tributos), decimalBR(l.carga),
          ]),
        }),
      });
    return lista;
  }, [qs, composicao.data, lado, difal.data, cst.data, linhasCarga]);

  return (
    <>
      <AcoesPagina>
        <FiltroEspecies desabilitado />
        <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={cortes.length === 0} />
      </AcoesPagina>

      {saidas.error ? (
        <PainelErro
          titulo="Não deu para carregar os tributos"
          mensagem={(saidas.error as Error).message}
          onTentar={() => saidas.refetch()}
        />
      ) : (
        <FaixaIndicadores colunas={4}>
          <Indicador
            rotulo="Tributos destacados"
            icone="moedas"
            carregando={!d}
            valor={<span title={brl(destacados)}>{brlCompact(destacados)}</span>}
            detalhe="ICMS, ST, IPI, ISS, PIS e COFINS das saídas"
          />
          <Indicador
            rotulo="Carga tributária"
            icone="balanca"
            carregando={!d}
            valor={pct(razao(destacados, faturado))}
            detalhe={`Sobre ${brlCompact(faturado)} faturados`}
          />
          <Indicador
            rotulo="DIFAL e FCP"
            icone="frete"
            carregando={!d}
            valor={<span title={brl((d?.difal ?? 0) + (d?.fcp ?? 0))}>{brlCompact((d?.difal ?? 0) + (d?.fcp ?? 0))}</span>}
            detalhe="A recolher nas saídas interestaduais"
          />
          <Indicador
            rotulo="ICMS"
            icone="banco"
            carregando={!d}
            valor={<span title={brl(d?.icms ?? 0)}>{brlCompact(d?.icms ?? 0)}</span>}
            detalhe={`${pct(razao(d?.icms ?? 0, faturado))} do faturado`}
          />
        </FaixaIndicadores>
      )}

      {especies.length > 0 && <Nota>Tributos somam todas as espécies.</Nota>}

      <ComposicaoImpostos
        titulo="Composição dos Impostos"
        dados={composicao.data}
        lado={lado}
        onLado={setLado}
        carregando={!composicao.data}
        erro={composicao.error ? (composicao.error as Error).message : null}
        onTentar={() => composicao.refetch()}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelRanking
          titulo="DIFAL e FCP por UF de Destino"
          descricao="A recolher nas saídas interestaduais"
          itens={difal.data}
          metrica="valor"
          lado="sai"
          carregando={!difal.data}
          erro={difal.error ? (difal.error as Error).message : null}
          onTentar={() => difal.refetch()}
          rotuloValor="DIFAL e FCP"
          vazio="Nenhuma saída interestadual com DIFAL no recorte."
        />
        <PainelRanking
          titulo="Regime de PIS e COFINS"
          descricao="Itens de saída por CST de PIS/COFINS"
          itens={cst.data}
          metrica="qtd"
          lado="sai"
          carregando={!cst.data}
          erro={cst.error ? (cst.error as Error).message : null}
          onTentar={() => cst.refetch()}
          rotuloValor="PIS"
          rotuloQtd="Itens"
          contagem={ITENS}
          detalhe={(i) => `${brlCompact(i.valor)} de PIS`}
          completa
          vazio="Nenhum item de saída com PIS/COFINS no recorte."
        />
      </div>

      <Painel
        titulo="Carga Tributária por Empresa"
        descricao="Empresas com mais tributo destacado nas saídas"
        corpo="p-0"
        rodape={<Nota>Carga da empresa sem PIS e COFINS: ICMS, IPI, ST e ISS sobre o valor dos itens de saída.</Nota>}
      >
        {carga.error ? (
          <div className="p-4">
            <PainelErro mensagem={(carga.error as Error).message} onTentar={() => carga.refetch()} />
          </div>
        ) : !linhasCarga ? (
          <EsqueletoTabela colunas={5} />
        ) : (
          <TabelaDados
            colunas={colunasCarga}
            linhas={linhasCarga}
            chave={(l) => String(l.codigo)}
            rotulo="Carga tributária por empresa"
            vazio={
              <Vazio
                compacto
                icone="moedas"
                titulo="Nenhuma empresa com faturamento de saída"
                descricao="Amplie o período ou tire o filtro de empresa no topo."
              />
            }
          />
        )}
      </Painel>
    </>
  );
}
