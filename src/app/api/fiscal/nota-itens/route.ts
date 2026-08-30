import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { buscarNotaItens } from "@/lib/nota-itens";

/**
 * Itens (produtos) de uma nota específica — drill-down do explorador.
 *
 * Registrado na trilha: abrir a nota é o gesto de CONFERIR nota a nota, e é o
 * mais perto de trabalho fiscal que acontece dentro do Nexo (o módulo não grava
 * nada no Questor). Sem isto a aba No Nexo do Fiscal veria só exportação.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const itens = await buscarNotaItens(sp);
  // Depois da consulta: escopo/validação já passaram, então não se registra
  // acesso a nota que a pessoa não podia ver.
  const empresa = Number(sp.get("empresa"));
  await registrarAuditoria({
    acao: "fiscal.nota.ver",
    modulo: "fiscal",
    alvo: `Nota ${sp.get("chave") ?? "?"} (${sp.get("tipo") === "ent" ? "entrada" : "saída"})`,
    codigoempresa: Number.isInteger(empresa) ? empresa : null,
  });
  return itens;
});
