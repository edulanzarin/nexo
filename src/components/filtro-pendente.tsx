import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * Estado que a tela mostra antes de o usuário executar: nada é consultado até o
 * botão da barra. Um só, reusado pelos shells dos módulos ([[executar-com-botao]]).
 * O `rotulo` acompanha o verbo do botão da tela ("Executar", "Carregar").
 */
export function FiltroPendente({ rotulo = "Executar" }: { rotulo?: string }) {
  return (
    <Card as="section" padding="none" className="grid place-items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent">
        <SlidersHorizontal className="size-6" />
      </span>
      <p className="text-sm font-medium text-ink">
        Ajuste os filtros e clique em {rotulo}
      </p>
    </Card>
  );
}
