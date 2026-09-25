import { query } from "@/lib/db";
import { appQuery } from "@/lib/app-db";
import { apiRoute } from "@/lib/api-route";
import { EMPRESAS_RH } from "@/lib/rh";
import type { SetorRh } from "@/lib/rh-tipos";

/**
 * Setores do RH por `classiforgan`, unindo as empresas (NAVECON/FOUR/FINAVE — mesma
 * Navecon, mesmos departamentos). A BASE é o organograma do Questor; por cima:
 *   - o nome limpo de `rh_setor` sobrepõe o `descrorgan` (setor renomeado);
 *   - setores PRÓPRIOS (origem 'app', que não existem no Questor) entram na lista;
 *   - a contagem de ativos soma funcionários do Questor + pessoas PJ do setor.
 * Serve o filtro do Diretório e o cadastro de Gestores (um gestor por departamento).
 */
export const GET = apiRoute(async () => {
  const [questor, pjPorSetor, editados] = await Promise.all([
    // Um por classiforgan, nome = descrorgan mais populado, ativos = soma.
    query<{ classiforgan: string; nome: string; ativos: number }>(
      `select classiforgan,
              (array_agg(nome order by ativos desc, nome))[1] as nome,
              sum(ativos)::int as ativos
         from (
           select f.classiforgan,
                  coalesce(nullif(btrim(o.descrorgan), ''), '(sem setor)') as nome,
                  count(*)::int as ativos
             from funcionario f
             left join organograma o
               on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab
              and o.classiforgan = f.classiforgan
            where f.codigoempresa = any($1::int[]) and f.datadem is null
            group by f.codigoempresa, f.classiforgan, o.descrorgan
         ) t
        group by classiforgan`,
      [[...EMPRESAS_RH]]
    ),
    appQuery<{ classiforgan: string; ativos: number }>(
      `select classiforgan, count(*)::int as ativos
         from rh_pessoa_pj
        where ativo and classiforgan is not null
        group by classiforgan`
    ),
    appQuery<{ classiforgan: string; nome: string; origem: string }>(
      `select classiforgan, nome, origem from rh_setor where ativo`
    ),
  ]);

  const nomeApp = new Map(editados.map((e) => [e.classiforgan, e.nome]));
  const pj = new Map(pjPorSetor.map((p) => [p.classiforgan, p.ativos]));
  const acc = new Map<string, SetorRh>();

  for (const q of questor) {
    acc.set(q.classiforgan, {
      classiforgan: q.classiforgan,
      nome: nomeApp.get(q.classiforgan) ?? q.nome,
      ativos: q.ativos + (pj.get(q.classiforgan) ?? 0),
      origem: "questor",
    });
  }
  // Setores próprios (só no app-db) — inclusive os que ainda não têm ninguém.
  for (const e of editados) {
    if (e.origem !== "app" || acc.has(e.classiforgan)) continue;
    acc.set(e.classiforgan, {
      classiforgan: e.classiforgan,
      nome: e.nome,
      ativos: pj.get(e.classiforgan) ?? 0,
      origem: "app",
    });
  }
  // PJ apontando p/ um classiforgan sem funcionário Questor e sem rh_setor: mostra assim mesmo.
  for (const [classiforgan, ativos] of pj) {
    if (acc.has(classiforgan)) continue;
    acc.set(classiforgan, {
      classiforgan,
      nome: nomeApp.get(classiforgan) ?? classiforgan,
      ativos,
      origem: nomeApp.has(classiforgan) ? "app" : "questor",
    });
  }

  return [...acc.values()].sort((a, b) => b.ativos - a.ativos || a.nome.localeCompare(b.nome, "pt-BR"));
});
