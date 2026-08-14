"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarX2,
  CheckCircle2,
  HandCoins,
  Info,
  Mail,
  Plus,
  Settings,
  Trash2,
  Undo2,
} from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { Badge, Button, Card, EmptyState, IconButton, Modal } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFiltros } from "@/hooks/use-filters";
import { useRescisoes, useRescisoesConfig, useRescisoesDestinatarios } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR, num } from "@/lib/format";
import type { RescisaoItem, RescisaoSituacao } from "@/lib/rescisoes-tipos";

const ROTULO: Record<RescisaoSituacao, string> = {
  vencida: "Vencida",
  vence_breve: "Vence em breve",
  no_prazo: "No prazo",
  resolvida: "Paga",
};
const TOM: Record<RescisaoSituacao, BadgeTone> = {
  vencida: "critical",
  vence_breve: "warning",
  no_prazo: "ent",
  resolvida: "good",
};

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Prazo até (ou desde) o limite de pagamento, com cor pela urgência. */
function Prazo({ item }: { item: RescisaoItem }) {
  if (item.situacao === "resolvida") {
    return <span className="text-good">paga {item.resolvidaEm ? dataBR(item.resolvidaEm) : ""}</span>;
  }
  const d = item.diasParaPrazo ?? 0;
  if (d < 0) return <span className="font-medium text-critical">vencida há {num(-d)} dia(s)</span>;
  if (d === 0) return <span className="font-medium text-critical">vence hoje</span>;
  return <span className={d <= 3 ? "text-warning" : "text-muted"}>faltam {num(d)} dia(s)</span>;
}

/** Sinal do Questor: folha de rescisão calculada e pagamento previsto (informativo). */
function SinalQuestor({ item }: { item: RescisaoItem }) {
  if (!item.calculada) return <span className="text-critical/80">rescisão não calculada</span>;
  if (item.pgtoPrevisto)
    return <span className="text-muted">calculada · pgto previsto {dataBR(item.pgtoPrevisto)}</span>;
  return <span className="text-muted">folha calculada</span>;
}

export default function RescisoesPage() {
  const qc = useQueryClient();
  const { qs } = useFiltros();
  const res = useRescisoes(qs);
  const dados = res.data;
  const [soPendentes, setSoPendentes] = useState(true);
  const [config, setConfig] = useState(false);
  const [resolver, setResolver] = useState<RescisaoItem | null>(null);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return soPendentes ? dados.itens.filter((i) => i.situacao !== "resolvida") : dados.itens;
  }, [dados, soPendentes]);

  const reabrir = (item: RescisaoItem) => {
    mutar("/api/folha/rescisoes/resolver", "DELETE", {
      codigoempresa: item.codigoempresa,
      codigofunccontr: item.contrato,
    })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["rescisoes"] });
        toast.success("Rescisão reaberta");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao reabrir"));
  };

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível carregar as rescisões"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <section className="card grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted">Levantando as rescisões do período…</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Pendentes"
          icone={<HandCoins className="size-4" />}
          corIcone="bg-ent/12 text-ent"
          valor={num(dados.pendentes)}
          secundario={`De ${num(dados.total)} rescisões no período`}
        />
        <Kpi
          rotulo="Vencidas"
          icone={<CalendarX2 className="size-4" />}
          corIcone="bg-critical/12 text-critical"
          valor={num(dados.vencidas)}
          secundario={`Passaram do prazo de ${dados.prazoDias} dias`}
          alerta={dados.vencidas > 0}
        />
        <Kpi
          rotulo="Vencem em breve"
          icone={<AlertTriangle className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={num(dados.venceBreve)}
          secundario={`A ${dados.diasAntes} dia(s) ou menos do prazo`}
          alerta={dados.venceBreve > 0}
        />
        <Kpi
          rotulo="Pagas"
          icone={<CheckCircle2 className="size-4" />}
          corIcone="bg-good/12 text-good"
          valor={num(dados.resolvidas)}
          secundario="Marcadas como quitadas/homologadas"
        />
      </div>

      {/* Ressalva do método */}
      <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-2 px-4 py-3 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-ink-2" />
        <p>
          Prazo de <span className="font-medium text-ink">{dados.prazoDias} dias</span> a partir do
          desligamento (CLT art. 477: verbas em até 10 dias). Conta empregados CLT e ignora
          transferências. O Questor mostra se a folha foi calculada e o pagamento previsto, mas quem
          fecha o item é a marcação <span className="font-medium text-ink">Paga</span> — confirme no
          Questor antes de marcar.
        </p>
      </div>

      <Card as="section" overflow padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={soPendentes}
              onChange={(e) => setSoPendentes(e.target.checked)}
              className="size-3.5 accent-[var(--ent)]"
            />
            Só pendentes
          </label>
          <Button variant="ghost" size="sm" onClick={() => setConfig(true)}>
            <Settings className="size-3.5" /> Prazo e avisos
          </Button>
        </div>

        {linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {soPendentes ? "Nenhuma rescisão pendente no período. 👍" : "Nenhuma rescisão no período."}
          </p>
        ) : (
          <div className="max-h-[38rem] overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Funcionário</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                  <th className="px-2 py-2 font-medium">Desligamento</th>
                  <th className="px-2 py-2 font-medium">Prazo</th>
                  <th className="px-2 py-2 font-medium">Questor</th>
                  <th className="px-4 py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((i) => (
                  <tr
                    key={`${i.codigoempresa}:${i.contrato}`}
                    className="border-b border-hairline/60 align-top last:border-0"
                  >
                    <td className="px-4 py-2">
                      <div className="truncate text-ink" title={i.funcionario}>
                        {i.funcionario}
                      </div>
                      <div className="truncate text-[11px] text-muted" title={i.empresa}>
                        {i.empresa}
                        {i.causa ? ` · ${i.causa}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={TOM[i.situacao]} size="xs">
                        {ROTULO[i.situacao]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-2">
                      {dataBR(i.dataDesligamento)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">
                      <div className="text-ink-2">{dataBR(i.prazo)}</div>
                      <div className="text-[11px]">
                        <Prazo item={i} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-[11px]">
                      <SinalQuestor item={i} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {i.situacao === "resolvida" ? (
                        <Button variant="ghost" size="sm" onClick={() => reabrir(i)}>
                          <Undo2 className="size-3.5" /> Reabrir
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" onClick={() => setResolver(i)}>
                          <Banknote className="size-3.5" /> Marcar paga
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ResolverModal item={resolver} onFechar={() => setResolver(null)} />
      <ConfigModal aberto={config} onFechar={() => setConfig(false)} />
    </div>
  );
}

/** Modal de marcação de "paga": data do pagamento + observação. */
function ResolverModal({ item, onFechar }: { item: RescisaoItem | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!item) return;
    setSalvando(true);
    try {
      await mutar("/api/folha/rescisoes/resolver", "POST", {
        codigoempresa: item.codigoempresa,
        codigofunccontr: item.contrato,
        resolvidaEm: data,
        observacao: obs,
      });
      qc.invalidateQueries({ queryKey: ["rescisoes"] });
      toast.success("Rescisão marcada como paga");
      onFechar();
      setObs("");
      setData(hoje());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao marcar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={item != null} onFechar={onFechar} titulo="Marcar rescisão como paga" largura="max-w-md">
      {item && (
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm">
            <div className="font-medium text-ink">{item.funcionario}</div>
            <div className="text-xs text-muted">
              {item.empresa} · desligado em {dataBR(item.dataDesligamento)}
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Data do pagamento/homologação</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Observação (opcional)</span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Ex.: pago em folha 60, homologado no sindicato…"
              className="w-full rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm outline-none focus:border-ink/30"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={confirmar} disabled={salvando}>
              <Banknote className="size-3.5" /> Confirmar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Modal de configuração: prazo, antecedência do aviso e destinatários. */
function ConfigModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const cfg = useRescisoesConfig(aberto);
  const dest = useRescisoesDestinatarios(aberto);
  const [prazo, setPrazo] = useState<number | "">("");
  const [antes, setAntes] = useState<number | "">("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Preenche os campos quando a config chega (sem sobrescrever edição em curso).
  const prazoAtual = prazo === "" ? (cfg.data?.prazoDias ?? "") : prazo;
  const antesAtual = antes === "" ? (cfg.data?.diasAntes ?? "") : antes;

  const salvarConfig = async () => {
    setSalvando(true);
    try {
      await mutar("/api/folha/rescisoes-config", "PUT", {
        prazoDias: Number(prazoAtual),
        diasAntes: Number(antesAtual),
      });
      qc.invalidateQueries({ queryKey: ["rescisoes-config"] });
      qc.invalidateQueries({ queryKey: ["rescisoes"] });
      toast.success("Configuração salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const invalidarDest = () => qc.invalidateQueries({ queryKey: ["rescisoes-destinatarios"] });

  const addDest = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    try {
      await mutar("/api/folha/rescisoes-destinatarios", "POST", { nome, email });
      setNome("");
      setEmail("");
      invalidarDest();
      toast.success("Destinatário adicionado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar");
    }
  };

  const toggleDest = async (id: number, ativo: boolean) => {
    try {
      await mutar("/api/folha/rescisoes-destinatarios", "PATCH", { id, ativo });
      invalidarDest();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  };

  const removeDest = async (id: number, nomeD: string) => {
    try {
      await mutar(`/api/folha/rescisoes-destinatarios?id=${id}`, "DELETE");
      invalidarDest();
      toast.success(`${nomeD} removido`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Prazo e avisos de rescisão" largura="max-w-lg">
      <div className="space-y-5 p-5">
        {/* Prazo */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-ink">Prazo de pagamento</h4>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Dias após o desligamento</span>
              <input
                type="number"
                min={1}
                max={90}
                value={prazoAtual}
                onChange={(e) => setPrazo(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Avisar com antecedência de</span>
              <input
                type="number"
                min={0}
                max={30}
                value={antesAtual}
                onChange={(e) => setAntes(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30"
              />
            </label>
            <Button variant="primary" size="sm" onClick={salvarConfig} disabled={salvando}>
              Salvar
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            CLT art. 477: verbas rescisórias em até 10 dias do fim do contrato.
          </p>
        </div>

        {/* Destinatários */}
        <div>
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
            <Mail className="size-3.5" /> Quem recebe os avisos
          </h4>
          <p className="mb-2 text-xs text-muted">
            O time do DP avisado por e-mail quando uma rescisão vence ou está por vencer.
          </p>
          <div className="divide-y divide-hairline/60 rounded-lg border border-hairline">
            {(dest.data ?? []).length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">Ninguém cadastrado ainda.</p>
            )}
            {(dest.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex min-w-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.ativo}
                    onChange={(e) => toggleDest(d.id, e.target.checked)}
                    className="size-3.5 accent-[var(--ent)]"
                  />
                  <span className="min-w-0">
                    <span className={`block truncate text-sm ${d.ativo ? "text-ink" : "text-muted line-through"}`}>
                      {d.nome}
                    </span>
                    <span className="block truncate text-xs text-muted">{d.email}</span>
                  </span>
                </label>
                <IconButton tone="danger" size="sm" onClick={() => removeDest(d.id, d.nome)} aria-label="Remover">
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="h-9 w-1/3 rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDest()}
              placeholder="e-mail@navecon.com.br"
              className="h-9 flex-1 rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30"
            />
            <Button variant="primary" size="sm" onClick={addDest} className="shrink-0">
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
