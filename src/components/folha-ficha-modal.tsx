"use client";

import { useState } from "react";
import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { useFicha, useRhSetores } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { ehContratoPj, pjIdDoContrato } from "@/lib/rh";
import { dataBR } from "@/lib/format";
import type { FolhaFicha } from "@/lib/types";

/** Dias → "X anos Y meses" / "N meses" / "N dias". */
export function tempoCasa(dias: number | null): string {
  if (dias == null) return "—";
  if (dias < 30) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anos}a ${resto}m` : `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</p>
      <p className="mt-0.5 text-sm text-ink">{valor || "—"}</p>
    </div>
  );
}

const INPUT =
  "h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-ink/30";

/** Ficha completa de um colaborador em modal — abre a partir de qualquer lista.
 *  No RH a ficha é editável: correções sobre o Questor (overlay) ou a edição da
 *  própria pessoa PJ. */
export function FichaModal({
  empresa,
  contrato,
  onFechar,
  modulo = "folha",
}: {
  empresa: number | null;
  contrato: number | null;
  onFechar: () => void;
  /** Rota da ficha: Folha (padrão) ou RH. A ficha é a mesma; muda só o gate. */
  modulo?: "folha" | "rh";
}) {
  const { data: f, isLoading } = useFicha(empresa, contrato, modulo);
  // Guarda o ALVO em edição (não um booleano): ao trocar de colaborador ou
  // fechar, `editando` volta a falso sozinho — sem efeito de reset.
  const [editAlvo, setEditAlvo] = useState<number | null>(null);
  const editando = contrato != null && editAlvo === contrato;
  const podeEditar = modulo === "rh";
  const ehPj = contrato != null && ehContratoPj(contrato);

  return (
    <Modal
      aberto={contrato != null}
      onFechar={onFechar}
      largura="max-w-2xl"
      titulo={f ? f.nome : "Colaborador"}
      subtitulo={
        f ? `${f.cargo ?? "—"} · ${ehPj ? "PJ" : `contrato ${f.contrato}`}` : undefined
      }
    >
      {editando && f && empresa != null && contrato != null ? (
        <FichaEdicao
          f={f}
          empresa={empresa}
          contrato={contrato}
          modulo={modulo}
          ehPj={ehPj}
          onPronto={() => setEditAlvo(null)}
          onFechar={onFechar}
        />
      ) : (
        <div className="overflow-y-auto px-6 py-5">
          {isLoading || !f ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {podeEditar && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setEditAlvo(contrato)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                </div>
              )}

              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-2">Pessoa</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Campo rotulo="CPF" valor={f.cpf} />
                  <Campo rotulo="Sexo" valor={f.sexo} />
                  <Campo rotulo="Idade" valor={f.idade != null ? `${f.idade} anos` : "—"} />
                  <Campo rotulo="Nascimento" valor={dataBR(f.nascimento)} />
                  <Campo rotulo="Escolaridade" valor={f.escolaridade} />
                  <Campo
                    rotulo="Cidade"
                    valor={f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ""}` : "—"}
                  />
                </div>
              </section>

              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-2">Vínculo</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Campo rotulo="Cargo" valor={f.cargo} />
                  <Campo rotulo="Função" valor={f.funcao} />
                  <Campo rotulo="Setor" valor={f.setor} />
                  <Campo rotulo="Estabelecimento" valor={f.estabelecimento} />
                  <Campo
                    rotulo="Salário"
                    valor={
                      f.salario != null
                        ? `${f.salario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${f.tipoSalario ? ` · ${f.tipoSalario}` : ""}`
                        : "—"
                    }
                  />
                  <Campo
                    rotulo="Categoria / tipo"
                    valor={`${f.categoria ?? "—"} / ${f.tipoVinculo ?? "—"}`}
                  />
                </div>
              </section>

              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-2">Contrato</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Campo rotulo="Admissão" valor={dataBR(f.dataadm)} />
                  <Campo rotulo="Desligamento" valor={f.datadem ? dataBR(f.datadem) : "ativo"} />
                  <Campo rotulo="Tempo de casa" valor={tempoCasa(f.tempoCasaDias)} />
                  {f.motivoDesligamento && (
                    <div className="col-span-2 sm:col-span-3">
                      <Campo rotulo="Motivo do desligamento" valor={f.motivoDesligamento} />
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Edição (só no RH) ─────────────────────────────────────────────────────────

/** Campos editáveis (curados) e seus valores atuais a partir da ficha. */
type FormFicha = {
  nome: string;
  cpf: string;
  cargo: string;
  classiforgan: string;
  dataadm: string;
  email: string;
  salario: string;
  nascimento: string;
  cidade: string;
  uf: string;
  escolaridade: string;
};

function daFicha(f: FolhaFicha): FormFicha {
  return {
    nome: f.nome ?? "",
    cpf: f.cpf ?? "",
    cargo: f.cargo ?? "",
    classiforgan: f.classiforgan ?? "",
    dataadm: f.dataadm ?? "",
    email: f.email ?? "",
    salario: f.salario != null ? String(f.salario) : "",
    nascimento: f.nascimento ?? "",
    cidade: f.cidade ?? "",
    uf: f.uf ?? "",
    escolaridade: f.escolaridade ?? "",
  };
}

function FichaEdicao({
  f,
  empresa,
  contrato,
  modulo,
  ehPj,
  onPronto,
  onFechar,
}: {
  f: FolhaFicha;
  empresa: number;
  contrato: number;
  modulo: "folha" | "rh";
  ehPj: boolean;
  onPronto: () => void;
  onFechar: () => void;
}) {
  const { data: setores } = useRhSetores();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormFicha>(() => daFicha(f));
  // Flag de experiência: só PJ, fora do FormFicha (é booleano, não texto).
  const [temExp, setTemExp] = useState<boolean>(!!f.temExperiencia);
  const [salvando, setSalvando] = useState(false);

  const set = (k: keyof FormFicha, v: string) => setForm((o) => ({ ...o, [k]: v }));

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["ficha", modulo, empresa, contrato] });
    queryClient.invalidateQueries({ queryKey: ["rh-funcionarios"] });
    queryClient.invalidateQueries({ queryKey: ["rh-setores"] });
  };

  // Só envia o que mudou em relação ao valor atual (não vira "correção" à toa).
  function montarCampos(): Record<string, unknown> {
    const base = daFicha(f);
    const campos: Record<string, unknown> = {};
    for (const k of Object.keys(form) as (keyof FormFicha)[]) {
      if (form[k] === base[k]) continue;
      campos[k] = k === "salario" ? (form[k] ? Number(form[k]) : null) : form[k];
    }
    return campos;
  }

  const salvar = async () => {
    const campos = montarCampos();
    // PJ: a caixinha de experiência é enviada junto quando mudou.
    if (ehPj && temExp !== !!f.temExperiencia) campos.temExperiencia = temExp;
    if (!Object.keys(campos).length) {
      onPronto();
      return;
    }
    setSalvando(true);
    try {
      if (ehPj) {
        await mutar("/api/rh/pessoa-pj", "PATCH", { id: pjIdDoContrato(contrato), campos });
      } else {
        await mutar("/api/rh/funcionario-override", "PUT", { empresa, contrato, campos });
      }
      invalidar();
      toast.success("Ficha atualizada");
      onPronto();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const reverter = async () => {
    if (!confirm("Descartar as correções e voltar ao dado do Questor?")) return;
    try {
      await mutar(`/api/rh/funcionario-override?empresa=${empresa}&contrato=${contrato}`, "DELETE");
      invalidar();
      toast.success("Correções descartadas");
      onPronto();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reverter");
    }
  };

  const excluirPj = async () => {
    if (!confirm("Excluir esta pessoa PJ do diretório?")) return;
    try {
      await mutar(`/api/rh/pessoa-pj?id=${pjIdDoContrato(contrato)}`, "DELETE");
      invalidar();
      toast.success("Pessoa removida");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <EntradaTexto rotulo="Nome" valor={form.nome} onMudar={(v) => set("nome", v)} />
        <EntradaTexto rotulo={ehPj ? "CPF/CNPJ" : "CPF"} valor={form.cpf} onMudar={(v) => set("cpf", v)} />
        <EntradaTexto rotulo="Cargo" valor={form.cargo} onMudar={(v) => set("cargo", v)} />
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted">Setor</label>
          <select
            value={form.classiforgan}
            onChange={(e) => set("classiforgan", e.target.value)}
            className={`${INPUT} mt-0.5`}
          >
            <option value="">— sem setor —</option>
            {(setores ?? []).map((s) => (
              <option key={s.classiforgan} value={s.classiforgan}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <EntradaTexto rotulo={ehPj ? "Início" : "Admissão"} tipo="date" valor={form.dataadm} onMudar={(v) => set("dataadm", v)} />
        <EntradaTexto rotulo="E-mail" valor={form.email} onMudar={(v) => set("email", v)} />
        <EntradaTexto rotulo="Salário" tipo="number" valor={form.salario} onMudar={(v) => set("salario", v)} />
        <EntradaTexto rotulo="Nascimento" tipo="date" valor={form.nascimento} onMudar={(v) => set("nascimento", v)} />
        <EntradaTexto rotulo="Escolaridade" valor={form.escolaridade} onMudar={(v) => set("escolaridade", v)} />
        <EntradaTexto rotulo="Cidade" valor={form.cidade} onMudar={(v) => set("cidade", v)} />
        <EntradaTexto rotulo="UF" valor={form.uf} onMudar={(v) => set("uf", v.toUpperCase().slice(0, 2))} />
        {ehPj && (
          <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={temExp}
              onChange={(e) => setTemExp(e.target.checked)}
              className="mt-0.5 size-3.5 accent-ink"
            />
            <span className="text-xs text-ink-2">
              Tem contrato de experiência
              <span className="block text-[11px] text-muted">
                Marcos de 45 e 90 dias a partir da data de início.
              </span>
            </span>
          </label>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-hairline px-6 py-3">
        {ehPj ? (
          <button
            onClick={excluirPj}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-critical/12 hover:text-critical"
          >
            <Trash2 className="size-3.5" /> Excluir PJ
          </button>
        ) : (
          <button
            onClick={reverter}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw className="size-3.5" /> Reverter ao Questor
          </button>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onPronto}
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" /> Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Salvar
          </button>
        </div>
      </footer>
    </>
  );
}

function EntradaTexto({
  rotulo,
  valor,
  onMudar,
  tipo = "text",
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  tipo?: "text" | "date" | "number";
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</label>
      <input
        type={tipo}
        value={valor}
        step={tipo === "number" ? "0.01" : undefined}
        onChange={(e) => onMudar(e.target.value)}
        className={`${INPUT} mt-0.5`}
      />
    </div>
  );
}
