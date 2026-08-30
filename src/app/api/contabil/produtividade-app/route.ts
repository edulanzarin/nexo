import { apiRoute } from "@/lib/api-route";
import { parseProdFiltros } from "@/lib/contabil-prod-comum";
import { montarProdutividadeApp } from "@/lib/prod-app";

/**
 * Aba No Nexo da Produtividade do Contábil: o que o time rodou DENTRO do app —
 * conciliações, laudos, implantações, triagens e cadastro —, lido da trilha de
 * auditoria no banco do app. Empresa é opcional (sem ela, o escritório
 * inteiro); o escopo da sessão trava dentro do lib.
 */
export const GET = apiRoute(async (req) =>
  montarProdutividadeApp("contabil", parseProdFiltros(req.nextUrl.searchParams))
);
