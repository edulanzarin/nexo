import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessao, podeVerEmpresa } from "@/lib/sessao";
import { fichaFuncionario } from "@/lib/funcionario-ficha";
import { registrarAuditoria } from "@/lib/auditoria";

/** Ficha completa de um contrato — o detalhe que abre no modal a partir da lista. */
export const GET = apiRoute(async (req) => {
  const empresa = Number(req.nextUrl.searchParams.get("empresa"));
  const contrato = Number(req.nextUrl.searchParams.get("contrato"));
  if (!Number.isInteger(empresa) || !Number.isInteger(contrato)) {
    throw new FilterError("Informe empresa e contrato");
  }

  // Escopo de empresa: sem acesso à empresa, a ficha nem é buscada (não vaza
  // nem a existência do contrato).
  if (!podeVerEmpresa(await getSessao(), empresa)) {
    throw new FilterError("Colaborador não encontrado");
  }

  const ficha = await fichaFuncionario(empresa, contrato);
  if (!ficha) throw new FilterError("Colaborador não encontrado");
  await registrarAuditoria({
    acao: "folha.ficha.ver",
    alvo: ficha.nome,
    codigoempresa: empresa,
    detalhe: { contrato },
  });
  return ficha;
});
