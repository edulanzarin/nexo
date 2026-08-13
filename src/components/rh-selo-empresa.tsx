import { nomeEmpresaRh } from "@/lib/rh";
import { Badge } from "@/components/ui";

/** Selo da empresa do RH: NAVECON (entradas) e FOUR (saídas) em cores distintas. */
export function SeloEmpresa({ codigo, className }: { codigo: number; className?: string }) {
  const navecon = codigo === 1;
  return (
    <Badge tone={navecon ? "ent" : "sai"} size="xs" uppercase className={className}>
      {nomeEmpresaRh(codigo)}
    </Badge>
  );
}
