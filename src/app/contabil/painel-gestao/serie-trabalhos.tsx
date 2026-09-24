"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Vazio } from "@/componentes/primitivos/estados";
import { trabalhoContabil } from "@/componentes/produto/contabil/painel-atividade";
import { CaixaGrafico, GraficoSerie, Legenda, type Serie } from "@/componentes/produto/graficos";
import { nomeMes } from "@/lib/contexto";
import { mesBR, num } from "@/lib/format";
import type { ContabilSeriePonto } from "@/lib/painel-contabil-tipos";

/*
 * As três produções que a série acompanha. A cor e o nome vêm do catálogo de
 * trabalhos do app (o mesmo da aba "No NaveX"), então a conciliação é a mesma
 * cor no gráfico, no feed ao lado e na Produtividade.
 */
const SERIES: Serie[] = [
  { chave: "conciliacoes", classe: "conciliacao" },
  { chave: "implantacoes", classe: "implantacao" },
  { chave: "laudos", classe: "laudo" },
].map(({ chave, classe }) => ({ chave, ...trabalhoContabil(classe), tipo: "barra" as const }));

/** Série de seis meses do que o time gerou no app. Só o painel da equipe tem série. */
export function SerieTrabalhos({
  serie,
  carregando,
  onTentar,
  className,
}: {
  serie: ContabilSeriePonto[] | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
  className?: string;
}) {
  const titulo = "O que o time gerou nos últimos seis meses";
  const descricao = "Conciliações, implantações e laudos por mês";

  if (!carregando && !serie)
    return (
      <CaixaGrafico titulo={titulo} descricao={descricao} className={className} altura={260}>
        <Vazio
          compacto
          icone="alerta"
          titulo="Série indisponível"
          descricao="A consulta da série falhou no servidor."
          acao={
            onTentar && (
              <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
                Tentar de novo
              </Botao>
            )
          }
        />
      </CaixaGrafico>
    );

  const dados = (serie ?? []).map((p) => ({ ...p, mes: mesBR(p.bucket) }));
  // Total do semestre ao lado de cada nome na legenda: o gráfico mostra o ritmo,
  // a legenda responde "quanto no total" sem ninguém somar barra.
  const total = (k: string) => dados.reduce((s, p) => s + Number(p[k as keyof typeof p] ?? 0), 0);
  const semNada = dados.length > 0 && SERIES.every((s) => total(s.chave) === 0);

  return (
    <CaixaGrafico
      titulo={titulo}
      descricao={descricao}
      className={className}
      altura={260}
      carregando={carregando}
      vazio={semNada ? "Nenhuma conciliação, implantação ou laudo nos últimos seis meses." : undefined}
      legenda={
        !carregando && <Legenda itens={SERIES.map((s) => ({ rotulo: s.rotulo, cor: s.cor, valor: num(total(s.chave)) }))} />
      }
    >
      <GraficoSerie
        dados={dados}
        x="mes"
        series={SERIES}
        tituloDica={(p) => nomeMes(p.bucket, true)}
      />
    </CaixaGrafico>
  );
}
