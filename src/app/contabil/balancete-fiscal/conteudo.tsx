"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Filter, Layers } from "lucide-react";
import clsx from "clsx";
import { Card, EmptyState, Segmented } from "@/components/ui";
import { useFiltros } from "@/hooks/use-filters";
import { useBalanceteFiscal } from "@/hooks/use-api";
import {
  BalanceteLancamentosModal,
  type AlvoBalancete,
} from "@/components/balancete-lancamentos-modal";
import { CulpadosModal } from "@/components/balancete-culpados-modal";
import { brl, num } from "@/lib/format";
import type { BalanceteLinha } from "@/lib/types";

/** Diferença líquida da conta: (débito − crédito) esperado − o mesmo no real. */
const netDif = (l: BalanceteLinha) => l.fiscalDeb - l.fiscalCred - (l.realDeb - l.realCred);
const TOL = 0.5;

/** Valor de coluna clicável (drill-down) quando não é zero; em branco quando zero. */
function ValLink({
  v,
  natureza,
  lado,
  forte,
  onDrill,
}: {
  v: number;
  natureza: 1 | -1;
  lado: "real" | "fiscal";
  forte?: boolean;
  onDrill: (lado: "real" | "fiscal", n: 1 | -1) => void;
}) {
  if (Math.abs(v) < 0.005) return <span className="text-muted/40">—</span>;
  return (
    <button
      onClick={() => onDrill(lado, natureza)}
      className={clsx(
        "tabular-nums text-ink transition-colors hover:text-accent hover:underline",
        forte && "font-medium"
      )}
    >
      {brl(v)}
    </button>
  );
}

export default function BalanceteFiscalPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const [nivel, setNivel] = useState(3);
  const [soDif, setSoDif] = useState(false);
  const [alvo, setAlvo] = useState<AlvoBalancete | null>(null);
  const [culpados, setCulpados] = useState<BalanceteLinha | null>(null);

  const bal = useBalanceteFiscal(qs, temEmpresa);
  const dados = bal.data;
  const nivelMax = dados?.nivelMax ?? 5;

  // Modo "Só diferenças": as analíticas (folhas) onde o esperado não bate com o
  // real, do maior desvio pro menor — o que a aba Diferenças mostrava, agora aqui.
  // Modo árvore: o balancete inteiro, cortado pelo nível.
  const linhas = useMemo(() => {
    const todas = dados?.linhas ?? [];
    if (soDif) {
      return todas
        .filter((l) => !l.sintetica && Math.abs(netDif(l)) > TOL)
        .sort((a, b) => Math.abs(netDif(b)) - Math.abs(netDif(a)));
    }
    return todas.filter((l) => l.nivel <= nivel);
  }, [dados, nivel, soDif]);

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  return (
    <Card as="section">
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Balancete fiscal × contábil</h2>
          </div>
          <div className="flex items-center gap-2">
            <Segmented<"todas" | "dif">
              aria-label="Filtrar contas"
              options={[
                { value: "todas", label: "Todas" },
                { value: "dif", label: "Só diferenças", icon: <Filter className="size-3" /> },
              ]}
              value={soDif ? "dif" : "todas"}
              onChange={(v) => setSoDif(v === "dif")}
            />
            {!soDif && (
              <>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Layers className="size-3.5" /> Nível
                </span>
                <div className="flex rounded-lg border border-hairline bg-surface-2 p-0.5 text-xs">
                  {Array.from({ length: nivelMax }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNivel(n)}
                      className={clsx(
                        "rounded-md px-2.5 py-1 tabular-nums transition-colors",
                        nivel === n
                          ? "bg-surface font-medium text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {dados && dados.pendentes.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            {num(dados.pendentes.length)}{" "}
            {dados.pendentes.length === 1
              ? "nota de serviço a contabilizar"
              : "notas de serviço a contabilizar"}{" "}
            · {brl(dados.pendentes.reduce((s, p) => s + p.valor, 0))}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {dados.pendentes.map((p) => (
              <li
                key={`${p.origem}${p.chave}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-ink-2">
                  NFSE {p.numero ?? "s/nº"} · {p.contraparte ?? "—"}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-muted">
                  <span className="truncate">
                    {p.conta ? `${p.conta} ${p.contaDescr ?? ""}` : "conta a definir"}
                  </span>
                  <span className="tabular-nums text-ink">{brl(p.valor)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bal.isLoading || !dados ? (
        <div className="skeleton h-96 w-full" />
      ) : linhas.length === 0 ? (
        soDif ? (
          <div className="grid h-32 place-items-center gap-2 text-center">
            <CheckCircle2 className="mx-auto size-6 text-good" />
            <p className="text-sm text-muted">Tudo bate — nenhuma conta com diferença no período.</p>
          </div>
        ) : (
          <p className="grid h-32 place-items-center text-sm text-muted">Sem movimento no período.</p>
        )
      ) : (
        <div className={clsx(bal.isFetching && !bal.isLoading && "refetching")}>
          <div className="max-h-[38rem] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="py-2 pr-3 text-left font-medium">Conta</th>
                  <th className="border-l border-hairline py-2 pl-3 pr-3 text-right font-medium" colSpan={2}>
                    Fiscal (esperado)
                  </th>
                  <th className="border-l border-hairline py-2 pl-3 pr-3 text-right font-medium" colSpan={2}>
                    Contábil (real)
                  </th>
                  <th className="border-l border-hairline py-2 pl-3 text-right font-medium">Diferença</th>
                </tr>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-muted">
                  <th />
                  <th className="border-l border-hairline py-1 pl-3 pr-3 text-right font-medium">Débito</th>
                  <th className="py-1 pr-3 text-right font-medium">Crédito</th>
                  <th className="border-l border-hairline py-1 pl-3 pr-3 text-right font-medium">Débito</th>
                  <th className="py-1 pr-3 text-right font-medium">Crédito</th>
                  <th className="border-l border-hairline" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Linha
                    key={`${l.classif}-${l.conta}`}
                    l={l}
                    flat={soDif}
                    onDrill={(lado, natureza) =>
                      setAlvo({
                        classif: l.classif,
                        natureza,
                        lado,
                        conta: l.conta,
                        sintetica: l.sintetica,
                        descricao: `${l.conta} · ${l.descricao}`,
                      })
                    }
                    onCulpados={() => setCulpados(l)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BalanceteLancamentosModal qs={qs} alvo={alvo} onFechar={() => setAlvo(null)} />
      <CulpadosModal qs={qs} alvo={culpados} onFechar={() => setCulpados(null)} />
    </Card>
  );
}

function Linha({
  l,
  flat,
  onDrill,
  onCulpados,
}: {
  l: BalanceteLinha;
  flat?: boolean;
  onDrill: (lado: "real" | "fiscal", natureza: 1 | -1) => void;
  onCulpados: () => void;
}) {
  const difNet = netDif(l);
  const temDif = Math.abs(difNet) > TOL;
  const grande = Math.abs(difNet) > 100;
  return (
    <tr
      className={clsx(
        "border-b border-hairline/50 last:border-0",
        l.sintetica ? "bg-surface-2/40 font-medium" : "hover:bg-surface-2/40"
      )}
    >
      <td className="py-1.5 pr-3" style={{ paddingLeft: flat ? "4px" : `${(l.nivel - 1) * 16 + 4}px` }}>
        <span className="tabular-nums text-muted">{l.conta}</span>{" "}
        <span className={clsx("truncate", l.sintetica ? "text-ink" : "text-ink-2")}>
          {l.descricao}
        </span>
      </td>
      <td className="border-l border-hairline/50 py-1.5 pl-3 pr-3 text-right">
        <ValLink v={l.fiscalDeb} natureza={1} lado="fiscal" forte={l.sintetica} onDrill={onDrill} />
      </td>
      <td className="py-1.5 pr-3 text-right">
        <ValLink v={l.fiscalCred} natureza={-1} lado="fiscal" forte={l.sintetica} onDrill={onDrill} />
      </td>
      <td className="border-l border-hairline/50 py-1.5 pl-3 pr-3 text-right">
        <ValLink v={l.realDeb} natureza={1} lado="real" onDrill={onDrill} />
      </td>
      <td className="py-1.5 pr-3 text-right">
        <ValLink v={l.realCred} natureza={-1} lado="real" onDrill={onDrill} />
      </td>
      <td
        className={clsx(
          "border-l border-hairline/50 py-1.5 pl-3 pr-1 text-right tabular-nums",
          !temDif && "text-good",
          temDif && (grande ? "font-semibold text-critical" : "text-warn")
        )}
      >
        {temDif ? (
          <button
            onClick={onCulpados}
            className="inline-flex items-center gap-1 transition-colors hover:underline"
            title="Ver as notas por trás desta diferença"
          >
            {grande && <AlertTriangle className="size-3" />}
            {brl(difNet)}
          </button>
        ) : (
          "ok"
        )}
      </td>
    </tr>
  );
}
