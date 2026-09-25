import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { ehEmpresaRh, ehContratoPj } from "@/lib/rh";
import { fichaRh } from "@/lib/rh-diretorio";
import { registrarAuditoria } from "@/lib/auditoria";

/** Ficha completa de um contrato do RH — mesma ficha da Folha, com as correções
 *  (overlay) aplicadas e resolvendo pessoas PJ; escopo das empresas do RH. */
export const GET = apiRoute(async (req) => {
  const empresa = Number(req.nextUrl.searchParams.get("empresa"));
  const contrato = Number(req.nextUrl.searchParams.get("contrato"));
  if (!Number.isInteger(empresa) || !Number.isInteger(contrato)) {
    throw new FilterError("Informe empresa e contrato");
  }
  // Escopo do RH é fixo: fora de {NAVECON, FOUR, FINAVE} não existe aqui — exceto
  // PJ, cujo "contrato" é sintético mas ainda carrega uma dessas empresas.
  if (!ehEmpresaRh(empresa) && !ehContratoPj(contrato)) {
    throw new FilterError("Colaborador não encontrado");
  }

  const ficha = await fichaRh(empresa, contrato);
  if (!ficha) throw new FilterError("Colaborador não encontrado");
  await registrarAuditoria({
    acao: "rh.ficha.ver",
    alvo: ficha.nome,
    codigoempresa: empresa,
    detalhe: { contrato },
  });
  return ficha;
});
