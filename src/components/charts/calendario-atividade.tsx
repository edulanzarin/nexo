"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/ui/chart-card";
import { dataBR, num } from "@/lib/format";
import type { ProdutividadeCalendario } from "@/lib/types";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DOW_LABELS = ["", "Seg", "", "Qua", "", "Sex", ""];
const LABEL_W = 30; // px — coluna dos rótulos de dia da semana
const ROW = 15; // px — altura de cada linha (dia da semana)
const GAP = 3; // px

interface Props {
  dados: ProdutividadeCalendario | undefined;
  carregando: boolean;
  recarregando: boolean;
  /** Subtítulo do cartão — o padrão é o do Fiscal (notas). */
  subtitulo?: string;
  /** Como se chama a unidade contada ("notas", "lançamentos"). */
  rotuloItem?: string;
}

function heat(n: number, max: number): string {
  if (n <= 0) return "var(--surface-2)";
  const i = 0.15 + 0.85 * (n / max);
  return `color-mix(in oklab, var(--ent) ${Math.round(i * 100)}%, transparent)`;
}

const utc = (iso: string) => new Date(iso + "T00:00:00Z");
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

interface Dia {
  iso: string;
  inRange: boolean;
  n: number;
  date: Date;
}

/** Grade diária estilo GitHub, ocupando toda a largura (colunas flexíveis). */
function Grade({ dados, rotuloItem }: { dados: ProdutividadeCalendario; rotuloItem: string }) {
  const { dias, numWeeks, max, segmentos } = useMemo(() => {
    const mapa = new Map(dados.celulas.map((c) => [c.d, c.n]));
    const inicio = utc(dados.inicio);
    const fim = utc(dados.fim);
    const gridStart = new Date(inicio);
    gridStart.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay()); // domingo <= início
    const gridEnd = new Date(fim);
    gridEnd.setUTCDate(fim.getUTCDate() + (6 - fim.getUTCDay())); // sábado >= fim

    const dias: Dia[] = [];
    for (let t = new Date(gridStart); t <= gridEnd; t.setUTCDate(t.getUTCDate() + 1)) {
      const iso = isoOf(t);
      const inRange = t >= inicio && t <= fim;
      dias.push({ iso, inRange, n: inRange ? mapa.get(iso) ?? 0 : 0, date: new Date(t) });
    }
    const numWeeks = dias.length / 7;
    const max = Math.max(1, ...dias.filter((d) => d.inRange).map((d) => d.n));

    // mês de cada coluna (primeiro dia do período dentro daquela semana)
    const segmentos: { startCol: number; endCol: number; label: string }[] = [];
    for (let c = 0; c < numWeeks; c++) {
      let mo = -1;
      let ano = 0;
      for (let r = 0; r < 7; r++) {
        const d = dias[c * 7 + r];
        if (d.inRange) {
          mo = d.date.getUTCMonth();
          ano = d.date.getUTCFullYear();
          break;
        }
      }
      if (mo < 0) continue;
      const ultimo = segmentos[segmentos.length - 1];
      const label =
        mo === 0 || segmentos.length === 0 ? `${MESES[mo]}/${String(ano).slice(2)}` : MESES[mo];
      if (!ultimo || ultimo.label !== label) {
        segmentos.push({ startCol: c, endCol: c + 1, label });
      } else {
        ultimo.endCol = c + 1;
      }
    }
    return { dias, numWeeks, max, segmentos };
  }, [dados]);

  const colTemplate = `repeat(${numWeeks}, minmax(0, 1fr))`;

  return (
    <div className="w-full">
      {/* rótulos de mês */}
      <div className="mb-1 flex">
        <div className="shrink-0" style={{ width: LABEL_W }} />
        <div
          className="grid flex-1 text-[10px] text-muted"
          style={{ gridTemplateColumns: colTemplate, columnGap: GAP }}
        >
          {segmentos.map((s) => (
            <span
              key={s.startCol}
              className="truncate"
              style={{ gridColumn: `${s.startCol + 1} / ${s.endCol + 1}` }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
      {/* rótulos de dia da semana + grade */}
      <div className="flex">
        <div
          className="grid shrink-0"
          style={{ width: LABEL_W, gridTemplateRows: `repeat(7, ${ROW}px)`, rowGap: GAP }}
        >
          {DOW_LABELS.map((d, i) => (
            <span
              key={i}
              className="flex items-center justify-end pr-1.5 text-[9px] leading-none text-ink-2"
            >
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1"
          style={{
            gridTemplateColumns: colTemplate,
            gridTemplateRows: `repeat(7, ${ROW}px)`,
            gridAutoFlow: "column",
            gap: GAP,
          }}
        >
          {dias.map((d, i) =>
            d.inRange ? (
              <div
                key={i}
                title={`${dataBR(d.iso)} · ${num(d.n)} ${rotuloItem}`}
                className="rounded-[3px]"
                style={{
                  background: heat(d.n, max),
                  outline: dados.pico?.d === d.iso ? "1.5px solid var(--ink)" : undefined,
                  outlineOffset: "-1.5px",
                }}
              />
            ) : (
              <div key={i} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarioAtividade({
  dados,
  carregando,
  recarregando,
  subtitulo = "Notas lançadas por dia no período (entradas + saídas)",
  rotuloItem = "notas",
}: Props) {
  const pico = dados?.pico;
  return (
    <ChartCard
      titulo="Calendário de atividade"
      subtitulo={subtitulo}
      carregando={carregando || !dados}
      recarregando={recarregando}
      alturaSkeleton="h-40"
      acao={
        pico ? (
          <span className="hidden text-xs text-muted sm:block">
            Pico: {dataBR(pico.d)} · {num(pico.n)} {rotuloItem}
          </span>
        ) : undefined
      }
    >
      {dados && dados.total === 0 ? (
        <p className="grid h-32 place-items-center text-sm text-muted">Sem lançamentos no período</p>
      ) : dados ? (
        <>
          <Grade dados={dados} rotuloItem={rotuloItem} />
          <div className="mt-3 flex items-center justify-end gap-2 pr-1 text-[11px] text-muted">
            <span>menos</span>
            <div className="flex gap-0.5">
              {[0.15, 0.4, 0.6, 0.8, 1].map((i) => (
                <span
                  key={i}
                  className="size-3 rounded-[3px]"
                  style={{ background: `color-mix(in oklab, var(--ent) ${Math.round(i * 100)}%, transparent)` }}
                />
              ))}
            </div>
            <span>mais</span>
          </div>
        </>
      ) : null}
    </ChartCard>
  );
}
