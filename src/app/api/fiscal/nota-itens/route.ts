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
    // CHAVE, não número da nota: o parâmetro é `chavelctofis{ent,sai}`, a chave
    // interna do Questor. Chamar isso de "Nota 18675" na trilha induz a erro —
    // a nota 18675 existe e é outra (aquela ali tem numeronf 211). A chave, com
    // a empresa da coluna ao lado, identifica o documento sem ambiguidade.
    alvo: `Chave ${sp.get("chave") ?? "?"} · ${sp.get("tipo") === "ent" ? "entrada" : "saída"}`,
    codigoempresa: Number.isInteger(empresa) ? empresa : null,
  });
  return itens;
});
