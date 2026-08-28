import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { montarPainelObrigacoes, type FiltrosFila } from "@/lib/obrigacoes";
import { setoresDaSecao } from "@/lib/obrigacoes-secoes";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import type { PainelObrigacoes } from "@/lib/obrigacoes-tipos";

/**
 * Fila de entregas do Acessórias, recortada pelo SETOR da seção pedida.
 *
 * As quatro seções batem nesta rota, então o gate do `apiRoute` só garante que a
 * pessoa acessa ALGUMA delas — quem confere a seção pedida é este handler. Sem
 * isso, quem tem só a seção do DP pediria `?secao=contabil` e leria a fila do
 * Contábil.
 */
export const GET = apiRoute(async (req: NextRequest) => {
  const secao = req.nextUrl.searchParams.get("secao")?.trim() ?? "";
  const setores = setoresDaSecao(secao);
  if (setores === undefined) throw new FilterError("Seção inválida");

  const sessao = await getSessaoOpcional();
  if (!sessao || !podeSecao(sessao, "obrigacoes", secao)) {
    throw new FilterError("Seção fora do seu acesso");
  }

  const q = req.nextUrl.searchParams;
  const data = (k: string) => {
    const v = q.get(k)?.trim();
    // Só ISO: uma data malformada viraria `null` no cast e o filtro sumiria em
    // silêncio, mostrando mais linhas do que o usuário pediu.
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const inteiro = (k: string) => {
    const v = Number(q.get(k));
    return Number.isInteger(v) ? v : undefined;
  };

  const filtros: FiltrosFila = {
    cnpj: q.get("cnpj")?.trim() || undefined,
    respId: inteiro("respId"),
    prazoDe: data("prazoDe"),
    prazoAte: data("prazoAte"),
    competenciaDe: data("competenciaDe"),
    competenciaAte: data("competenciaAte"),
    obrigacao: q.get("obrigacao")?.trim() || undefined,
    soVencidas: q.get("soVencidas") === "1",
    soMulta: q.get("soMulta") === "1",
  };

  // Visão geral (setores vazio) = sem recorte; as demais, os setores da seção.
  return (await montarPainelObrigacoes(
    setores.length ? setores : undefined,
    filtros
  )) satisfies PainelObrigacoes;
});
