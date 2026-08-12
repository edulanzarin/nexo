"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { FichaModal, tempoCasa } from "@/components/folha-ficha-modal";
import { SeloEmpresa } from "@/components/rh-selo-empresa";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { mutar } from "@/hooks/mutar";
import { useRhFuncionarios, useRhSetores } from "@/hooks/use-api";
import { useEstadoModulo } from "@/hooks/use-estado-modulo";
import { EMPRESAS_RH, nomeEmpresaRh } from "@/lib/rh";
import { dataBR } from "@/lib/format";
import type { FuncionarioDiretorio, SetorRh } from "@/lib/rh-tipos";

type FiltroEmpresa = "todas" | "pj" | number;

function diasDeCasa(dataadm: string): number {
  const t = Date.parse(dataadm);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function Conteudo() {
  // Nada consulta até o Visualizar (padrão executar-por-botão): o fetch da lista
  // só dispara depois do clique; empresa/setor/busca filtram no cliente.
  const [aplicado, setAplicado] = useEstadoModulo("rh/diretorio:aplicado", false);
  const { data, isLoading, isFetching } = useRhFuncionarios(aplicado);
  // Lista de setores é METADADO de filtro (lookup leve): carrega sempre, sem o
  // gatilho — assim o dropdown de setor aparece de cara. A contagem por setor
  // depende dos funcionários e só entra depois do Visualizar.
  const { data: setoresLookup } = useRhSetores();
  const queryClient = useQueryClient();
  const [empresa, setEmpresa] = useEstadoModulo<FiltroEmpresa>("rh/diretorio:empresa", "todas");
  const [classif, setClassif] = useEstadoModulo<string | null>("rh/diretorio:classif", null);
  const [busca, setBusca] = useEstadoModulo("rh/diretorio:busca", "");
  const [novoPj, setNovoPj] = useState(false);

  const executar = () => {
    setAplicado(true);
    queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
  };

  const todos = useMemo(() => data ?? [], [data]);

  const porEmpresa = useMemo(() => {
    if (empresa === "pj") return todos.filter((f) => f.origem === "pj");
    if (empresa === "todas") return todos;
    return todos.filter((f) => f.codigoempresa === empresa);
  }, [todos, empresa]);

  // Contagem por setor na empresa atual — só faz sentido com os dados carregados.
  const contagemSetor = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of porEmpresa) {
      const k = f.classiforgan ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [porEmpresa]);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return porEmpresa.filter((f) => {
      if (classif && (f.classiforgan ?? "—") !== classif) return false;
      if (q && !normalizar(`${f.nome} ${f.cargo ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [porEmpresa, classif, busca]);

  const contagem = useMemo(() => {
    const c: Record<number, number> = {};
    for (const cod of EMPRESAS_RH) c[cod] = 0;
    for (const f of todos) c[f.codigoempresa] = (c[f.codigoempresa] ?? 0) + 1;
    return c;
  }, [todos]);

  const qtdPj = useMemo(() => todos.filter((f) => f.origem === "pj").length, [todos]);

  const [aberto, setAberto] = useState<FuncionarioDiretorio | null>(null);

  const segmentos: { valor: FiltroEmpresa; rotulo: string; qtd: number }[] = [
    { valor: "todas", rotulo: "Todas", qtd: todos.length },
    ...EMPRESAS_RH.map((cod) => ({
      valor: cod as FiltroEmpresa,
      rotulo: nomeEmpresaRh(cod),
      qtd: contagem[cod] ?? 0,
    })),
    { valor: "pj", rotulo: "PJ", qtd: qtdPj },
  ];

  return (
    <>
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {segmentos.map((s) => (
            <button
              key={String(s.valor)}
              onClick={() => {
                setEmpresa(s.valor);
                setClassif(null);
              }}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                empresa === s.valor ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
            >
              {s.rotulo}
              {data && (
                <span className="ml-1.5 tabular-nums text-xs text-muted">{s.qtd}</span>
              )}
            </button>
          ))}
          </div>

          {/* Setor: dropdown a partir do lookup (aparece de cara, sem esperar o
              Visualizar); a contagem por setor só entra depois de carregar. */}
          {(setoresLookup?.length ?? 0) > 0 && (
            <Dropdown
              rotulo={
                classif === null
                  ? "Todos os setores"
                  : (setoresLookup?.find((s) => s.classiforgan === classif)?.nome ?? classif)
              }
              ativo={classif !== null}
              largura="w-72"
            >
              {(fechar) => (
                <div className="max-h-72 overflow-y-auto py-1">
                  <ItemLista
                    selecionado={classif === null}
                    onClick={() => {
                      setClassif(null);
                      fechar();
                    }}
                  >
                    <span className="grid size-4 place-items-center">
                      {classif === null && <Check className="size-4 stroke-[3] text-ent" />}
                    </span>
                    <span className="flex-1">Todos os setores</span>
                    {data && (
                      <span className="tabular-nums text-xs text-muted">{porEmpresa.length}</span>
                    )}
                  </ItemLista>
                  {setoresLookup!.map((s) => {
                    const n = contagemSetor.get(s.classiforgan);
                    return (
                      <ItemLista
                        key={s.classiforgan}
                        selecionado={classif === s.classiforgan}
                        onClick={() => {
                          setClassif(s.classiforgan);
                          fechar();
                        }}
                      >
                        <span className="grid size-4 place-items-center">
                          {classif === s.classiforgan && (
                            <Check className="size-4 stroke-[3] text-ent" />
                          )}
                        </span>
                        <span className="flex-1 truncate">{s.nome}</span>
                        {data && n != null && (
                          <span className="tabular-nums text-xs text-muted">{n}</span>
                        )}
                      </ItemLista>
                    );
                  })}
                </div>
              )}
            </Dropdown>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNovoPj(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2"
          >
            <Plus className="size-4" /> Adicionar PJ
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou cargo…"
              className="h-9 w-64 rounded-lg border border-hairline bg-surface pl-8 pr-3 text-sm outline-none placeholder:text-muted focus:border-ink/30"
            />
          </div>
          <BotaoExecutar onClick={executar} dirty={!aplicado} rotulo="Visualizar" />
        </div>
      </div>

      {!aplicado ? (
        <FiltroPendente rotulo="Visualizar" />
      ) : (
      <>
      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <p className="text-sm text-muted">
            {isLoading ? "Carregando…" : `${filtrados.length} colaborador${filtrados.length === 1 ? "" : "es"}`}
          </p>
        </div>
        <div className={clsx("max-h-[38rem] overflow-y-auto overflow-x-auto", isFetching && "refetching")}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pl-4 pr-3 text-left font-medium">Colaborador</th>
                <th className="py-2 px-3 text-left font-medium">Empresa</th>
                <th className="py-2 px-3 text-left font-medium">Cargo · Setor</th>
                <th className="py-2 px-3 text-right font-medium">Admissão</th>
                <th className="py-2 pl-3 pr-4 text-right font-medium">Tempo de casa</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((f) => (
                <tr
                  key={`${f.codigoempresa}-${f.contrato}`}
                  onClick={() => setAberto(f)}
                  className="cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-surface-2/50"
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                        <UserRound className="size-3.5" />
                      </span>
                      <span className="font-medium text-ink">{f.nome}</span>
                      {f.origem === "pj" && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                          PJ
                        </span>
                      )}
                      {f.editado && (
                        <span title="Corrigido no RH">
                          <Pencil className="size-3 text-muted" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <SeloEmpresa codigo={f.codigoempresa} />
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="text-ink-2">{f.cargo ?? "—"}</p>
                    <p className="text-[11px] text-muted">{f.setor ?? "—"}</p>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-2">
                    {f.dataadm ? dataBR(f.dataadm) : "—"}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right tabular-nums text-ink-2">
                    {f.dataadm ? tempoCasa(diasDeCasa(f.dataadm)) : "—"}
                  </td>
                </tr>
              ))}
              {!isLoading && filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted">
                    Nenhum colaborador no filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      <FichaModal
        modulo="rh"
        empresa={aberto?.codigoempresa ?? null}
        contrato={aberto?.contrato ?? null}
        onFechar={() => setAberto(null)}
      />

      {novoPj && (
        <ModalNovoPj
          setores={setoresLookup ?? []}
          onFechar={() => setNovoPj(false)}
          onCriado={() => {
            queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
            queryClient.invalidateQueries({ queryKey: ["rh-setores"] });
            setNovoPj(false);
          }}
        />
      )}
    </>
  );
}

// ── Cadastro de pessoa PJ ─────────────────────────────────────────────────────

const INPUT =
  "h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30";

function ModalNovoPj({
  setores,
  onFechar,
  onCriado,
}: {
  setores: SetorRh[];
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [codigoempresa, setCodigoempresa] = useState<number>(EMPRESAS_RH[0]);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [classiforgan, setClassiforgan] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [temExperiencia, setTemExperiencia] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSalvando(true);
    try {
      await mutar("/api/rh/pessoa-pj", "POST", {
        codigoempresa,
        nome,
        cargo,
        classiforgan: classiforgan || null,
        cpfCnpj,
        email,
        dataInicio: dataInicio || null,
        temExperiencia,
      });
      toast.success("Pessoa PJ adicionada");
      onCriado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto onFechar={onFechar} largura="max-w-lg" titulo="Adicionar pessoa PJ">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wide text-muted">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${INPUT} mt-0.5`} autoFocus />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">Empresa</label>
          <select
            value={codigoempresa}
            onChange={(e) => setCodigoempresa(Number(e.target.value))}
            className={`${INPUT} mt-0.5`}
          >
            {EMPRESAS_RH.map((cod) => (
              <option key={cod} value={cod}>
                {nomeEmpresaRh(cod)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">Setor</label>
          <select
            value={classiforgan}
            onChange={(e) => setClassiforgan(e.target.value)}
            className={`${INPUT} mt-0.5`}
          >
            <option value="">— sem setor —</option>
            {setores.map((s) => (
              <option key={s.classiforgan} value={s.classiforgan}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">Cargo</label>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={`${INPUT} mt-0.5`} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">CPF/CNPJ</label>
          <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={`${INPUT} mt-0.5`} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={`${INPUT} mt-0.5`} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">Início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={`${INPUT} mt-0.5`} />
        </div>
        <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={temExperiencia}
            onChange={(e) => setTemExperiencia(e.target.checked)}
            className="mt-0.5 size-3.5 accent-ink"
          />
          <span className="text-xs text-ink-2">
            Tem contrato de experiência
            <span className="block text-[11px] text-muted">
              Entra no painel de Experiência com os marcos de 45 e 90 dias a partir da data de início.
            </span>
          </span>
        </label>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-3">
        <button
          onClick={onFechar}
          className="flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Cancelar
        </button>
        <button
          onClick={criar}
          disabled={salvando}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Adicionar
        </button>
      </footer>
    </Modal>
  );
}
