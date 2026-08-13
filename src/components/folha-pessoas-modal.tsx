"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FichaModal } from "@/components/folha-ficha-modal";
import { PessoasTabela } from "@/components/folha-pessoas-tabela";
import { useFolhaPessoas } from "@/hooks/use-api";
import type { FolhaMovimentacao } from "@/lib/types";

/** A quebra clicada: dimensão, valor do grupo e o rótulo para o título. */
export interface Drill {
  dim: string;
  valor: string;
  rotulo: string;
}

/**
 * Drill de qualquer quebra: lista as pessoas do grupo clicado (movimentações do
 * período naquele recorte) e cada linha abre a ficha. Reusa a mesma tabela de
 * pessoas e o mesmo modal de ficha das movimentações — clicar em qualquer número
 * chega na pessoa.
 */
export function PessoasModal({
  qsBase,
  drill,
  onFechar,
  modulo = "folha",
}: {
  /** qs com período + filtros avançados; o dim/valor entram aqui. */
  qsBase: string;
  drill: Drill | null;
  onFechar: () => void;
  /** Módulo dono das rotas (Folha padrão; RH usa /api/rh/*). */
  modulo?: "folha" | "rh";
}) {
  const [ficha, setFicha] = useState<FolhaMovimentacao | null>(null);

  const qs = drill
    ? `${qsBase}&dim=${encodeURIComponent(drill.dim)}&valor=${encodeURIComponent(drill.valor)}`
    : "";
  const { data, isLoading, isFetching } = useFolhaPessoas(qs, drill != null, modulo);

  return (
    <>
      <Modal
        aberto={drill != null}
        onFechar={onFechar}
        largura="max-w-4xl"
        titulo={drill?.rotulo ?? "Pessoas"}
      >
        <div className="px-4 py-3">
          {isLoading || !data ? (
            <div className="skeleton h-72 w-full" />
          ) : data.length === 0 ? (
            <p className="grid h-32 place-items-center text-sm text-muted">
              Sem admissões ou desligamentos neste grupo no período
            </p>
          ) : (
            <PessoasTabela
              dados={data}
              onAbrir={setFicha}
              altura="max-h-[60vh]"
              recarregando={isFetching && !isLoading}
            />
          )}
        </div>
      </Modal>

      <FichaModal
        modulo={modulo}
        empresa={ficha?.codigoempresa ?? null}
        contrato={ficha?.contrato ?? null}
        onFechar={() => setFicha(null)}
      />
    </>
  );
}
