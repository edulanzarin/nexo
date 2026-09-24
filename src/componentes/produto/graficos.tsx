"use client";

import type { ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Esqueleto } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { cn } from "@/lib/cn";
import { num, numCompact } from "@/lib/format";

/*
 * Gráficos do NaveX. A cor de série vem do dado (`cor` do catálogo: origem,
 * espécie, faixa), nunca da posição na paleta: pintar por índice diverge da
 * legenda no primeiro item cinza. Eixo é terso (a unidade está no título) e a
 * dica é identificada, com o formatador completo.
 */

export const CORES_SERIE = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--serie-3)",
  "var(--serie-4)",
  "var(--serie-5)",
  "var(--serie-6)",
];

const EIXO = { fill: "var(--apagado)", fontSize: 11 };

/**
 * O recharts tipa a chave pelo dado do gráfico, e com o dado genérico o
 * TypeScript não prova que a chave existe nele. Quem garante é o `keyof T` da
 * prop; aqui só se atravessa a tipagem da biblioteca.
 */
const chave = (k: string) => k as never;

export interface Serie {
  chave: string;
  rotulo: string;
  cor: string;
  tipo?: "barra" | "linha" | "area";
  /** Séries com o mesmo id de pilha empilham (barra ou área). */
  pilha?: string;
  /** Linha no eixo da direita (acumulado, porcentagem). */
  eixoDireito?: boolean;
}

export function Legenda({
  itens,
  className,
}: {
  itens: { rotulo: string; cor: string; valor?: ReactNode }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1", className)}>
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5 text-pequeno text-tinta-2">
          <span aria-hidden className="size-2 rounded-[3px]" style={{ background: i.cor }} />
          {i.rotulo}
          {i.valor != null && <span className="num text-apagado">{i.valor}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A caixa da dica: vidro de sobreposição, título e linhas identificadas. */
export function DicaGrafico({
  titulo,
  linhas,
}: {
  titulo?: ReactNode;
  linhas: { rotulo: ReactNode; valor: ReactNode; cor?: string }[];
}) {
  return (
    <div className="nx-flutua min-w-44 rounded-controle px-3 py-2">
      {titulo && <p className="mb-1 text-pequeno font-[600] text-tinta">{titulo}</p>}
      {linhas.map((l, i) => (
        <p key={i} className="flex items-center gap-2 text-pequeno">
          {l.cor && <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: l.cor }} />}
          <span className="flex-1 text-apagado">{l.rotulo}</span>
          <span className="num font-[560] text-tinta">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Painel de gráfico com os estados: esqueleto na altura do gráfico (a tela não
 * pula quando o dado chega) e vazio com a frase de quem chama.
 */
export function CaixaGrafico({
  titulo,
  descricao,
  acoes,
  legenda,
  carregando,
  vazio,
  altura = 240,
  children,
  className,
  rodape,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  legenda?: ReactNode;
  carregando?: boolean;
  /** Texto do vazio. Com ele definido, o gráfico não desenha. */
  vazio?: ReactNode | false;
  altura?: number;
  children: ReactNode;
  className?: string;
  rodape?: ReactNode;
}) {
  return (
    <Painel titulo={titulo} descricao={descricao} acoes={acoes} className={className} rodape={rodape}>
      {legenda && <div className="mb-3">{legenda}</div>}
      <div style={{ height: altura }} className="min-w-0">
        {carregando ? (
          <Esqueleto className="h-full w-full" />
        ) : vazio ? (
          <p className="grid h-full place-items-center text-corpo text-apagado italic">{vazio}</p>
        ) : (
          children
        )}
      </div>
    </Painel>
  );
}

/**
 * Série no tempo: barras, linhas ou áreas, empilhadas ou não, com eixo
 * secundário opcional. `x` é o rótulo já formatado (dia, mês).
 */
export function GraficoSerie<T extends Record<string, unknown>>({
  dados,
  x,
  series,
  formatar = num,
  formatarEixo = numCompact,
  formatarEixoDireito,
  tituloDica,
  aoClicar,
}: {
  dados: T[];
  x: keyof T & string;
  series: Serie[];
  formatar?: (v: number, serie: Serie) => string;
  formatarEixo?: (v: number) => string;
  formatarEixoDireito?: (v: number) => string;
  tituloDica?: (linha: T) => ReactNode;
  aoClicar?: (linha: T) => void;
}) {
  const temDireito = series.some((s) => s.eixoDireito);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={dados}
        margin={{ top: 6, right: temDireito ? 4 : 8, bottom: 0, left: 0 }}
        onClick={(e) => {
          const i = (e as { activeTooltipIndex?: number } | null)?.activeTooltipIndex;
          if (aoClicar && typeof i === "number" && dados[i]) aoClicar(dados[i]);
        }}
      >
        <CartesianGrid vertical={false} stroke="var(--linha)" />
        <XAxis dataKey={chave(x)} tick={EIXO} tickLine={false} axisLine={{ stroke: "var(--linha-forte)" }} minTickGap={12} />
        <YAxis
          yAxisId="e"
          tick={EIXO}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => formatarEixo(v)}
        />
        {temDireito && (
          <YAxis
            yAxisId="d"
            orientation="right"
            tick={EIXO}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => (formatarEixoDireito ?? formatarEixo)(v)}
          />
        )}
        <Tooltip
          cursor={{ fill: "var(--poco-forte)", stroke: "var(--linha-forte)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const linha = payload[0].payload as T;
            return (
              <DicaGrafico
                titulo={tituloDica ? tituloDica(linha) : String(linha[x] ?? "")}
                linhas={series.map((s) => ({
                  rotulo: s.rotulo,
                  cor: s.cor,
                  valor: formatar(Number(linha[s.chave] ?? 0), s),
                }))}
              />
            );
          }}
        />
        {series.map((s) => {
          const eixo = s.eixoDireito ? "d" : "e";
          if (s.tipo === "linha")
            return (
              <Line
                key={s.chave}
                yAxisId={eixo}
                dataKey={s.chave}
                name={s.rotulo}
                stroke={s.cor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          if (s.tipo === "area")
            return (
              <Area
                key={s.chave}
                yAxisId={eixo}
                dataKey={s.chave}
                name={s.rotulo}
                stackId={s.pilha}
                stroke={s.cor}
                strokeWidth={1.75}
                fill={s.cor}
                fillOpacity={0.16}
                isAnimationActive={false}
              />
            );
          return (
            <Bar
              key={s.chave}
              yAxisId={eixo}
              dataKey={s.chave}
              name={s.rotulo}
              stackId={s.pilha}
              fill={s.cor}
              radius={s.pilha ? 0 : [3, 3, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Barras por categoria com a cor por barra (escada de faixas, competências
 * coloridas pelo atraso). Eixo cronológico ou ordinal, nunca reordenado por
 * volume: a ordem é o dado.
 */
export function GraficoBarrasCor<T extends Record<string, unknown>>({
  dados,
  x,
  y,
  cor,
  rotulo,
  formatar = num,
  formatarEixo = numCompact,
  tituloDica,
  extrasDica,
}: {
  dados: T[];
  x: keyof T & string;
  y: keyof T & string;
  cor: (linha: T) => string;
  rotulo: string;
  formatar?: (v: number) => string;
  formatarEixo?: (v: number) => string;
  tituloDica?: (linha: T) => ReactNode;
  extrasDica?: (linha: T) => { rotulo: ReactNode; valor: ReactNode }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={dados} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--linha)" />
        <XAxis dataKey={chave(x)} tick={EIXO} tickLine={false} axisLine={{ stroke: "var(--linha-forte)" }} minTickGap={8} />
        <YAxis tick={EIXO} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatarEixo(v)} />
        <Tooltip
          cursor={{ fill: "var(--poco-forte)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const l = payload[0].payload as T;
            return (
              <DicaGrafico
                titulo={tituloDica ? tituloDica(l) : String(l[x] ?? "")}
                linhas={[{ rotulo, valor: formatar(Number(l[y] ?? 0)), cor: cor(l) }, ...(extrasDica?.(l) ?? [])]}
              />
            );
          }}
        />
        <Bar dataKey={chave(y)} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false}>
          {dados.map((l, i) => (
            <Cell key={i} fill={cor(l)} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Pareto: barras por categoria em ordem de volume e a linha do acumulado. Diz
 * quantos itens respondem pela maior parte do total.
 */
export function GraficoPareto<T extends Record<string, unknown>>({
  dados,
  x,
  y,
  rotulo,
  cor = "var(--serie-1)",
  formatar = num,
}: {
  dados: T[];
  x: keyof T & string;
  y: keyof T & string;
  rotulo: string;
  cor?: string;
  formatar?: (v: number) => string;
}) {
  const total = dados.reduce((s, l) => s + Number(l[y] ?? 0), 0);
  const comAcumulado = dados.reduce<(T & { __acumulado: number })[]>((lista, l) => {
    const anterior = lista.length ? lista[lista.length - 1].__acumulado : 0;
    const parte = total > 0 ? (Number(l[y] ?? 0) / total) * 100 : 0;
    lista.push({ ...l, __acumulado: anterior + parte });
    return lista;
  }, []);
  return (
    <GraficoSerie
      dados={comAcumulado}
      x={x}
      series={[
        { chave: y, rotulo, cor, tipo: "barra" },
        { chave: "__acumulado", rotulo: "Acumulado", cor: "var(--serie-2)", tipo: "linha", eixoDireito: true },
      ]}
      formatar={(v, s) => (s.chave === "__acumulado" ? `${num(Math.round(v))}%` : formatar(v))}
      formatarEixoDireito={(v) => `${Math.round(v)}%`}
    />
  );
}

/**
 * Ranking em barras horizontais, em HTML: mais denso e mais nítido que o SVG,
 * e o rótulo longo (nome de empresa) corta com reticência em vez de enrolar.
 * A régua é o maior valor da lista; quem chama pode passar outra (percentil).
 */
export function RankingBarras<T>({
  itens,
  rotulo,
  valor,
  formatar = num,
  detalhe,
  cor,
  regua,
  aoClicar,
  selecionado,
  limite,
  vazio = "Nada para ranquear no período.",
}: {
  itens: T[];
  rotulo: (i: T) => ReactNode;
  valor: (i: T) => number;
  formatar?: (v: number) => string;
  detalhe?: (i: T) => ReactNode;
  cor?: (i: T) => string;
  regua?: number;
  aoClicar?: (i: T) => void;
  selecionado?: (i: T) => boolean;
  limite?: number;
  vazio?: ReactNode;
}) {
  const lista = limite ? itens.slice(0, limite) : itens;
  const maximo = regua ?? Math.max(0, ...lista.map(valor));
  if (!lista.length) return <p className="py-6 text-center text-corpo text-apagado italic">{vazio}</p>;
  return (
    <ol className="flex flex-col">
      {lista.map((it, i) => {
        const v = valor(it);
        const p = maximo > 0 ? Math.min(1, v / maximo) : 0;
        const sel = selecionado?.(it);
        const Tag = aoClicar ? "button" : "div";
        return (
          <li key={i}>
            <Tag
              type={aoClicar ? "button" : undefined}
              onClick={aoClicar ? () => aoClicar(it) : undefined}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-controle px-2 py-1.5 text-left",
                aoClicar && "transition-colors hover:bg-poco",
                sel && "bg-rota-suave"
              )}
            >
              <span className="min-w-0 truncate text-corpo text-tinta-2">{rotulo(it)}</span>
              <span className="num text-corpo font-[600] text-tinta">{formatar(v)}</span>
              <span className="col-span-2 flex items-center gap-2">
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-poco-forte">
                  <span
                    className="absolute inset-y-0 left-0 origin-left rounded-full transition-transform duration-500 ease-[var(--ease-saida)]"
                    style={{ width: "100%", transform: `scaleX(${p})`, background: cor?.(it) ?? "var(--serie-1)" }}
                  />
                </span>
                {detalhe && <span className="shrink-0 text-micro text-apagado">{detalhe(it)}</span>}
              </span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

/** Dispersão (horas × lançamentos, por pessoa). */
export function GraficoDispersao<T extends Record<string, unknown>>({
  dados,
  x,
  y,
  rotuloX,
  rotuloY,
  nome,
  formatarX = num,
  formatarY = num,
  cor = "var(--serie-1)",
  aoClicar,
}: {
  dados: T[];
  x: keyof T & string;
  y: keyof T & string;
  rotuloX: string;
  rotuloY: string;
  nome: (linha: T) => ReactNode;
  formatarX?: (v: number) => string;
  formatarY?: (v: number) => string;
  cor?: string | ((linha: T) => string);
  aoClicar?: (linha: T) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--linha)" />
        <XAxis
          type="number"
          dataKey={chave(x)}
          name={rotuloX}
          tick={EIXO}
          tickLine={false}
          axisLine={{ stroke: "var(--linha-forte)" }}
          tickFormatter={(v: number) => formatarX(v)}
        />
        <YAxis
          type="number"
          dataKey={chave(y)}
          name={rotuloY}
          tick={EIXO}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => numCompact(v)}
        />
        <ZAxis range={[54, 54]} />
        <Tooltip
          cursor={{ stroke: "var(--linha-forte)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const l = payload[0].payload as T;
            return (
              <DicaGrafico
                titulo={nome(l)}
                linhas={[
                  { rotulo: rotuloX, valor: formatarX(Number(l[x] ?? 0)) },
                  { rotulo: rotuloY, valor: formatarY(Number(l[y] ?? 0)) },
                ]}
              />
            );
          }}
        />
        <Scatter
          data={dados}
          isAnimationActive={false}
          onClick={(p) => aoClicar?.((p as unknown as { payload: T }).payload)}
          className={aoClicar ? "cursor-pointer" : undefined}
        >
          {dados.map((l, i) => (
            <Cell
              key={i}
              fill={typeof cor === "function" ? cor(l) : cor}
              fillOpacity={0.75}
              stroke="var(--vidro-forte)"
              strokeWidth={1}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/**
 * Composição de uma escada ordinal numa barra só, com a contagem de cada degrau
 * embaixo. A pergunta é de proporção ("quanto foi trabalho atrasado?"). Degrau
 * com zero continua na legenda: zero é afirmação.
 */
export function EscadaFaixas({
  faixas,
  valores,
  rotuloItem,
  formatar = num,
}: {
  faixas: { id: string; rotulo: string; cor: string }[];
  valores: number[];
  rotuloItem: string;
  formatar?: (v: number) => string;
}) {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="py-6 text-center text-corpo text-apagado italic">Nada para distribuir no período.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={`${rotuloItem} por faixa`} className="flex h-3 w-full overflow-hidden rounded-full bg-poco-forte">
        {faixas.map((f, i) => {
          const p = ((valores[i] ?? 0) / total) * 100;
          return p > 0 ? (
            <span key={f.id} title={`${f.rotulo}: ${formatar(valores[i] ?? 0)}`} style={{ width: `${p}%`, background: f.cor }} />
          ) : null;
        })}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${faixas.length}, minmax(0, 1fr))` }}>
        {faixas.map((f, i) => {
          const v = valores[i] ?? 0;
          const p = (v / total) * 100;
          return (
            <div key={f.id} className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-pequeno text-apagado">
                <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: f.cor }} />
                <span className="truncate">{f.rotulo}</span>
              </p>
              <p className="nx-leitura mt-0.5 text-[18px] leading-6 text-tinta">{formatar(v)}</p>
              <p className="num text-micro text-apagado">
                {p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Calendário de atividade: um quadrado por dia, a intensidade é o volume. Mostra
 * o padrão (dias parados, picos de fechamento); para nomear um dia, a dica diz a
 * data e o número, porque ninguém conta quadrados.
 */
export function CalendarioAtividade({
  dias,
  formatar = num,
  rotulo = "Lançamentos",
  pico,
}: {
  /** Um item por dia com volume, ISO "YYYY-MM-DD". */
  dias: { dia: string; valor: number }[];
  formatar?: (v: number) => string;
  rotulo?: string;
  /** Dia a destacar. Sem ele, o de maior volume. */
  pico?: string;
}) {
  if (!dias.length) return <p className="py-6 text-center text-corpo text-apagado italic">Nenhum dia com atividade.</p>;
  const ordenados = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const mapa = new Map(ordenados.map((d) => [d.dia, d.valor]));
  const ini = new Date(ordenados[0].dia + "T12:00:00");
  const fim = new Date(ordenados[ordenados.length - 1].dia + "T12:00:00");
  ini.setDate(ini.getDate() - ini.getDay());
  const semanas: { dia: string; valor: number | null }[][] = [];
  const cursor = new Date(ini);
  while (cursor <= fim) {
    const semana: { dia: string; valor: number | null }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      semana.push({ dia: iso, valor: cursor < new Date(ordenados[0].dia + "T00:00:00") || cursor > fim ? null : (mapa.get(iso) ?? 0) });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
  }
  const valores = ordenados.map((d) => d.valor).sort((a, b) => a - b);
  // Régua pelo p95: um dia de fechamento com dez vezes a média apagaria todo o resto.
  const teto = valores[Math.floor(valores.length * 0.95)] || valores[valores.length - 1] || 1;
  // O pico, se não veio de fora, é o dia de maior volume: ganha contorno para
  // a pessoa achar o dia sem contar quadrados.
  const diaPico = pico ?? ordenados.reduce((a, b) => (b.valor > a.valor ? b : a)).dia;
  // Nome do mês sobre a semana em que ele começa: a fita se lê como calendário.
  const rotulosMes = semanas.map((s, i) => {
    const primeiro = s.find((d) => d.valor != null)?.dia;
    if (!primeiro) return "";
    const mes = primeiro.slice(0, 7);
    const anterior = i > 0 ? semanas[i - 1].find((d) => d.valor != null)?.dia.slice(0, 7) : undefined;
    return mes !== anterior ? MESES_CURTOS[Number(mes.slice(5, 7)) - 1] : "";
  });
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      <div className="grid grid-rows-[14px_repeat(7,14px)] gap-[3px]">
        <span />
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="grid h-3.5 place-items-center text-[9px] text-apagado">
            {i % 2 === 1 ? d : ""}
          </span>
        ))}
      </div>
      {semanas.map((s, i) => (
        <div key={i} className="grid grid-rows-[14px_repeat(7,14px)] gap-[3px]">
          <span className="w-3.5 overflow-visible text-[10px] leading-[14px] whitespace-nowrap text-apagado">
            {rotulosMes[i]}
          </span>
          {s.map((d) => {
            const v = d.valor;
            const nivel = v == null ? -1 : v === 0 ? 0 : Math.min(4, Math.ceil((v / teto) * 4));
            return (
              <span
                key={d.dia}
                title={v == null ? undefined : `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}: ${formatar(v)} ${rotulo.toLowerCase()}`}
                className={cn(
                  "size-3.5 rounded-[3px]",
                  v == null && "opacity-0",
                  d.dia === diaPico && v != null && "ring-2 ring-acento-solido ring-offset-1 ring-offset-[var(--vidro-forte)]"
                )}
                style={{
                  background:
                    nivel <= 0
                      ? "var(--poco-forte)"
                      : `color-mix(in srgb, var(--serie-1) ${[0, 30, 55, 78, 100][nivel]}%, transparent)`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
