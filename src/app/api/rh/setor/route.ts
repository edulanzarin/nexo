import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { appQuery } from "@/lib/app-db";
import type { SetorRh } from "@/lib/rh-tipos";

/**
 * CRUD de setor (rh_setor). O Questor é a base dos setores (organograma), mas vem
 * com nomes ruins e não dá pra criar setor lá. Aqui a RH:
 *   - renomeia um setor do Questor (PATCH grava o nome limpo por classiforgan);
 *   - cria um setor PRÓPRIO (POST gera um classiforgan `APPnn`, origem 'app');
 *   - remove/reverte (DELETE apaga a linha: setor próprio some; setor do Questor
 *     volta ao nome original do organograma).
 * A contagem de ativos e a lista saem por /api/rh/setores.
 */

function nomeValido(v: unknown): string {
  const nome = typeof v === "string" ? v.trim() : "";
  if (!nome) throw new FilterError("Informe o nome do setor");
  if (nome.length > 80) throw new FilterError("Nome muito longo");
  return nome;
}

/** Cria um setor próprio com classiforgan gerado (APP01, APP02, …). */
export const POST = apiRoute(async (req) => {
  const nome = nomeValido((await req.json())?.nome);
  const [row] = await appQuery<SetorRh & { ativos: number }>(
    `with proximo as (
       select coalesce(max((substring(classiforgan from 4))::int), 0) + 1 as n
         from rh_setor where classiforgan ~ '^APP[0-9]+$'
     )
     insert into rh_setor (classiforgan, nome, origem)
     select 'APP' || lpad(proximo.n::text, 2, '0'), $1, 'app' from proximo
     returning classiforgan, nome, origem, 0 as ativos`,
    [nome]
  );
  return row;
});

/** Renomeia um setor (upsert por classiforgan). Setor do Questor ganha a 1ª linha
 *  como origem 'questor'; setor próprio só atualiza o nome. */
export const PATCH = apiRoute(async (req) => {
  const b = (await req.json()) as { classiforgan?: unknown; nome?: unknown };
  const classiforgan = typeof b.classiforgan === "string" ? b.classiforgan.trim() : "";
  if (!classiforgan) throw new FilterError("Setor inválido");
  const nome = nomeValido(b.nome);
  const [row] = await appQuery<SetorRh>(
    `insert into rh_setor (classiforgan, nome, origem)
     values ($1, $2, 'questor')
     on conflict (classiforgan) do update set nome = excluded.nome
     returning classiforgan, nome, origem`,
    [classiforgan, nome]
  );
  return row;
});

/** Remove a linha do rh_setor: setor próprio some; setor do Questor volta ao
 *  nome do organograma (a linha de renomeação é descartada). */
export const DELETE = apiRoute(async (req) => {
  const classiforgan = req.nextUrl.searchParams.get("classiforgan")?.trim();
  if (!classiforgan) throw new FilterError("Setor inválido");
  await appQuery(`delete from rh_setor where classiforgan = $1`, [classiforgan]);
  return { ok: true };
});
