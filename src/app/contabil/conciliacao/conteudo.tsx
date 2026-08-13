"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Download,
  FileUp,
  Landmark,
  ShieldCheck,
  X,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { ContaDropdown } from "@/components/conta-dropdown";
import { HistoricoDropdown } from "@/components/historico-dropdown";
import { Kpi } from "@/components/kpi-conf";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { brl, dataBR, num } from "@/lib/format";
import { resumir, type Ajustes, type Previa } from "@/lib/extrato-previa";
import type { Sentido } from "@/lib/regras-extrato";

type Filtro = "todos" | "prontos" | "pendentes";

/**
 * Exibição da importação: KPIs, consistência de saldo e lançamentos gerados.
 * Os controles (conta, extrato, senha, Executar) moram na linha da barra de
 * filtros — renderizados pelo shell — e compartilham o estado da seção com
 * esta página, então o que se escolhe lá aparece aqui na hora.
 */
export default function ImportarPage() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  // Sobrevive à ida e volta para a aba Regras — o extrato lido é trabalho, não
  // dá para pedir o arquivo de novo só porque o usuário foi cadastrar a regra.
  const [previa, setPrevia] = useEstadoSecao<Previa | null>("extrato", null);
  const [ajustes, setAjustes] = useEstadoSecao<Ajustes>("ajustes", {});
  const [filtro, setFiltro] = useEstadoSecao<Filtro>("filtro", "todos");
  // Parâmetros da exportação (sobrevivem à navegação na seção).
  const [estab, setEstab] = useEstadoSecao<string>("estab", "1");
  const [historico, setHistorico] = useEstadoSecao<number | null>("historicoConc", null);
  const [gerando, setGerando] = useState(false);
  // Índices cujo ajuste manual já virou regra — para trocar o botão por "salva".
  const [salvas, setSalvas] = useState<Set<number>>(new Set());
  // Novo extrato zera as regras salvas nesta prévia (os índices são de outro):
  // reset em render comparando a chave, não em efeito (evita render em cascata).
  const [arquivoSalvas, setArquivoSalvas] = useState<string | null>(null);
  if (previa && arquivoSalvas !== previa.arquivo) {
    setArquivoSalvas(previa.arquivo);
    setSalvas(new Set());
  }

  function ajustar(indice: number, contaEscolhida: number | null) {
    const novos = { ...ajustes };
    if (contaEscolhida == null) delete novos[indice];
    else novos[indice] = contaEscolhida;
    setAjustes(novos);
    if (previa) setPrevia({ ...previa, resumo: resumir(previa.lancamentos, novos) });
  }

  const visiveis = useMemo(() => {
    if (!previa) return [];
    return previa.lancamentos
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => {
        const resolvido = !l.pendencia || ajustes[i] != null;
        return filtro === "todos" ? true : filtro === "prontos" ? resolvido : !resolvido;
      });
  }, [previa, ajustes, filtro]);

  // Lançamentos prontos para o arquivo: sem pendência, ou com a conta escolhida
  // à mão, e com os dois lados da partida resolvidos.
  const prontos = useMemo(() => {
    if (!previa) return [];
    return previa.lancamentos
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => !l.pendencia || ajustes[i] != null)
      .map(({ l, i }) => {
        const ajuste = ajustes[i] ?? null;
        const contaDebito = l.contaDebito ?? (l.sentido === "pagamento" ? ajuste : null);
        const contaCredito = l.contaCredito ?? (l.sentido === "recebimento" ? ajuste : null);
        return { data: l.data, contaDebito, contaCredito, complemento: l.historico, valor: l.valor };
      })
      .filter(
        (l): l is { data: string; contaDebito: number; contaCredito: number; complemento: string; valor: number } =>
          l.contaDebito != null && l.contaCredito != null
      );
  }, [previa, ajustes]);

  /** Salva o ajuste manual como regra da conta, para casar sozinho na próxima. */
  async function salvarComoRegra(indice: number, descricao: string, sentido: Sentido, conta: number) {
    if (!previa) return;
    // Sufixo de data ("… 30/06") é volátil — fora do termo, a regra casa sempre.
    const termo = descricao.replace(/\s+\d{2}\/\d{2}(\/\d{4})?\s*$/, "").trim() || descricao;
    try {
      const res = await fetch("/api/contabil/extrato-regras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          empresa,
          conta: previa.contaBanco.conta,
          termo,
          tipo: "parcial",
          contaPagamento: sentido === "pagamento" ? conta : null,
          contaRecebimento: sentido === "recebimento" ? conta : null,
          historico: null,
          ativo: true,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao salvar a regra");
      setSalvas((s) => new Set(s).add(indice));
      toast.success(`Regra salva: "${termo}" — use Reaplicar regras para valer nesta prévia`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar a regra");
    }
  }

  async function gerar() {
    if (!previa || !prontos.length || historico == null) return;
    setGerando(true);
    try {
      const res = await fetch("/api/contabil/conciliacao-gerar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          empresa,
          estab: Number(estab),
          codigoHistorico: historico,
          lancamentos: prontos,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao gerar o arquivo");
      const blob = new Blob([corpo.arquivo], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conciliacao_${empresa}_${previa.contaBanco.conta}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${corpo.linhas} lançamentos exportados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o arquivo");
    } finally {
      setGerando(false);
    }
  }

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }

  const r = previa?.resumo;

  if (!previa || !r) {
    return <EmptyState icon={<FileUp className="size-6" />} titulo="Nenhum extrato processado" />;
  }

  const pendentes = previa.lancamentos.length - prontos.length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Transações lidas"
          icone={<FileUp className="size-4 text-ent" />}
          corIcone="bg-ent/12"
          valor={num(r.total)}
          secundario={
            previa.inicio && previa.fim
              ? `${dataBR(previa.inicio)} – ${dataBR(previa.fim)}`
              : (previa.banco ?? "")
          }
        />
        <Kpi
          rotulo="Prontas para lançar"
          icone={<CheckCircle2 className="size-4 text-good" />}
          corIcone="bg-good/12"
          valor={num(r.prontos)}
          secundario={`${((r.prontos / r.total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do extrato`}
        />
        <Kpi
          rotulo="Sem conta"
          icone={<AlertTriangle className="size-4 text-warn" />}
          corIcone="bg-warn/12"
          valor={num(r.semRegra + r.semConta)}
          secundario={
            r.semConta > 0
              ? `${num(r.semConta)} com regra mas sem conta no sentido`
              : "descrições ainda não cadastradas"
          }
          alerta={r.semRegra + r.semConta > 0}
        />
        <Kpi
          rotulo="Movimento"
          icone={<Landmark className="size-4 text-ink-2" />}
          corIcone="bg-surface-2"
          valor={brl(r.entradas + r.saidas)}
          secundario={`${brl(r.entradas)} entradas · ${brl(Math.abs(r.saidas))} saídas`}
        />
      </div>

      {previa.saldoConfere !== null && (
        <p
          className={clsx(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
            previa.saldoConfere ? "bg-good/10 text-good" : "bg-warn/10 text-warn"
          )}
        >
          {previa.saldoConfere ? (
            <ShieldCheck className="mt-px size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px size-4 shrink-0" />
          )}
          <span>
            {previa.saldoConfere
              ? "Cadeia de saldos do extrato fecha do início ao fim — a leitura está consistente."
              : "A cadeia de saldos do extrato não fecha. Pode haver linha não lida — confira antes de usar."}
          </span>
        </p>
      )}

      <Card as="section">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Lançamentos gerados</h2>
            <p className="mt-0.5 text-xs text-muted">
              {previa.arquivo}
              {previa.banco ? ` · ${previa.banco}` : ""} · banco na conta{" "}
              {previa.contaBanco.conta}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {(["todos", "prontos", "pendentes"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={clsx(
                  "rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  filtro === f
                    ? "bg-accent/12 font-medium text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                )}
              >
                {f === "todos" ? "Todos" : f === "prontos" ? "Prontos" : "Pendentes"}
              </button>
            ))}
          </div>
        </header>

        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-hairline text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">Data</th>
                <th className="py-2 pr-3 text-left font-medium">Descrição no extrato</th>
                <th className="py-2 pr-3 text-left font-medium">Débito</th>
                <th className="py-2 pr-3 text-left font-medium">Crédito</th>
                <th className="py-2 pl-3 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ l, i }) => {
                const ajuste = ajustes[i] ?? null;
                const pendente = !!l.pendencia && ajuste == null;
                // O ajuste entra no lado que a contrapartida ocupa.
                const debito =
                  l.contaDebito ?? (l.sentido === "pagamento" ? ajuste : l.contaDebito);
                const credito =
                  l.contaCredito ?? (l.sentido === "recebimento" ? ajuste : l.contaCredito);

                return (
                  <tr
                    key={i}
                    className="border-b border-hairline/60 align-top last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-ink-2">
                      {dataBR(l.data)}
                    </td>
                    <td className="max-w-[340px] py-2.5 pr-3">
                      <span className="block truncate text-ink" title={l.descricao}>
                        {l.descricao}
                      </span>
                      {pendente && (
                        <Badge tone="warning" size="xs" className="mt-0.5">
                          {l.pendencia === "sem_regra"
                            ? "Sem regra cadastrada"
                            : `Regra não define conta para ${l.sentido}`}
                        </Badge>
                      )}
                      {ajuste != null && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone="ent" size="xs">
                            Conta escolhida à mão
                            <button
                              onClick={() => ajustar(i, null)}
                              title="Desfazer"
                              className="hover:text-ink"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                          {salvas.has(i) ? (
                            <Badge tone="good" size="xs">
                              <Check className="size-3" />
                              Regra salva
                            </Badge>
                          ) : (
                            <button
                              onClick={() => salvarComoRegra(i, l.descricao, l.sentido, ajuste)}
                              title="Cadastra esta descrição como regra para casar sozinha na próxima importação"
                              className="inline-flex items-center gap-1 rounded border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-ink-2 transition-colors hover:border-accent/40 hover:text-accent"
                            >
                              <BookmarkPlus className="size-3" />
                              Salvar como regra
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {l.sentido === "pagamento" && l.contaDebito == null ? (
                        <ContaDropdown
                          empresa={empresa}
                          valor={ajuste}
                          onMudar={(c) => ajustar(i, c)}
                          placeholder="escolher"
                          limpavel
                          largura="w-96"
                        />
                      ) : (
                        (debito ?? <span className="text-muted">—</span>)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {l.sentido === "recebimento" && l.contaCredito == null ? (
                        <ContaDropdown
                          empresa={empresa}
                          valor={ajuste}
                          onMudar={(c) => ajustar(i, c)}
                          placeholder="escolher"
                          limpavel
                          largura="w-96"
                        />
                      ) : (
                        (credito ?? <span className="text-muted">—</span>)
                      )}
                    </td>
                    <td
                      className={clsx(
                        "py-2.5 pl-3 text-right font-semibold tabular-nums",
                        l.sentido === "recebimento" ? "text-good" : "text-ink"
                      )}
                    >
                      {l.sentido === "recebimento" ? "+" : "−"} {brl(l.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Exportação: gera o arquivo de importação do Questor (mesmo layout .nli
          da Implantação). Só os prontos entram; a pendência fica de fora. */}
      <Card as="section" animate="none" className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-2">Filial</span>
            <input
              value={estab}
              onChange={(e) => setEstab(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="h-9 w-14 rounded-lg border border-hairline bg-surface px-2 text-center text-sm text-ink outline-none focus:border-accent/50"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-2">Histórico do lançamento</span>
            <HistoricoDropdown valor={historico} onMudar={(h) => setHistorico(h?.codigo ?? null)} />
          </label>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="primary"
            size="lg"
            onClick={gerar}
            disabled={gerando || !prontos.length || historico == null || !estab}
            title={
              !prontos.length
                ? "Nenhum lançamento pronto para exportar"
                : historico == null
                  ? "Escolha o histórico do lançamento"
                  : undefined
            }
          >
            <Download className="size-4" />
            Gerar arquivo do Questor
          </Button>
          <p className="text-[11px] text-muted">
            {num(prontos.length)} {prontos.length === 1 ? "lançamento pronto" : "lançamentos prontos"}
            {pendentes > 0 && ` · ${num(pendentes)} ${pendentes === 1 ? "pendente fica" : "pendentes ficam"} de fora`}
          </p>
        </div>
      </Card>
    </>
  );
}
