"use client";

import { useMemo } from "react";
import { Building2, Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { Badge, Card, EmptyState } from "@/components/ui";
import { tempoCasa } from "@/components/folha-ficha-modal";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { useFuncionariosContabil } from "@/hooks/use-api";
import { dataBR, num } from "@/lib/format";
import { normalizar } from "@/lib/folha-casamento";

/**
 * Quadro de funcionários da empresa, dentro do Contábil.
 *
 * Existe para uma pergunta só: o favorecido daquele pagamento é funcionário? A
 * Conciliação já responde sozinha na linha do extrato (ver folha-casamento) —
 * esta tela é para quando a dúvida vem de fora dela: uma nota, um pedido do
 * cliente, um nome que alguém mandou por mensagem.
 *
 * Não mostra remuneração de propósito: para a decisão de conta basta o vínculo,
 * e quem precisa de salário tem o módulo DP e a permissão dele.
 */
export default function FuncionariosContabilPage() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [busca, setBusca] = useEstadoSecao("func-busca", "");
  const [desligados, setDesligados] = useEstadoSecao("func-desligados", false);

  const { data, isLoading, isFetching } = useFuncionariosContabil(
    empresa,
    desligados,
    temEmpresa
  );

  const linhas = useMemo(() => data?.linhas ?? [], [data]);

  // Busca no cliente: a lista inteira já veio, e o contábil digita pedaço de
  // nome ("MARIA SANT") ou os dígitos do CPF que o extrato mostrou.
  const filtrados = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return linhas;
    const digitos = busca.replace(/\D/g, "");
    return linhas.filter((f) => {
      if (normalizar(f.nome).includes(q)) return true;
      if (digitos.length >= 3 && (f.cpf ?? "").replace(/\D/g, "").includes(digitos)) return true;
      return normalizar(`${f.cargo ?? ""} ${f.setor ?? ""}`).includes(q);
    });
  }, [linhas, busca]);

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {[
            { valor: false, rotulo: "Ativos", qtd: data?.ativos },
            { valor: true, rotulo: "Com desligados", qtd: data ? data.ativos + data.desligados : undefined },
          ].map((s) => (
            <button
              key={String(s.valor)}
              onClick={() => setDesligados(s.valor)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                desligados === s.valor ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
            >
              {s.rotulo}
              {s.qtd != null && (
                <span className="ml-1.5 tabular-nums text-xs text-muted">{num(s.qtd)}</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, CPF, cargo ou setor…"
            className="h-9 w-72 rounded-lg border border-hairline bg-surface pl-8 pr-3 text-sm outline-none placeholder:text-muted focus:border-ink/30"
          />
        </div>
      </div>

      <Card overflow padding="none" animate="none">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <p className="text-sm text-muted">
            {isLoading
              ? "Carregando…"
              : `${num(filtrados.length)} ${filtrados.length === 1 ? "vínculo" : "vínculos"}`}
          </p>
          <p className="text-xs text-muted">
            Conta-se por vínculo: a mesma pessoa com dois contratos aparece duas vezes
          </p>
        </div>

        {!isLoading && !filtrados.length ? (
          <div className="px-4 py-14">
            <EmptyState
              icon={<UserRound className="size-6" />}
              titulo={busca ? "Ninguém com esse nome nesta empresa" : "Empresa sem folha no Questor"}
            />
          </div>
        ) : (
          <div
            className={clsx(
              "max-h-[38rem] overflow-y-auto overflow-x-auto",
              isFetching && "refetching"
            )}
          >
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="py-2 pl-4 pr-3 text-left font-medium">Colaborador</th>
                  <th className="py-2 px-3 text-left font-medium">Situação</th>
                  <th className="py-2 px-3 text-left font-medium">Cargo · Setor</th>
                  <th className="py-2 px-3 text-right font-medium">Admissão</th>
                  <th className="py-2 pl-3 pr-4 text-right font-medium">Tempo de casa</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr
                    key={f.contrato}
                    className="border-b border-hairline/60 align-top last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                          <UserRound className="size-3.5" />
                        </span>
                        <span>
                          <span className="block font-medium text-ink">{f.nome}</span>
                          <span className="block text-xs tabular-nums text-muted">
                            {f.cpf ?? "sem CPF"}
                            {f.estabelecimento ? ` · ${f.estabelecimento}` : ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {f.datadem ? (
                        <Badge tone="warning" size="xs">
                          Desligado em {dataBR(f.datadem)}
                        </Badge>
                      ) : (
                        <Badge tone="good" size="xs">
                          Ativo
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-ink-2">
                      {f.cargo ?? "—"}
                      {f.setor && <span className="text-muted"> · {f.setor}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 px-3 text-right tabular-nums text-ink-2">
                      {f.dataadm ? dataBR(f.dataadm) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right tabular-nums text-ink-2">
                      {tempoCasa(f.tempoCasaDias)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
