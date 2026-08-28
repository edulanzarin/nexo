import { apiRoute } from "@/lib/api-route";
import { getSessao, empresasPermitidas } from "@/lib/sessao";
import { listarGruposEmpresa, empresasDeGrupos } from "@/lib/grupos-empresa";
import type { GrupoEmpresa } from "@/lib/types";

// Sem cache de rota: a contagem é POR USUÁRIO (escopo de empresa), então uma
// resposta cacheada mostraria a um usuário o tamanho do grupo de outro.

/**
 * Grupos de empresa cadastrados em Configurações, para o filtro das telas.
 * A contagem é a das empresas que ESTE usuário alcança, e grupo que não
 * sobrevive ao escopo dele nem aparece — filtro que devolve vazio não é filtro,
 * é armadilha.
 */
export const GET = apiRoute(async () => {
  const escopo = empresasPermitidas(await getSessao());
  const grupos = await listarGruposEmpresa();
  if (escopo === "todas") {
    return grupos
      .filter((g) => g.empresas > 0)
      .map<GrupoEmpresa>((g) => ({ id: g.id, nome: g.nome, empresas: g.empresas }));
  }

  const permitidas = new Set(escopo);
  const visiveis = await Promise.all(
    grupos.map(async (g) => {
      const empresas = await empresasDeGrupos([g.id]);
      return { id: g.id, nome: g.nome, empresas: empresas.filter((e) => permitidas.has(e)).length };
    })
  );
  return visiveis.filter((g) => g.empresas > 0) satisfies GrupoEmpresa[];
});
