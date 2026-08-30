"use client";

import { ProdAppTela } from "@/components/prod-app-tela";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilApp } from "@/hooks/use-api";

/**
 * Aba No Nexo do Contábil. A tela inteira é compartilhada com o Fiscal
 * (`ProdAppTela`) — aqui mora só a fronteira que não se compartilha: qual rota
 * buscar, que é a mesma coisa que qual permissão vale.
 */
export default function AppContabilPage() {
  const { qs } = useFiltros();
  const consulta = useContabilApp(qs);

  return (
    <ProdAppTela
      dados={consulta.data}
      carregando={consulta.isLoading}
      recarregando={consulta.isFetching && !consulta.isLoading}
    />
  );
}
