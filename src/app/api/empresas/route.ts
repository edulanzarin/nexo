import { query } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { getSessao, empresasPermitidas } from "@/lib/sessao";
import type { Empresa } from "@/lib/types";

// Sem cache de rota: a lista é POR USUÁRIO (escopo de empresa), então uma
// resposta cacheada vazaria as empresas de um usuário para outro.

export const GET = apiRoute(async () => {
  const escopo = empresasPermitidas(await getSessao());
  if (escopo !== "todas" && escopo.length === 0) return [] satisfies Empresa[];

  const rows =
    escopo === "todas"
      ? await query<{ codigo: number; nome: string }>(
          `select codigoempresa as codigo, nomeempresa as nome
             from empresa
            order by nomeempresa`
        )
      : await query<{ codigo: number; nome: string }>(
          `select codigoempresa as codigo, nomeempresa as nome
             from empresa
            where codigoempresa = any($1::int[])
            order by nomeempresa`,
          [escopo]
        );
  return rows satisfies Empresa[];
});
