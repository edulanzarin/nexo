"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dropdown } from "@/components/ui/dropdown";
import { exportarCSV } from "@/lib/exportar";
import type { ModuloId } from "@/lib/modulos";

type Celula = string | number | null | undefined;

/**
 * Um corte exportável da tela. `montar` só roda no clique — enquanto o menu
 * está fechado não custa nada, mesmo quando o corte é grande.
 */
export interface CorteExport {
  id: string;
  rotulo: string;
  descricao?: string;
  /** Nome do arquivo, sem `.csv`. */
  nome: string;
  montar: () => { cabecalhos: string[]; linhas: Celula[][] };
}

/**
 * Menu de exportação de uma tela com VÁRIOS cortes (ranking, quebras, série).
 * Um botão só, em vez de espalhar "Exportar CSV" pelo cabeçalho de cada cartão —
 * e cada corte sai como o dado está na tela, já com o recorte ativo aplicado.
 *
 * Toda exportação passa pelo `exportarCSV`, que registra na trilha de auditoria.
 */
export function ExportarMenu({
  modulo,
  cortes,
  desabilitado,
}: {
  modulo: ModuloId;
  cortes: CorteExport[];
  desabilitado?: boolean;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);

  const exportar = (corte: CorteExport, fechar: () => void) => {
    setOcupado(corte.id);
    try {
      const { cabecalhos, linhas } = corte.montar();
      if (linhas.length === 0) {
        toast.info(`Nada para exportar em "${corte.rotulo}"`);
        return;
      }
      exportarCSV(modulo, corte.nome, cabecalhos, linhas);
      toast.success(`${corte.rotulo}: ${linhas.length} linha(s) exportada(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setOcupado(null);
      fechar();
    }
  };

  if (desabilitado) {
    return (
      <button
        type="button"
        disabled
        className="flex h-9 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm text-muted opacity-50"
      >
        <Download className="size-4" />
        Exportar
      </button>
    );
  }

  return (
    <Dropdown
      rotulo="Exportar"
      icone={<Download className="size-4 shrink-0 text-muted" />}
      largura="w-80"
      larguraBotao="w-36"
    >
      {(fechar) => (
        <div className="py-1">
          <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted">
            Baixar em CSV
          </p>
          {cortes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => exportar(c, fechar)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                {ocupado === c.id ? (
                  <Loader2 className="size-3.5 animate-spin text-muted" />
                ) : (
                  <Download className="size-3.5 text-muted" />
                )}
              </span>
              <span className="flex-1">
                <span className="block text-sm text-ink">{c.rotulo}</span>
                {c.descricao && (
                  <span className="mt-0.5 block text-[11px] text-muted">{c.descricao}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
