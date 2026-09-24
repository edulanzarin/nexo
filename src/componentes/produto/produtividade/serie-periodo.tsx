"use client";

import { useMemo, type ReactNode } from "react";
import { CaixaGrafico, GraficoSerie, Legenda, type Serie } from "@/componentes/produto/graficos";
import { num, numCompact } from "@/lib/format";
import type { ClasseInfo, SeriePontoGen } from "@/lib/prod-tipos";
import { nomeGranularidade, rotuloBucket, rotuloBucketLongo, type Granularidade } from "./recorte";

/**
 * Série de um período de Produtividade: os buckets chegam DENSOS do servidor
 * (dia sem movimento vem com zero), então o vale no gráfico é vale de verdade,
 * não furo de dado. Aqui só se traduz o bucket em rótulo ("14/08", "ago/26")
 * e a dica ganha a data inteira.
 */
export function GraficoPeriodo<T extends { bucket: string }>({
  pontos,
  granularidade,
  series,
  formatar = num,
  formatarEixo = numCompact,
  formatarEixoDireito,
}: {
  pontos: T[];
  granularidade: Granularidade;
  series: Serie[];
  formatar?: (v: number, serie: Serie) => string;
  formatarEixo?: (v: number) => string;
  formatarEixoDireito?: (v: number) => string;
}) {
  // O gráfico lê o ponto por nome de chave; os tipos de ponto são interfaces
  // (sem índice implícito), e a travessia para registro genérico é só de tipo.
  const dados = useMemo(
    () =>
      pontos.map(
        (p) => ({ ...p, __rotulo: rotuloBucket(p.bucket, granularidade) }) as unknown as Record<string, unknown>
      ),
    [pontos, granularidade]
  );
  return (
    <GraficoSerie
      dados={dados}
      x="__rotulo"
      series={series}
      formatar={formatar}
      formatarEixo={formatarEixo}
      formatarEixoDireito={formatarEixoDireito}
      tituloDica={(l) => rotuloBucketLongo(String(l.bucket), granularidade)}
    />
  );
}

/**
 * O ritmo do período empilhado pela classe do módulo (natureza do lançamento,
 * espécie da nota, tipo de gesto). A pergunta é "esse pico foi trabalho ou
 * integração?", e o total sozinho não responde.
 *
 * `soTotal` desenha uma barra única: é o modo de quando UMA pessoa está
 * isolada, porque a quebra dia × classe por pessoa não vem do servidor.
 */
export function SerieClasses({
  titulo = "Ritmo no período",
  descricao,
  pontos,
  classes,
  granularidade,
  soTotal,
  rotuloItem,
  carregando,
  altura = 260,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  pontos: SeriePontoGen[] | undefined;
  classes: ClasseInfo[];
  granularidade: Granularidade;
  soTotal?: boolean;
  /** O que se conta ("Lançamentos", "Registros"). */
  rotuloItem: string;
  carregando?: boolean;
  altura?: number;
}) {
  const visiveis = useMemo(
    () => (soTotal ? [] : classes.filter((c) => pontos?.some((p) => Number(p[c.id] ?? 0) > 0))),
    [soTotal, classes, pontos]
  );
  const series: Serie[] = soTotal
    ? [{ chave: "total", rotulo: rotuloItem, cor: "var(--serie-1)", tipo: "barra" }]
    : visiveis.map((c) => ({ chave: c.id, rotulo: c.rotulo, cor: c.cor, tipo: "barra", pilha: "classe" }));
  const vazio = pontos && pontos.every((p) => p.total === 0) ? "Sem movimento no período." : false;
  return (
    <CaixaGrafico
      titulo={titulo}
      descricao={descricao ?? `${rotuloItem} por ${nomeGranularidade(granularidade)}`}
      legenda={visiveis.length > 0 ? <Legenda itens={visiveis.map((c) => ({ rotulo: c.rotulo, cor: c.cor }))} /> : undefined}
      carregando={carregando || !pontos}
      vazio={vazio}
      altura={altura}
    >
      <GraficoPeriodo pontos={pontos ?? []} granularidade={granularidade} series={series} />
    </CaixaGrafico>
  );
}
