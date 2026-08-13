"use client";

import { Check, Store } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { useFiliais } from "@/hooks/use-api";

/**
 * Seletor de filial (estabelecimento) — multi-seleção dentro de UMA empresa.
 * Só aparece quando há exatamente uma empresa em escopo E ela tem mais de uma
 * filial (senão não há o que escolher). Vazio = todas as filiais (consolidado).
 *
 * `codigoestab` não é comparável entre empresas, então o chamador passa a única
 * empresa (ou null) e zera a seleção quando a empresa muda.
 */
export function FilialDropdown({
  empresa,
  estabs,
  onChange,
}: {
  empresa: number | null;
  estabs: number[];
  onChange: (estabs: number[]) => void;
}) {
  const { data: filiais } = useFiliais(empresa);

  // Nada a escolher: empresa não resolvida, ainda carregando, ou filial única.
  if (empresa == null || !filiais || filiais.length <= 1) return null;

  const rotulo =
    estabs.length === 0
      ? "Todas as filiais"
      : estabs.length === 1
        ? (filiais.find((f) => f.codigoestab === estabs[0])?.nome ?? `Filial ${estabs[0]}`)
        : `${estabs.length} filiais`;

  const toggle = (cod: number) => {
    const s = new Set(estabs);
    if (s.has(cod)) s.delete(cod);
    else s.add(cod);
    onChange([...s].sort((a, b) => a - b));
  };

  return (
    <Dropdown
      icone={<Store className="size-4" />}
      rotulo={rotulo}
      ativo={estabs.length > 0}
      largura="w-64"
    >
      {() => (
        <div className="max-h-72 overflow-y-auto py-1">
          <ItemLista selecionado={estabs.length === 0} onClick={() => onChange([])}>
            <span className="grid size-4 place-items-center">
              {estabs.length === 0 && <Check className="size-4 stroke-[3] text-accent" />}
            </span>
            <span className="flex-1">Todas as filiais</span>
          </ItemLista>
          {filiais.map((f) => (
            <ItemLista
              key={f.codigoestab}
              selecionado={estabs.includes(f.codigoestab)}
              onClick={() => toggle(f.codigoestab)}
            >
              <span className="grid size-4 place-items-center">
                {estabs.includes(f.codigoestab) && <Check className="size-4 stroke-[3] text-accent" />}
              </span>
              <span className="flex-1 truncate">{f.nome}</span>
              <span className="tnum text-xs text-muted">{f.codigoestab}</span>
            </ItemLista>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
