"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Nota } from "@/componentes/primitivos/estados";
import { AlternadorMetrica, FiltroEspecies, useEspecies, useMetrica } from "@/componentes/produto/fiscal/filtros";
import { ROTULO_LADO, type Lado } from "@/componentes/produto/fiscal/lado";
import { PainelRanking } from "@/componentes/produto/fiscal/painel-ranking";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { lerContexto } from "@/lib/contexto";
import { decimalBR } from "@/lib/csv";
import type { CfopResumo, EstadoResumo, Metrica, ProdutoTop, TopItem } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const ITENS = { singular: "item", plural: "itens" };

const deEntradaOuSaida = (lado: Lado) => (lado === "ent" ? "de entrada" : "de saída");

/** O que a barra mede, na frase da descrição do painel. */
const medida = (lado: Lado, metrica: Metrica) =>
  metrica === "valor"
    ? `Valor contábil ${lado === "ent" ? "das entradas" : "das saídas"}`
    : `Notas ${deEntradaOuSaida(lado)}`;

/**
 * Um ranking da tela: o lado escolhido (que sobrevive à troca de seção) e a
 * consulta dele. Trocar o lado não segura o dado anterior: o painel volta ao
 * esqueleto em vez de pintar as entradas com a cor das saídas.
 */
function useRanking<T>(
  id: string,
  inicial: Lado,
  url: (lado: Lado) => string | null
) {
  const [lado, setLado] = useEstadoTela<Lado>(`lado-${id}`, inicial);
  const consulta = useConsulta<T>(`fiscal-${id}`, url(lado), { manterAnterior: false });
  return {
    lado,
    setLado,
    dados: consulta.data,
    erro: consulta.error ? (consulta.error as Error).message : null,
    tentar: () => void consulta.refetch(),
  };
}

/**
 * Análises: nove rankings do período, cada um com o próprio lado. A métrica do
 * módulo decide o que a barra mede e, onde a rota ordena pela métrica, o que
 * entra no top. Estado e faixa de valor não ordenam no servidor: o estado é
 * reordenado aqui, e a faixa segue a ordem das faixas.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const { especies, comEspecies } = useEspecies();
  const [metrica] = useMetrica();

  // Uma empresa executada: o ranking de empresas teria uma linha só.
  const umaEmpresa = qs != null && lerContexto(new URLSearchParams(qs)).empresas.length === 1;
  const mostraEmpresas = !umaEmpresa;

  /**
   * A URL de uma rota de ranking. Produto e CFOP leem o item da nota, que não
   * guarda a espécie: a rota zera o filtro, e mandá-lo só refaria a consulta.
   */
  const url =
    (rota: string, { especie = true, comMetrica = true, ativo = true } = {}) =>
    (lado: Lado) =>
      qs == null || !ativo
        ? null
        : `/api/fiscal/${rota}?${especie ? comEspecies(qs) : qs}&tipo=${lado}${comMetrica ? `&metrica=${metrica}` : ""}`;

  const empresas = useRanking<TopItem[]>("top-empresas", "sai", url("top-empresas", { ativo: mostraEmpresas }));
  const pessoas = useRanking<TopItem[]>("top-pessoas", "ent", url("top-pessoas"));
  const produtos = useRanking<ProdutoTop[]>("produtos", "sai", url("produtos", { especie: false }));
  const cfops = useRanking<CfopResumo[]>("cfops", "sai", url("cfops", { especie: false }));
  const estados = useRanking<EstadoResumo[]>("estados", "sai", url("estados", { comMetrica: false }));
  const municipios = useRanking<TopItem[]>("municipios", "sai", url("municipios"));
  const frete = useRanking<TopItem[]>("frete", "sai", url("frete"));
  const faixas = useRanking<TopItem[]>("faixas-valor", "sai", url("faixas-valor", { comMetrica: false }));
  const origem = useRanking<TopItem[]>("origem", "sai", url("origem"));

  const itensProdutos = useMemo<TopItem[] | undefined>(
    () =>
      produtos.dados?.map((p) => ({
        codigo: p.codigoProduto,
        nome: p.descricao ?? `Produto ${p.codigoProduto}`,
        valor: p.valor,
        qtd: p.qtd,
        detalhe: [p.unidade ? `Unid. ${p.unidade}` : null, mostraEmpresas ? p.nomeEmpresa : null].filter(Boolean).join(" · ") || null,
      })),
    [produtos.dados, mostraEmpresas]
  );

  const itensCfops = useMemo<TopItem[] | undefined>(
    () =>
      cfops.dados?.map((c) => ({
        codigo: c.cfop,
        nome: `${c.cfop} · ${c.descricao ?? "Sem descrição"}`,
        valor: c.valor,
        qtd: c.itens,
        detalhe: null,
      })),
    [cfops.dados]
  );

  // A rota ordena por valor; a lista inteira fica, e o painel mostra as dez
  // primeiras na métrica escolhida.
  const itensEstados = useMemo<TopItem[] | undefined>(
    () =>
      estados.dados
        ?.map((e, i) => ({
          codigo: i,
          nome: e.uf === "—" ? "Sem UF" : e.uf,
          valor: e.valor,
          qtd: e.qtd,
          detalhe: e.nome,
        }))
        .sort((a, b) => (metrica === "valor" ? b.valor - a.valor : b.qtd - a.qtd)),
    [estados.dados, metrica]
  );

  // A rota devolve as seis faixas sempre, zeradas quando não há nota: seis
  // barras vazias não são um ranking, são o vazio.
  const itensFaixas = useMemo(
    () => faixas.dados && (faixas.dados.some((f) => f.qtd > 0) ? faixas.dados : []),
    [faixas.dados]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    const p = new URLSearchParams(qs ?? "");
    const sufixo = `${p.get("inicio")}_${p.get("fim")}`;
    const nomeLado = (l: Lado) => (l === "ent" ? "entradas" : "saidas");
    const corte = (
      id: string,
      rotulo: string,
      lado: Lado,
      itens: TopItem[] | undefined,
      colunas: { qtd: string; detalhe?: string }
    ): CorteExportar | null =>
      itens
        ? {
            id,
            rotulo: `${rotulo} (${ROTULO_LADO[lado].toLowerCase()})`,
            nome: `analises-fiscal-${id}-${nomeLado(lado)}-${sufixo}`,
            montar: () => ({
              cabecalhos: ["Posição", "Nome", ...(colunas.detalhe ? [colunas.detalhe] : []), "Valor", colunas.qtd],
              linhas: itens.map((i, k) => [
                k + 1,
                i.nome,
                ...(colunas.detalhe ? [i.detalhe ?? ""] : []),
                decimalBR(i.valor),
                Number.isInteger(i.qtd) ? i.qtd : decimalBR(i.qtd),
              ]),
            }),
          }
        : null;
    return [
      mostraEmpresas ? corte("empresas", "Empresas", empresas.lado, empresas.dados, { qtd: "Notas" }) : null,
      corte(
        "pessoas",
        pessoas.lado === "ent" ? "Fornecedores" : "Clientes",
        pessoas.lado,
        pessoas.dados,
        { qtd: "Notas" }
      ),
      corte("produtos", "Produtos", produtos.lado, itensProdutos, { qtd: "Quantidade", detalhe: "Unidade e empresa" }),
      corte("cfops", "CFOPs", cfops.lado, itensCfops, { qtd: "Itens" }),
      corte("estados", "Estados", estados.lado, itensEstados, { qtd: "Notas", detalhe: "Estado" }),
      corte("municipios", "Municípios", municipios.lado, municipios.dados, { qtd: "Notas", detalhe: "UF" }),
      corte("frete", "Modalidade de frete", frete.lado, frete.dados, { qtd: "Notas" }),
      corte("faixas", "Faixas de valor", faixas.lado, faixas.dados, { qtd: "Notas" }),
      corte("origem", "Origem do dado", origem.lado, origem.dados, { qtd: "Notas" }),
    ].filter((c): c is CorteExportar => c != null);
  }, [
    qs, mostraEmpresas, empresas.lado, empresas.dados, pessoas.lado, pessoas.dados, produtos.lado, itensProdutos,
    cfops.lado, itensCfops, estados.lado, itensEstados, municipios.lado, municipios.dados, frete.lado, frete.dados,
    faixas.lado, faixas.dados, origem.lado, origem.dados,
  ]);

  const somaTodas = especies.length > 0 ? <Nota>Soma todas as espécies.</Nota> : undefined;

  return (
    <>
      <AcoesPagina>
        <FiltroEspecies />
        <AlternadorMetrica />
        <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={cortes.length === 0} />
      </AcoesPagina>

      {/* Com o ranking de empresas escondido sobram oito painéis e a grade
          fecha par; com ele são nove, e o último ocupa a linha inteira. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {mostraEmpresas && (
          <PainelRanking
            titulo="Empresas com Mais Movimento"
            descricao={medida(empresas.lado, metrica)}
            itens={empresas.dados}
            metrica={metrica}
            lado={empresas.lado}
            onLado={empresas.setLado}
            carregando={!empresas.dados}
            erro={empresas.erro}
            onTentar={empresas.tentar}
            rotuloMedio="Ticket médio"
          />
        )}
        <PainelRanking
          titulo={pessoas.lado === "ent" ? "Maiores Fornecedores" : "Maiores Clientes"}
          descricao={medida(pessoas.lado, metrica)}
          itens={pessoas.dados}
          metrica={metrica}
          lado={pessoas.lado}
          onLado={pessoas.setLado}
          carregando={!pessoas.dados}
          erro={pessoas.erro}
          onTentar={pessoas.tentar}
          rotuloMedio="Ticket médio"
        />
        <PainelRanking
          titulo="Produtos Mais Movimentados"
          descricao={
            metrica === "valor"
              ? `Valor dos itens ${produtos.lado === "ent" ? "comprados" : "vendidos"}`
              : `Quantidade ${produtos.lado === "ent" ? "comprada" : "vendida"}, na unidade de cada produto`
          }
          itens={itensProdutos}
          metrica={metrica}
          lado={produtos.lado}
          onLado={produtos.setLado}
          carregando={!produtos.dados}
          erro={produtos.erro}
          onTentar={produtos.tentar}
          rotuloValor="Valor dos itens"
          rotuloQtd="Quantidade"
          qtdFisica
          rotuloMedio="Valor médio por unidade"
          rodape={somaTodas}
        />
        <PainelRanking
          titulo="CFOPs Mais Usados"
          descricao={metrica === "valor" ? `Valor dos itens ${deEntradaOuSaida(cfops.lado)}` : `Itens ${deEntradaOuSaida(cfops.lado)}`}
          itens={itensCfops}
          metrica={metrica}
          lado={cfops.lado}
          onLado={cfops.setLado}
          carregando={!cfops.dados}
          erro={cfops.erro}
          onTentar={cfops.tentar}
          rotuloValor="Valor dos itens"
          rotuloQtd="Itens"
          contagem={ITENS}
          rotuloMedio="Valor médio por item"
          rodape={somaTodas}
        />
        <PainelRanking
          titulo="Por Estado da Contraparte"
          descricao={estados.lado === "ent" ? "Origem dos fornecedores nas entradas" : "Destino dos clientes nas saídas"}
          itens={itensEstados}
          metrica={metrica}
          lado={estados.lado}
          onLado={estados.setLado}
          carregando={!estados.dados}
          erro={estados.erro}
          onTentar={estados.tentar}
          rotuloMedio="Ticket médio"
          completa
          limite={10}
          rodape={<Nota>UF do cadastro da contraparte.</Nota>}
        />
        <PainelRanking
          titulo="Municípios da Contraparte"
          descricao={medida(municipios.lado, metrica)}
          itens={municipios.dados}
          metrica={metrica}
          lado={municipios.lado}
          onLado={municipios.setLado}
          carregando={!municipios.dados}
          erro={municipios.erro}
          onTentar={municipios.tentar}
          rotuloMedio="Ticket médio"
        />
        <PainelRanking
          titulo="Modalidade de Frete"
          descricao={medida(frete.lado, metrica)}
          itens={frete.dados}
          metrica={metrica}
          lado={frete.lado}
          onLado={frete.setLado}
          carregando={!frete.dados}
          erro={frete.erro}
          onTentar={frete.tentar}
          rotuloMedio="Ticket médio"
          completa
        />
        <PainelRanking
          titulo="Notas por Faixa de Valor"
          descricao={`${medida(faixas.lado, metrica)} em cada faixa`}
          itens={itensFaixas}
          metrica={metrica}
          lado={faixas.lado}
          onLado={faixas.setLado}
          carregando={!faixas.dados}
          erro={faixas.erro}
          onTentar={faixas.tentar}
          rotuloMedio="Ticket médio"
          ordinal
          completa
        />
        <PainelRanking
          className={mostraEmpresas ? "xl:col-span-2" : undefined}
          titulo="Origem do Dado"
          descricao={medida(origem.lado, metrica)}
          itens={origem.dados}
          metrica={metrica}
          lado={origem.lado}
          onLado={origem.setLado}
          carregando={!origem.dados}
          erro={origem.erro}
          onTentar={origem.tentar}
          rotuloMedio="Ticket médio"
          completa
        />
      </div>
    </>
  );
}
