"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import { mutar } from "@/hooks/mutar";
import { StatusPmBadge } from "@/components/postmortem-badge";
import {
  CRITICIDADES,
  CRITICIDADE_DEF,
  CRITICIDADE_ROTULO,
  validarEnvio,
  type DadosPM,
  type Fatores,
  type GrupoOpcao,
  type Impactos,
  type RelatorioPM,
} from "@/lib/folha-postmortem-tipos";

const campo =
  "w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ent disabled:cursor-not-allowed disabled:opacity-70";
const campoMini =
  "w-full rounded-md border border-hairline bg-surface-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-ent disabled:opacity-70";

function Secao({
  n,
  titulo,
  sub,
  children,
}: {
  n: number | string;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <header className="mb-4 border-b border-hairline pb-3">
        <h2 className="text-sm font-semibold">
          <span className="mr-2 text-muted">{n}.</span>
          {titulo}
        </h2>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Campo({
  label,
  ajuda,
  children,
}: {
  label: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {ajuda && <span className="mt-1 block text-[11px] text-muted">{ajuda}</span>}
    </label>
  );
}

/** Tabela repetível de linhas (linha do tempo, ações): cada linha é um registro
 *  de strings; colunas descrevem os campos. Add/remove imutáveis. */
function Repetivel<T extends Record<string, string>>({
  titulo,
  rows,
  colunas,
  novo,
  onChange,
  somenteLeitura,
  addRotulo,
}: {
  titulo: string;
  rows: T[];
  colunas: { chave: keyof T & string; rotulo: string; tipo?: "date" | "text" }[];
  novo: () => T;
  onChange: (r: T[]) => void;
  somenteLeitura: boolean;
  addRotulo: string;
}) {
  const set = (i: number, chave: string, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [chave]: v } : r)));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-2">{titulo}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Nenhum item.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline/70 p-2"
            >
              {colunas.map((c) => (
                <label key={c.chave} className="min-w-[8rem] flex-1">
                  <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted">
                    {c.rotulo}
                  </span>
                  <input
                    type={c.tipo === "date" ? "date" : "text"}
                    value={r[c.chave]}
                    disabled={somenteLeitura}
                    onChange={(e) => set(i, c.chave, e.target.value)}
                    className={campoMini}
                  />
                </label>
              ))}
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-critical"
                  aria-label="Remover"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!somenteLeitura && (
        <button
          type="button"
          onClick={() => onChange([...rows, novo()])}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-3.5" /> {addRotulo}
        </button>
      )}
    </div>
  );
}

const ROTULO_IMPACTO: { chave: keyof Impactos; label: string }[] = [
  { chave: "financeiro", label: "Impacto financeiro (valores, se houver)" },
  { chave: "trabalhista", label: "Impacto trabalhista / legal (multas, passivo, risco de ação)" },
  { chave: "cliente", label: "Impacto ao cliente (relação, confiança, retrabalho)" },
  { chave: "funcionarios", label: "Impacto ao(s) funcionário(s) afetado(s)" },
  { chave: "reputacional", label: "Impacto reputacional / interno ao escritório" },
  { chave: "outros", label: "Outros impactos" },
];

const ROTULO_FATOR: { chave: keyof Fatores; label: string }[] = [
  { chave: "processo", label: "Processo (inexistente, incompleto ou não seguido)" },
  { chave: "pessoas", label: "Pessoas (treinamento, sobrecarga, distração)" },
  { chave: "sistema", label: "Sistema / Ferramenta (falha, limitação, configuração)" },
  { chave: "comunicacao", label: "Comunicação (entre setores, com o cliente, entre turnos)" },
  { chave: "prazo", label: "Prazo (urgência, acúmulo, prazo apertado)" },
];

export function FormularioPM({
  inicial,
  grupos,
  somenteLeitura,
}: {
  inicial: RelatorioPM;
  grupos: GrupoOpcao[];
  somenteLeitura: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<DadosPM>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const ro = somenteLeitura;

  const up = <K extends keyof DadosPM>(k: K, v: DadosPM[K]) => setD((p) => ({ ...p, [k]: v }));
  const upImpacto = (k: keyof Impactos, v: string) =>
    setD((p) => ({ ...p, impactos: { ...p.impactos, [k]: v } }));
  const upFator = (k: keyof Fatores, v: string) =>
    setD((p) => ({ ...p, fatores: { ...p.fatores, [k]: v } }));
  const upPorque = (i: number, v: string) =>
    setD((p) => ({ ...p, cincoPorques: p.cincoPorques.map((x, j) => (j === i ? v : x)) }));

  async function salvar() {
    setSalvando(true);
    try {
      await mutar(`/api/folha/post-mortem/${inicial.id}`, "PATCH", d);
      toast.success("Rascunho salvo");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function enviar() {
    const faltando = validarEnvio(d);
    if (faltando.length) {
      toast.error(`Preencha antes de enviar: ${faltando.join(", ")}`);
      return;
    }
    setEnviando(true);
    try {
      const { numero } = await mutar<{ numero: number }>(
        `/api/folha/post-mortem/${inicial.id}/enviar`,
        "POST",
        d
      );
      toast.success(`Enviado — Relatório nº ${String(numero).padStart(4, "0")}`);
      router.push("/folha/post-mortem");
    } catch (e) {
      toast.error((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/folha/post-mortem")}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {inicial.numero ? `Nº ${String(inicial.numero).padStart(4, "0")}` : "Rascunho"}
            </span>
            <StatusPmBadge status={inicial.status} />
          </div>
        </div>
        {!ro && (
          <div className="flex items-center gap-2">
            <button
              onClick={salvar}
              disabled={salvando || enviando}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-60"
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar rascunho
            </button>
            <button
              onClick={enviar}
              disabled={salvando || enviando}
              className="flex items-center gap-1.5 rounded-lg bg-ent px-3 py-2 text-xs font-medium text-white hover:bg-ent/90 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar relatório
            </button>
          </div>
        )}
      </div>

      {ro && (
        <div className="card border-ent/30 bg-ent/5 px-4 py-3 text-xs text-ink-2">
          {inicial.status === "enviado"
            ? "Relatório enviado — leitura apenas. Preenchido por " + inicial.autorNome + "."
            : "Você está vendo o rascunho de " + inicial.autorNome + " (leitura apenas)."}
        </div>
      )}

      {/* 1. Identificação */}
      <Secao n={1} titulo="Identificação do incidente">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Campo
            label="Criticidade"
            ajuda={d.criticidade ? CRITICIDADE_DEF[d.criticidade] : "Escala de impacto do erro"}
          >
            <select
              value={d.criticidade ?? ""}
              disabled={ro}
              onChange={(e) => up("criticidade", (e.target.value || null) as DadosPM["criticidade"])}
              className={campo}
            >
              <option value="">Selecione…</option>
              {CRITICIDADES.map((c) => (
                <option key={c} value={c}>
                  {CRITICIDADE_ROTULO[c]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Grupo">
            <select
              value={d.grupoId ?? ""}
              disabled={ro}
              onChange={(e) => up("grupoId", e.target.value ? Number(e.target.value) : null)}
              className={campo}
            >
              <option value="">Selecione…</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Analista responsável">
            <input value={inicial.autorNome} disabled className={campo} />
          </Campo>
          <Campo label="Cliente / Empresa afetada">
            <input
              value={d.empresaAfetada}
              disabled={ro}
              onChange={(e) => up("empresaAfetada", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo label="Nº de funcionários afetados">
            <input
              type="number"
              min={0}
              value={d.funcionariosAfetados ?? ""}
              disabled={ro}
              onChange={(e) =>
                up("funcionariosAfetados", e.target.value === "" ? null : Number(e.target.value))
              }
              className={campo}
            />
          </Campo>
          <Campo label="Processo / Rotina envolvida">
            <input
              value={d.processo}
              disabled={ro}
              onChange={(e) => up("processo", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo label="Data em que o erro ocorreu">
            <input
              type="date"
              value={d.dataOcorrido ?? ""}
              disabled={ro}
              onChange={(e) => up("dataOcorrido", e.target.value || null)}
              className={campo}
            />
          </Campo>
          <Campo label="Data em que foi identificado">
            <input
              type="date"
              value={d.dataIdentificado ?? ""}
              disabled={ro}
              onChange={(e) => up("dataIdentificado", e.target.value || null)}
              className={campo}
            />
          </Campo>
          <Campo label="Quem identificou o erro">
            <input
              value={d.quemIdentificou}
              disabled={ro}
              onChange={(e) => up("quemIdentificou", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo label="Como foi identificado">
            <input
              value={d.comoIdentificou}
              disabled={ro}
              onChange={(e) => up("comoIdentificou", e.target.value)}
              className={campo}
            />
          </Campo>
        </div>
      </Secao>

      {/* 2. Descrição */}
      <Secao n={2} titulo="Descrição do erro">
        <Campo label="O que aconteceu? (objetivo, sem julgamentos)">
          <textarea
            rows={4}
            value={d.descricao}
            disabled={ro}
            onChange={(e) => up("descricao", e.target.value)}
            className={campo}
          />
        </Campo>
        <Repetivel
          titulo="Linha do tempo dos eventos"
          rows={d.linhaTempo}
          colunas={[
            { chave: "data", rotulo: "Data / Hora" },
            { chave: "evento", rotulo: "Evento" },
            { chave: "responsavel", rotulo: "Responsável" },
          ]}
          novo={() => ({ data: "", evento: "", responsavel: "" })}
          onChange={(r) => up("linhaTempo", r)}
          somenteLeitura={ro}
          addRotulo="Adicionar evento"
        />
      </Secao>

      {/* 3. Impacto */}
      <Secao n={3} titulo="Impacto e consequências">
        <div className="grid gap-4 sm:grid-cols-2">
          {ROTULO_IMPACTO.map((imp) => (
            <Campo key={imp.chave} label={imp.label}>
              <textarea
                rows={2}
                value={d.impactos[imp.chave]}
                disabled={ro}
                onChange={(e) => upImpacto(imp.chave, e.target.value)}
                className={campo}
              />
            </Campo>
          ))}
        </div>
      </Secao>

      {/* 4. Causa raiz */}
      <Secao
        n={4}
        titulo="Análise de causa raiz"
        sub="Técnica dos 5 Porquês — parta do erro e pergunte “por quê” até a causa de fundo."
      >
        <div className="space-y-2">
          {d.cincoPorques.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted">Por quê {i + 1}</span>
              <input
                value={p}
                disabled={ro}
                onChange={(e) => upPorque(i, e.target.value)}
                className={campo}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROTULO_FATOR.map((f) => (
            <Campo key={f.chave} label={f.label}>
              <textarea
                rows={2}
                value={d.fatores[f.chave]}
                disabled={ro}
                onChange={(e) => upFator(f.chave, e.target.value)}
                className={campo}
              />
            </Campo>
          ))}
        </div>
        <Campo label="Causa raiz identificada">
          <textarea
            rows={3}
            value={d.causaRaiz}
            disabled={ro}
            onChange={(e) => up("causaRaiz", e.target.value)}
            className={campo}
          />
        </Campo>
      </Secao>

      {/* 5. Ações imediatas */}
      <Secao n={5} titulo="Ações imediatas de correção" sub="O que já foi (ou precisa ser) feito para corrigir o erro pontualmente.">
        <Repetivel
          titulo="Ações corretivas"
          rows={d.acoesCorretivas}
          colunas={[
            { chave: "acao", rotulo: "Ação corretiva" },
            { chave: "responsavel", rotulo: "Responsável" },
            { chave: "prazo", rotulo: "Prazo", tipo: "date" },
            { chave: "status", rotulo: "Status" },
          ]}
          novo={() => ({ acao: "", responsavel: "", prazo: "", status: "" })}
          onChange={(r) => up("acoesCorretivas", r)}
          somenteLeitura={ro}
          addRotulo="Adicionar ação corretiva"
        />
      </Secao>

      {/* 6. Ações preventivas */}
      <Secao
        n={6}
        titulo="Ações preventivas e melhoria de processo"
        sub="Processos, checklists, controles ou treinamentos para evitar recorrência."
      >
        <Repetivel
          titulo="Ações preventivas"
          rows={d.acoesPreventivas}
          colunas={[
            { chave: "acao", rotulo: "Ação preventiva / novo processo" },
            { chave: "responsavel", rotulo: "Responsável" },
            { chave: "prazo", rotulo: "Prazo", tipo: "date" },
            { chave: "validacao", rotulo: "Como será validado" },
            { chave: "status", rotulo: "Status" },
          ]}
          novo={() => ({ acao: "", responsavel: "", prazo: "", validacao: "", status: "" })}
          onChange={(r) => up("acoesPreventivas", r)}
          somenteLeitura={ro}
          addRotulo="Adicionar ação preventiva"
        />
      </Secao>

      {/* 7. Lições aprendidas */}
      <Secao n={7} titulo="Lições aprendidas">
        <Campo label="Principal aprendizado deste incidente para o time">
          <textarea
            rows={3}
            value={d.licoes}
            disabled={ro}
            onChange={(e) => up("licoes", e.target.value)}
            className={campo}
          />
        </Campo>
      </Secao>

      {!ro && (
        <div className="flex justify-end gap-2">
          <button
            onClick={salvar}
            disabled={salvando || enviando}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-60"
            )}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar rascunho
          </button>
          <button
            onClick={enviar}
            disabled={salvando || enviando}
            className="flex items-center gap-1.5 rounded-lg bg-ent px-3 py-2 text-xs font-medium text-white hover:bg-ent/90 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar relatório
          </button>
        </div>
      )}
    </div>
  );
}
