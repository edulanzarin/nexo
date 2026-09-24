"use client";

import { PainelErro } from "@/componentes/primitivos/estados";
import { TelaNoNavex } from "@/componentes/produto/produtividade/tela-no-navex";
import type { ProdAppResp } from "@/lib/prod-app-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

/**
 * Aba No NaveX do Contábil. A tela é compartilhada com o Fiscal; aqui mora só
 * a fronteira que não se compartilha: qual rota buscar, que é a mesma coisa
 * que qual permissão vale.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ProdAppResp>(
    "contabil-produtividade-app",
    qs == null ? null : `/api/contabil/produtividade-app?${qs}`
  );
  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;
  return <TelaNoNavex modulo="contabil" dados={consulta.data} />;
}
