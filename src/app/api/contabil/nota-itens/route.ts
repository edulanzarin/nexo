import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { buscarNotaItens } from "@/lib/nota-itens";

/** Itens de uma nota — detalhe da Conferência. Mesma consulta do Fiscal, mas
 * servida pelo módulo Contábil (gate por caminho no apiRoute), e registrada na
 * trilha do módulo que a serviu — abrir a nota é conferência, e conta como tal
 * na aba No Nexo. */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const itens = await buscarNotaItens(sp);
  const empresa = Number(sp.get("empresa"));
  await registrarAuditoria({
    acao: "contabil.nota.ver",
    modulo: "contabil",
    alvo: `Nota ${sp.get("chave") ?? "?"} (${sp.get("tipo") === "ent" ? "entrada" : "saída"})`,
    codigoempresa: Number.isInteger(empresa) ? empresa : null,
  });
  return itens;
});
