"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { ContaDropdown } from "@/components/conta-dropdown";
import { ReplicarModal } from "@/components/replicar-modal";
import { Button } from "@/components/ui";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import type { ContaBanco } from "@/lib/types";

async function carregarConta(empresa: number, conta: number) {
  const res = await fetch(`/api/contabil/extrato-regras?empresa=${empresa}&conta=${conta}`);
  const corpo = await res.json();
  if (!res.ok) throw new Error(corpo?.error ?? "Falha ao carregar");
  return corpo as ContaBanco;
}

/**
 * Controles da aba Regras, na linha da barra de filtros: a conta escolhida
 * aqui e a lista da página compartilham o estado da seção. Escolher a conta é
 * o gesto — o cadastro é leve, carrega na hora, com skeleton na página.
 */
export function RegrasControles() {
  const { filtros } = useFiltros();
  const queryClient = useQueryClient();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [conta, setConta] = useEstadoSecao<number | null>("conta", null);
  const [replicando, setReplicando] = useState<ContaBanco | null>(null);

  // Mesma queryKey da página: o cache é um só, sem fetch duplicado.
  const { data: atual } = useQuery({
    queryKey: ["extrato-regras", empresa, conta],
    queryFn: () => carregarConta(empresa, conta!),
    enabled: temEmpresa && conta != null,
  });

  if (!temEmpresa) return null;

  return (
    <>
      <ContaDropdown
        empresa={empresa}
        valor={conta}
        onMudar={setConta}
        soBanco
        placeholder="Conta de banco no plano"
      />

      {atual && atual.regras.length > 0 && (
        <Button variant="secondary" onClick={() => setReplicando(atual)} className="text-xs">
          <Copy className="size-3.5" /> Replicar para outras contas
        </Button>
      )}

      {replicando && (
        <ReplicarModal
          origem={replicando}
          onFechar={() => setReplicando(null)}
          onReplicado={() => {
            setReplicando(null);
            queryClient.invalidateQueries({ queryKey: ["extrato-regras"] });
          }}
        />
      )}
    </>
  );
}
