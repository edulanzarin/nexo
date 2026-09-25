"use client";

import { PainelErro } from "@/componentes/primitivos/estados";
import { TelaNoNavex } from "@/componentes/produto/produtividade/tela-no-navex";
import type { ProdAppResp } from "@/lib/prod-app-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

/**
 * Aba No NaveX do Fiscal. A tela é compartilhada com o Contábil; aqui mora só
 * a fronteira que não se compartilha: qual rota buscar, que é a mesma coisa
 * que qual permissão vale.
 *
 * Sem filtro de espécie: a trilha do app não tem nota, tem gesto (varredura,
 * nota aberta, exportação).
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ProdAppResp>(
    "fiscal-produtividade-app",
    qs == null ? null : `/api/fiscal/produtividade-app?${qs}`
  );
  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;
  return <TelaNoNavex modulo="fiscal" dados={consulta.data} />;
}
