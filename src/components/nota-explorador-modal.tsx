"use client";

import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui";
import { ItensNota } from "@/components/itens-nota";
import { brl, dataBR, documento, num } from "@/lib/format";
import type { NotaLista } from "@/lib/types";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{rotulo}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

/**
 * Detalhe de uma nota do explorador (Fiscal → Dados, Contábil → Notas). Abre ao
 * clicar na linha — que fica enxuta, com o detalhe completo aqui: cabeçalho,
 * campos que não cabem na tabela (documento, modelo, chave de acesso de 44
 * dígitos) e os itens/produtos, buscados sob demanda pela rota do módulo.
 */
export function NotaExploradorModal({
  nota,
  tipo,
  modulo,
  mostraEmpresa,
  onFechar,
}: {
  nota: NotaLista | null;
  tipo: "ent" | "sai";
  modulo: "fiscal" | "contabil";
  mostraEmpresa: boolean;
  onFechar: () => void;
}) {
  if (!nota) return null;

  const legenda = [
    nota.especie,
    `${num(nota.numero)}${nota.serie ? ` / ${nota.serie}` : ""}`,
    dataBR(nota.data),
    nota.uf,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="max-w-5xl"
      ariaLabel={`Nota ${num(nota.numero)}`}
      titulo={
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-lg font-semibold" title={nota.contraparte ?? ""}>
            {nota.contraparte ?? "Nota sem contraparte"}
          </h3>
          {nota.cancelada && (
            <Badge tone="sai" className="shrink-0">
              cancelada
            </Badge>
          )}
        </div>
      }
      subtitulo={legenda}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-hairline px-6 py-4 sm:grid-cols-4">
          <Campo rotulo="Valor">
            <span className={nota.cancelada ? "font-semibold tabular-nums line-through" : "font-semibold tabular-nums"}>
              {brl(nota.valor)}
            </span>
          </Campo>
          <Campo rotulo="Documento">
            <span className="tabular-nums">{nota.contraparteDoc ? documento(nota.contraparteDoc) : "—"}</span>
          </Campo>
          <Campo rotulo="Modelo">
            <span className="tabular-nums">{nota.modelo ?? "—"}</span>
          </Campo>
          {mostraEmpresa && (
            <Campo rotulo="Empresa">
              <span className="block truncate" title={nota.empresaNome ?? ""}>
                {nota.empresaNome ?? `Empresa ${nota.empresa}`}
              </span>
            </Campo>
          )}
        </div>

        {nota.chaveNfe && (
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              Chave de acesso
            </p>
            <p className="mt-0.5 break-all text-xs text-ink-2 tabular-nums select-all">
              {nota.chaveNfe}
            </p>
          </div>
        )}

        <div className="py-2">
          <p className="px-6 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted">
            Itens da nota
          </p>
          <ItensNota tipo={tipo} empresa={nota.empresa} chave={nota.chave} modulo={modulo} />
        </div>
      </div>
    </Modal>
  );
}
