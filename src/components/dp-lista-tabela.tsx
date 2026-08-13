"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import { Badge, type BadgeTone } from "@/components/ui";
import type { DpLinha, DpTipo, EsocialStatus } from "@/lib/dp-tipos";
import { dataBR, num } from "@/lib/format";

/** "YYYY-MM-DDTHH:MM:SS" → "dd/mm/aaaa HH:MM" (sem depender de fuso). */
function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [data, hora] = iso.split("T");
  return `${dataBR(data)} ${(hora ?? "").slice(0, 5)}`.trim();
}

function EsocialBadge({ status }: { status: EsocialStatus | undefined }) {
  const mapa: Record<EsocialStatus, { rotulo: string; tone: BadgeTone }> = {
    ok: { rotulo: "Transmitida", tone: "ent" },
    pendente: { rotulo: "Pendente", tone: "warning" },
    nao_enviado: { rotulo: "Não enviada", tone: "neutral" },
  };
  const s = mapa[status ?? "nao_enviado"];
  return <Badge tone={s.tone}>{s.rotulo}</Badge>;
}

interface Coluna {
  rotulo: string;
  fim?: boolean;
  render: (l: DpLinha) => React.ReactNode;
}

function empresaCell(l: DpLinha) {
  return (
    <div className="flex flex-col">
      <span className="truncate text-ink-2">{l.empresa}</span>
      <span className="text-[11px] tabular-nums text-muted">{l.codigoempresa}</span>
    </div>
  );
}

/**
 * Colunas por tipo. O colaborador do DP (funcionário da Navecon) não é coluna —
 * é o menu (o accordion). Cada linha mostra a EMPRESA do registro e os dados do
 * trabalho; o empregado do cliente não entra (este é o painel do nosso pessoal).
 */
function colunas(tipo: DpTipo): Coluna[] {
  const empresa: Coluna = { rotulo: "Empresa", render: empresaCell };

  if (tipo === "avisos" || tipo === "rescisoes") {
    return [
      empresa,
      { rotulo: "Causa da demissão", render: (l) => l.causa ?? "—" },
      { rotulo: "Data do aviso", render: (l) => dataBR(l.dataAviso) },
      { rotulo: "Data da rescisão", render: (l) => dataBR(l.dataResc) },
      {
        rotulo: tipo === "avisos" ? "Cadastrado em" : "Calculada em",
        fim: true,
        render: (l) => <span className="tabular-nums text-muted">{dataHoraBR(l.quando)}</span>,
      },
    ];
  }

  if (tipo === "admissoes") {
    return [
      empresa,
      { rotulo: "Data de admissão", render: (l) => dataBR(l.dataAdm) },
      { rotulo: "eSocial", render: (l) => <EsocialBadge status={l.esocial} /> },
      { rotulo: "Origem", render: (l) => l.origem ?? "—" },
      {
        rotulo: "Lançada em",
        fim: true,
        render: (l) => <span className="tabular-nums text-muted">{dataHoraBR(l.quando)}</span>,
      },
    ];
  }

  // férias
  return [
    empresa,
    { rotulo: "Início do gozo", render: (l) => dataBR(l.inicioFerias) },
    { rotulo: "Fim do gozo", render: (l) => dataBR(l.fimFerias) },
    { rotulo: "Período aquisitivo", render: (l) => dataBR(l.periodoAquisitivo) },
    { rotulo: "Pagamento", render: (l) => dataBR(l.dataPgto) },
    {
      rotulo: "Calculada em",
      fim: true,
      render: (l) => <span className="tabular-nums text-muted">{dataHoraBR(l.quando)}</span>,
    },
  ];
}

interface Grupo {
  codigousuario: number;
  usuario: string;
  linhas: DpLinha[];
}

/** Agrupa por colaborador do DP e ordena os grupos pelo volume (mais fez primeiro). */
function agrupar(dados: DpLinha[]): Grupo[] {
  const mapa = new Map<number, Grupo>();
  for (const l of dados) {
    let g = mapa.get(l.codigousuario);
    if (!g) {
      g = { codigousuario: l.codigousuario, usuario: l.usuario, linhas: [] };
      mapa.set(l.codigousuario, g);
    }
    g.linhas.push(l);
  }
  return [...mapa.values()].sort((a, b) => b.linhas.length - a.linhas.length);
}

/** Tabela dos registros de UM colaborador (dentro do accordion aberto). */
function TabelaRegistros({ cols, linhas }: { cols: Coluna[]; linhas: DpLinha[] }) {
  return (
    <div className="max-h-[28rem] overflow-auto border-t border-hairline">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="border-b border-hairline text-xs text-muted">
            {cols.map((c) => (
              <th
                key={c.rotulo}
                className={clsx("px-3 py-2 font-medium", c.fim ? "text-right" : "text-left")}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr
              key={`${l.codigoempresa}-${l.contrato}-${i}`}
              className="border-b border-hairline/60 last:border-0 hover:bg-surface-2/40"
            >
              {cols.map((c) => (
                <td
                  key={c.rotulo}
                  className={clsx("px-3 py-2.5 align-top", c.fim && "text-right")}
                >
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  tipo: DpTipo;
  dados: DpLinha[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}

export function DpListaTabela({ tipo, dados, carregando, recarregando }: Props) {
  const cols = colunas(tipo);
  const grupos = useMemo(() => (dados ? agrupar(dados) : undefined), [dados]);

  // Colaboradores abertos (por codigousuario). Fechados por padrão — o menu não
  // cresce sem fim; abre um por vez conforme o interesse.
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const alternar = (codigo: number) =>
    setAbertos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(codigo)) proximo.delete(codigo);
      else proximo.add(codigo);
      return proximo;
    });

  // Quando o conjunto de colaboradores muda (troca de aba, filtro, período),
  // ressincroniza o menu no render (padrão React de derivar de prop, sem effect
  // — igual ao useRascunhoFiltros): se sobrou 1 colaborador (filtrado pelo
  // ranking), abre-o direto; senão volta tudo a fechado.
  const sig = grupos ? grupos.map((g) => g.codigousuario).join(",") : "";
  const [sigAnterior, setSigAnterior] = useState(sig);
  if (sig !== sigAnterior) {
    setSigAnterior(sig);
    setAbertos(grupos && grupos.length === 1 ? new Set([grupos[0].codigousuario]) : new Set());
  }

  if (carregando || !grupos) return <div className="skeleton h-96 w-full" />;
  if (grupos.length === 0) {
    return <p className="grid h-40 place-items-center text-sm text-muted">Nada lançado no período</p>;
  }

  return (
    <div className={clsx(recarregando && "refetching")}>
      <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
        {grupos.map((g) => {
          const aberto = abertos.has(g.codigousuario);
          return (
            <div key={g.codigousuario} className="overflow-hidden rounded-xl border border-hairline">
              <button
                onClick={() => alternar(g.codigousuario)}
                className={clsx(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  aberto ? "bg-surface-2/70" : "bg-surface-2/30 hover:bg-surface-2/60"
                )}
              >
                <ChevronRight
                  className={clsx("size-4 shrink-0 text-muted transition-transform", aberto && "rotate-90")}
                />
                <span className="flex-1 truncate font-semibold text-ink">{g.usuario}</span>
                <Badge tone="ent" shape="pill" className="text-xs">
                  {num(g.linhas.length)} {g.linhas.length === 1 ? "registro" : "registros"}
                </Badge>
              </button>
              {aberto && <TabelaRegistros cols={cols} linhas={g.linhas} />}
            </div>
          );
        })}
      </div>
      {dados && dados.length >= 1000 && (
        <p className="mt-3 text-center text-xs text-muted">
          Mostrando as 1000 linhas mais recentes — refine o período ou a empresa
        </p>
      )}
    </div>
  );
}
