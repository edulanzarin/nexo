"use client";

import { ProdAppTela } from "@/components/prod-app-tela";
import { useFiltros } from "@/hooks/use-filters";
import { useFiscalApp } from "@/hooks/use-api";

/**
 * Aba No Nexo do Fiscal. A tela inteira é compartilhada com o Contábil
 * (`ProdAppTela`) — aqui mora só a fronteira que não se compartilha: qual rota
 * buscar, que é a mesma coisa que qual permissão vale.
 */
export default function AppFiscalPage() {
  const { qs } = useFiltros();
  const consulta = useFiscalApp(qs);

  return (
    <ProdAppTela
      dados={consulta.data}
      carregando={consulta.isLoading}
      recarregando={consulta.isFetching && !consulta.isLoading}
    />
  );
}
