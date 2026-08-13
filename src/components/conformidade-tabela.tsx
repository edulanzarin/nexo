"use client";

import { CheckCircle2 } from "lucide-react";
import type { ConformidadeEmpresa } from "@/lib/types";
import { num } from "@/lib/format";
import { Card, Table, Thead, Th, Tr, Td } from "@/components/ui";

interface Props {
  dados: ConformidadeEmpresa[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}

function Celula({ valor }: { valor: number }) {
  return (
    <Td numeric>
      <span className={valor > 0 ? "text-critical" : "text-muted"}>{num(valor)}</span>
    </Td>
  );
}

export function ConformidadeTabela({ dados, carregando, recarregando }: Props) {
  return (
    <Card as="section">
      <header className="mb-4">
        <h2 className="text-sm font-semibold">Empresas com mais pendências</h2>
      </header>

      {carregando || !dados ? (
        <div className="skeleton h-80 w-full" />
      ) : dados.length === 0 ? (
        <div className="grid h-32 place-items-center gap-2 text-center">
          <CheckCircle2 className="mx-auto size-6 text-good" />
          <p className="text-sm text-muted">Nenhuma pendência no período</p>
        </div>
      ) : (
        <Table minWidth="min-w-[640px]" recarregando={recarregando}>
          <Thead>
            <Th numeric className="w-8 px-2">
              #
            </Th>
            <Th>Empresa</Th>
            <Th numeric>NCM inválido</Th>
            <Th numeric>Canceladas</Th>
            <Th numeric>Denegadas</Th>
            <Th numeric>Sem chave</Th>
            <Th numeric>Total</Th>
          </Thead>
          <tbody>
            {dados.map((e, i) => (
              <Tr key={e.codigo} className="transition-colors hover:bg-surface-2/50">
                <Td numeric className="px-2 text-xs text-muted">
                  {i + 1}
                </Td>
                <Td>
                  <span className="font-medium text-ink">{e.nome ?? `Empresa ${e.codigo}`}</span>
                  <span className="ml-2 text-xs text-muted">{e.codigo}</span>
                </Td>
                <Celula valor={e.ncmInvalido} />
                <Celula valor={e.canceladas} />
                <Celula valor={e.denegadas} />
                <Celula valor={e.semChave} />
                <Td numeric className="font-semibold text-ink">
                  {num(e.pendencias)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
