import { apiRoute } from "@/lib/api-route";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import { montarPainelTi } from "@/lib/ti-painel";

/**
 * O Painel da TI. Cada lado só vem para quem tem a seção dele: o Painel é a
 * porta de entrada, não um atalho para o cofre de quem não tem o cofre.
 */
export const GET = apiRoute(async () => {
  const sessao = await getSessaoOpcional();
  return montarPainelTi({
    equipamentos: !!sessao && podeSecao(sessao, "ti", "equipamentos"),
    acessos: !!sessao && podeSecao(sessao, "ti", "acessos"),
  });
});
