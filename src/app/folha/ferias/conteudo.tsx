"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarClock, CalendarX2, Info, Plane, Users } from "lucide-react";
import clsx from "clsx";
import { Kpi } from "@/components/kpi-conf";
import { useFiltros } from "@/hooks/use-filters";
import { useControleFerias } from "@/hooks/use-api";
import { dataBR, num } from "@/lib/format";
import type { FeriasFuncionario, FeriasSituacao } from "@/lib/types";

const ROTULO: Record<FeriasSituacao, string> = {
  vencida: "Vencida",
  a_vencer: "A vencer",
  adquirida: "Direito adquirido",
  em_dia: "Em dia",
};
const COR: Record<FeriasSituacao, string> = {
  vencida: "bg-critical/12 text-critical",
  a_vencer: "bg-warning/15 text-warning",
  adquirida: "bg-ent/12 text-ent",
  em_dia: "bg-good/12 text-good",
};

/** Prazo até (ou desde) o limite de concessão, com cor pela urgência. */
function Prazo({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-muted/40">—</span>;
  if (dias < 0)
    return <span className="font-medium text-critical">vencida há {num(-dias)} dias</span>;
  return (
    <span className={dias <= 120 ? "text-warning" : "text-muted"}>faltam {num(dias)} dias</span>
  );
}

export default function ControleFeriasPage() {
  const { filtros, qs } = useFiltros();
  const temEmpresa = filtros.empresas.length === 1;
  const res = useControleFerias(qs, temEmpresa);
  const dados = res.data;
  const [soPendentes, setSoPendentes] = useState(true);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return soPendentes
      ? dados.funcionarios.filter((f) => f.situacao === "vencida" || f.situacao === "a_vencer")
      : dados.funcionarios;
  }, [dados, soPendentes]);

  if (!temEmpresa) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Building2 className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Selecione uma empresa</p>
        <p className="max-w-md text-xs text-muted">
          O controle de férias é apurado de uma empresa por vez, na data de referência do período.
        </p>
      </section>
    );
  }

  if (res.isError) {
    return (
      <section className="card grid place-items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-critical/12 text-critical">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-sm font-medium text-ink">Não foi possível apurar as férias</p>
        <p className="max-w-md text-xs text-muted">
          {res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
        </p>
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Apurando os períodos aquisitivos…</p>
      </section>
    );
  }

  if (dados.resumo.ativos === 0) {
    return (
      <section className="card grid place-items-center px-6 py-14 text-center">
        <p className="text-sm text-muted">Nenhum empregado CLT ativo nesta empresa na data de referência.</p>
      </section>
    );
  }

  const { resumo } = dados;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Empregados ativos"
          icone={<Users className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={num(resumo.ativos)}
          secundario={`CLT ativos em ${dataBR(dados.referencia)}`}
        />
        <Kpi
          rotulo="Com férias vencidas"
          icone={<CalendarX2 className="size-4" />}
          corIcone="bg-critical/12 text-critical"
          valor={num(resumo.comVencidas)}
          secundario="Risco de pagamento em dobro"
          alerta={resumo.comVencidas > 0}
        />
        <Kpi
          rotulo="A vencer (120 dias)"
          icone={<CalendarClock className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={num(resumo.aVencer)}
          secundario="Programar antes do limite"
          alerta={resumo.aVencer > 0}
        />
        <Kpi
          rotulo="Períodos vencidos"
          icone={<Plane className="size-4" />}
          corIcone="bg-critical/12 text-critical"
          valor={num(resumo.periodosVencidos)}
          secundario="O passivo a zerar na empresa"
          alerta={resumo.periodosVencidos > 0}
        />
      </div>

      {/* Ressalva do método (o cálculo é derivado, a validar) */}
      <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-2" />
        <p>
          Cálculo <span className="font-medium text-ink">derivado</span> da admissão × férias já
          gozadas (recibos). Não considera afastamentos, faltas ou férias coletivas — é uma visão
          gerencial para priorizar; confirme o caso no Questor antes de agir.
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <p className="text-xs text-muted">
            Um período aquisitivo (12 meses) dá direito a 30 dias; a empresa tem mais 12 meses para
            conceder, senão paga em dobro.
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={soPendentes}
              onChange={(e) => setSoPendentes(e.target.checked)}
              className="size-3.5 accent-[var(--ent)]"
            />
            Só vencidas e a vencer
          </label>
        </div>

        {linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {soPendentes ? "Ninguém com férias vencidas ou a vencer. 👍" : "Sem funcionários."}
          </p>
        ) : (
          <div className="max-h-[38rem] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Funcionário</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                  <th className="px-2 py-2 font-medium">Direito desde</th>
                  <th className="px-2 py-2 font-medium">Limite p/ conceder</th>
                  <th className="px-4 py-2 font-medium">Últimas férias</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((f: FeriasFuncionario) => (
                  <tr key={f.contrato} className="border-b border-hairline/60 align-top last:border-0">
                    <td className="px-4 py-2">
                      <div className="truncate text-ink" title={f.funcionario}>
                        {f.funcionario}
                      </div>
                      <div className="text-[11px] text-muted">admitido {dataBR(f.admissao)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={clsx("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", COR[f.situacao])}>
                        {ROTULO[f.situacao]}
                      </span>
                      {f.periodosAbertos > 1 && (
                        <div className="mt-1 text-[10px] text-muted">
                          {f.periodosAbertos} períodos em aberto
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-2">
                      {f.aquisitivoFim ? dataBR(f.aquisitivoFim) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">
                      {f.limiteConcessao ? (
                        <>
                          <div className="text-ink-2">{dataBR(f.limiteConcessao)}</div>
                          <div className="text-[11px]">
                            <Prazo dias={f.diasParaLimite} />
                          </div>
                        </>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">
                      {f.ultimasFerias ? dataBR(f.ultimasFerias) : "nunca gozou"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
