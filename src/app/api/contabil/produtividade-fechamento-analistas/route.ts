import { apiRoute } from "@/lib/api-route";
import { analistasDaCarteira, SETOR_CONTABIL } from "@/lib/carteira-setores";
import { empresasPermitidas, getSessaoOpcional } from "@/lib/sessao";

/**
 * Os ANALISTAS da carteira do Contábil: a lista do filtro por analista da aba
 * Fechamento.
 *
 * Rota própria, e não um campo da resposta do Fechamento, para o filtro funcionar
 * antes do primeiro Executar, como o de grupo. Sai do banco do app (a carteira
 * materializada), então não toca o Questor nem o Acessórias.
 */
export const GET = apiRoute(async () => {
  const sessao = await getSessaoOpcional();
  const escopo = sessao ? empresasPermitidas(sessao) : [];
  const analistas = await analistasDaCarteira(SETOR_CONTABIL, escopo === "todas" ? null : escopo);
  return { analistas };
});
