"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import {
  agruparEspecies,
  ComposicaoEspecies,
  medirEspecie,
} from "@/componentes/produto/fiscal/composicao-especies";
import { ComposicaoImpostos, TODOS_IMPOSTOS } from "@/componentes/produto/fiscal/composicao-impostos";
import { AlternadorMetrica, FiltroEspecies, useEspecies, useMetrica } from "@/componentes/produto/fiscal/filtros";
import { COR_LADO, ROTULO_LADO, type Lado } from "@/componentes/produto/fiscal/lado";
import { CaixaGrafico, GraficoSerie, Legenda } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { nomeGranularidade, rotuloBucket, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataBR, deltaPct, num, pct } from "@/lib/format";
import type {
  CancelamentosResumo,
  DevolucoesResumo,
  EspecieResumo,
  Impostos,
  LadoResumo,
  Overview,
  Timeseries,
} from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { DetalheMovimento } from "./detalhe-movimento";

const notas = (n: number) => `${num(n)} ${n === 1 ? "nota" : "notas"}`;

/** Parte sobre o todo em pontos percentuais; sem todo, sem porcentagem. */
const razao = (parte: number, base: number) => (base > 0 ? (parte / base) * 100 : null);

/**
 * Painel do Fiscal: o movimento do período numa faixa (entradas, saídas,
 * empresas, devoluções e canceladas), a série, a composição por espécie e os
 * impostos. A métrica do módulo (valor ou quantidade) troca o número grande da
 * faixa, a série e a espécie sem ir ao servidor: as rotas já devolvem as duas.
 *
 * Cada bloco é uma consulta própria. Se uma falha, o erro fica no lugar dela e
 * o resto da tela continua de pé.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const { especies, comEspecies } = useEspecies();
  const [metrica] = useMetrica();
  const [ladoImpostos, setLadoImpostos] = useEstadoTela<Lado>("impostos", "sai");
  const [detalheAberto, setDetalheAberto] = useState(false);

  // Impostos e devoluções somam o ITEM da nota, que não guarda a espécie: a
  // rota zera o filtro. Mandar a espécie ali só refaria a mesma consulta a cada
  // troca, então essas duas vão sem ela (e a tela avisa, na nota).
  const url = (rota: string, { especie = true, extra = "" } = {}) =>
    qs == null ? null : `/api/fiscal/${rota}?${especie ? comEspecies(qs) : qs}${extra}`;

  const overview = useConsulta<Overview>("fiscal-overview", url("overview"));
  const serie = useConsulta<Timeseries>("fiscal-timeseries", url("timeseries"));
  const esp = useConsulta<EspecieResumo[]>("fiscal-especies", url("especies"));
  const devol = useConsulta<DevolucoesResumo>("fiscal-devolucoes-resumo", url("devolucoes-resumo", { especie: false }));
  const cancel = useConsulta<CancelamentosResumo>("fiscal-cancelamentos-resumo", url("cancelamentos-resumo"));
  // Trocar o lado mostra o esqueleto em vez do lado anterior pintado com o
  // rótulo novo.
  const impostos = useConsulta<Impostos>(
    "fiscal-impostos",
    url("impostos", { especie: false, extra: `&tipo=${ladoImpostos}` }),
    { manterAnterior: false }
  );

  const o = overview.data;
  const dv = devol.data;
  const cc = cancel.data;
  const g = serie.data?.granularidade ?? "dia";
  const p = new URLSearchParams(qs ?? "");
  const inicio = p.get("inicio") ?? "";
  const fim = p.get("fim") ?? "";

  const pontos = useMemo(
    () => (serie.data?.pontos ?? []).map((pt) => ({ ...pt, rotulo: rotuloBucket(pt.bucket, g) })),
    [serie.data, g]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    const sufixo = `${inicio}_${fim}`;
    const lista: CorteExportar[] = [];
    if (o && dv && cc)
      lista.push({
        id: "resumo",
        rotulo: "Resumo do movimento",
        nome: `painel-fiscal-resumo-${sufixo}`,
        montar: () => ({
          cabecalhos: [
            "Lado", "Valor contábil", "Notas", "Ticket médio", "Valor no período anterior", "Notas no período anterior",
            "Canceladas", "Notas lançadas", "Devolvido", "Notas com devolução",
          ],
          linhas: (["ent", "sai"] as Lado[]).map((l) => {
            const r = l === "ent" ? o.entradas : o.saidas;
            return [
              ROTULO_LADO[l], decimalBR(r.valor), r.qtd, decimalBR(r.qtd > 0 ? r.valor / r.qtd : 0),
              decimalBR(r.valorAnterior), r.qtdAnterior, cc[l].canceladas, cc[l].total, decimalBR(dv[l].valor), dv[l].qtd,
            ];
          }),
        }),
      });
    if (serie.data)
      lista.push({
        id: "evolucao",
        rotulo: "Evolução no período",
        nome: `painel-fiscal-evolucao-${sufixo}`,
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Entradas (valor)", "Saídas (valor)", "Notas de entrada", "Notas de saída"],
          linhas: serie.data.pontos.map((pt) => [
            rotuloBucketLongo(pt.bucket, g), decimalBR(pt.entradas), decimalBR(pt.saidas), pt.qtdEntradas, pt.qtdSaidas,
          ]),
        }),
      });
    if (esp.data)
      lista.push({
        id: "especies",
        rotulo: "Por espécie",
        nome: `painel-fiscal-especies-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Espécie", "Entradas (valor)", "Saídas (valor)", "Notas"],
          linhas: agruparEspecies(esp.data)
            .sort((a, b) => medirEspecie(b, metrica) - medirEspecie(a, metrica))
            .map((e) => [e.rotulo, decimalBR(e.entradas), decimalBR(e.saidas), e.qtd]),
        }),
      });
    if (impostos.data)
      lista.push({
        id: "impostos",
        rotulo: `Impostos das ${ROTULO_LADO[ladoImpostos].toLowerCase()}`,
        nome: `painel-fiscal-impostos-${ladoImpostos === "ent" ? "entradas" : "saidas"}-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Imposto", "Valor", "% do valor dos itens"],
          linhas: [
            ...TODOS_IMPOSTOS.map((i) => [
              i.rotulo,
              decimalBR(impostos.data[i.chave]),
              decimalBR(razao(impostos.data[i.chave], impostos.data.totalItens)),
            ]),
            ["Valor dos itens", decimalBR(impostos.data.totalItens), ""],
          ],
        }),
      });
    return lista;
  }, [o, dv, cc, serie.data, esp.data, impostos.data, g, metrica, ladoImpostos, inicio, fim]);

  const acoes = (
    <AcoesPagina>
      <FiltroEspecies />
      <AlternadorMetrica />
      <MenuExportar modulo="fiscal" cortes={cortes} imprimir="painel fiscal" desabilitado={!o} />
    </AcoesPagina>
  );

  if (o && o.entradas.qtd + o.saidas.qtd + o.entradas.canceladas + o.saidas.canceladas === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="nota"
            titulo="Nenhuma nota no recorte"
            descricao={
              especies.length
                ? "Tire o filtro de espécie, amplie o período ou afrouxe a empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  const erroFaixa = overview.error ?? devol.error ?? cancel.error;
  const tentarFaixa = () => {
    if (overview.error) overview.refetch();
    if (devol.error) devol.refetch();
    if (cancel.error) cancel.refetch();
  };
  const faixaPronta = !!(o && dv && cc);
  const abrir = faixaPronta ? () => setDetalheAberto(true) : undefined;

  /** A métrica escolhida é o número grande; a outra vai para o detalhe. */
  const lado = (r: LadoResumo | undefined) => {
    if (!r) return { valor: "—", detalhe: null };
    const [atual, anterior] = metrica === "valor" ? [r.valor, r.valorAnterior] : [r.qtd, r.qtdAnterior];
    const apoio = metrica === "valor" ? notas(r.qtd) : brlCompact(r.valor);
    return {
      valor: metrica === "valor" ? <span title={brl(r.valor)}>{brlCompact(r.valor)}</span> : num(r.qtd),
      detalhe: (
        <>
          {deltaPct(atual, anterior) != null && (
            <>
              <Variacao atual={atual} anterior={anterior} />
              {" · "}
            </>
          )}
          {apoio}
        </>
      ),
    };
  };
  const ent = lado(o?.entradas);
  const sai = lado(o?.saidas);

  const valorDevol = dv ? dv.ent.valor + dv.sai.valor : 0;
  const qtdDevol = dv ? dv.ent.qtd + dv.sai.qtd : 0;
  const pesoDevol = dv ? pct(razao(valorDevol, dv.faturamentoEnt + dv.faturamentoSai)) : "—";
  const canceladas = cc ? cc.ent.canceladas + cc.sai.canceladas : 0;
  const lancadas = cc ? cc.ent.total + cc.sai.total : 0;

  return (
    <>
      {acoes}

      {erroFaixa ? (
        <PainelErro
          titulo="Não deu para carregar o movimento"
          mensagem={(erroFaixa as Error).message}
          onTentar={tentarFaixa}
        />
      ) : (
        <FaixaIndicadores colunas={5}>
          <Indicador
            rotulo="Notas de entrada"
            icone="tendencia-baixa"
            carregando={!o}
            valor={ent.valor}
            detalhe={ent.detalhe}
            onClick={abrir}
          />
          <Indicador
            rotulo="Notas de saída"
            icone="tendencia"
            carregando={!o}
            valor={sai.valor}
            detalhe={sai.detalhe}
            onClick={abrir}
          />
          <Indicador
            rotulo="Empresas com movimento"
            icone="empresa"
            carregando={!o}
            valor={num(o?.empresasAtivas ?? 0)}
            detalhe={
              o && (
                <>
                  {deltaPct(o.empresasAtivas, o.empresasAtivasAnterior) != null && (
                    <>
                      <Variacao atual={o.empresasAtivas} anterior={o.empresasAtivasAnterior} />
                      {" · "}
                    </>
                  )}
                  com ao menos uma nota
                </>
              )
            }
          />
          <Indicador
            rotulo="Devoluções"
            icone="desfazer"
            carregando={!dv}
            valor={metrica === "valor" ? <span title={brl(valorDevol)}>{brlCompact(valorDevol)}</span> : num(qtdDevol)}
            detalhe={`${metrica === "valor" ? notas(qtdDevol) : brlCompact(valorDevol)} · ${pesoDevol} do movimento`}
            onClick={abrir}
          />
          <Indicador
            rotulo="Notas canceladas"
            icone="bloqueado"
            carregando={!cc}
            valor={num(canceladas)}
            detalhe={`${pct(razao(canceladas, lancadas), 2)} das notas lançadas`}
            onClick={abrir}
          />
        </FaixaIndicadores>
      )}

      <div className="flex flex-col gap-1">
        <Nota>Entradas e saídas sem as canceladas. Devolução é o item com CFOP de devolução.</Nota>
        {especies.length > 0 && <Nota>Impostos e devoluções somam todas as espécies.</Nota>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {serie.error ? (
          <div className="xl:col-span-2">
            <PainelErro
              titulo="Não deu para carregar a evolução"
              mensagem={(serie.error as Error).message}
              onTentar={() => serie.refetch()}
            />
          </div>
        ) : (
          <CaixaGrafico
            className="xl:col-span-2"
            titulo="Evolução no Período"
            descricao={`${metrica === "valor" ? "Valor contábil" : "Notas"} por ${nomeGranularidade(g)}`}
            legenda={
              <Legenda
                itens={[
                  { rotulo: ROTULO_LADO.ent, cor: COR_LADO.ent },
                  { rotulo: ROTULO_LADO.sai, cor: COR_LADO.sai },
                ]}
              />
            }
            carregando={!serie.data}
            vazio={serie.data && serie.data.pontos.length === 0 ? "Nenhuma nota no período." : false}
            altura={280}
          >
            <GraficoSerie
              dados={pontos}
              x="rotulo"
              series={[
                {
                  chave: metrica === "valor" ? "entradas" : "qtdEntradas",
                  rotulo: ROTULO_LADO.ent,
                  cor: COR_LADO.ent,
                  tipo: "area",
                },
                {
                  chave: metrica === "valor" ? "saidas" : "qtdSaidas",
                  rotulo: ROTULO_LADO.sai,
                  cor: COR_LADO.sai,
                  tipo: "area",
                },
              ]}
              formatar={(v) => (metrica === "valor" ? brl(v) : notas(v))}
              // A dica leva a outra métrica embaixo da data: quem olha o valor
              // de um dia quase sempre pergunta quantas notas foram.
              tituloDica={(pt) => (
                <>
                  {rotuloBucketLongo(pt.bucket, g)}
                  <span className="block font-[400] text-apagado">
                    {metrica === "valor"
                      ? `${notas(pt.qtdEntradas)} de entrada · ${num(pt.qtdSaidas)} de saída`
                      : `${brlCompact(pt.entradas)} em entradas · ${brlCompact(pt.saidas)} em saídas`}
                  </span>
                </>
              )}
            />
          </CaixaGrafico>
        )}

        <Painel
          titulo="Por Espécie"
          descricao={metrica === "valor" ? "Valor contábil de entradas e saídas" : "Notas de entrada e de saída"}
        >
          {esp.error ? (
            <PainelErro mensagem={(esp.error as Error).message} onTentar={() => esp.refetch()} />
          ) : !esp.data ? (
            <div aria-busy className="flex flex-col gap-3">
              <Esqueleto className="h-3 w-full rounded-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5 py-1">
                  <Esqueleto className="h-3 w-3/4" />
                  <Esqueleto className="h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <ComposicaoEspecies dados={esp.data} metrica={metrica} />
          )}
        </Painel>
      </div>

      <ComposicaoImpostos
        dados={impostos.data}
        lado={ladoImpostos}
        onLado={setLadoImpostos}
        carregando={!impostos.data}
        erro={impostos.error ? (impostos.error as Error).message : null}
        onTentar={() => impostos.refetch()}
      />

      {o && dv && cc && (
        <DetalheMovimento
          aberto={detalheAberto}
          onFechar={() => setDetalheAberto(false)}
          periodo={inicio && fim ? `${dataBR(inicio)} a ${dataBR(fim)}` : undefined}
          overview={o}
          devolucoes={dv}
          cancelamentos={cc}
        />
      )}
    </>
  );
}
