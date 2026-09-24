import { PoolClient } from "pg";
import type {
  CustoFolhaResp,
  CustoGrupo,
  CustoPonto,
  CustoRubrica,
  CustoTipoFolha,
} from "./types";

/**
 * CUSTO DE FOLHA — quanto a folha calculou de remuneração no período, a partir de
 * `calculoevento` (rubrica × funcionário × folha). O irmão financeiro do turnover:
 * mesma base `funcionario` para setor/cargo/estab, agora com o dinheiro. Ver
 * [[Módulo de folha e eSocial do Questor]].
 *
 * ── Escopo (decisões de negócio) ─────────────────────────────────────────────
 *  • "Custo" = proventos (evento.tipoevento = 1). NÃO inclui encargos patronais
 *    (FGTS/INSS patronal), que no Questor não são evento por funcionário — fase 2.
 *  • Folhas de pagamento por tipo (mensal, 13º, férias, rescisão, PLR…), EXCETO
 *    adiantamento (antecipa a mensal → duplicaria), provisão (accrual, não é
 *    pagamento) e transferência (movimentação interna).
 *  • Recorte pelo FIM da folha (`datafinalfolha`) dentro do período; a filial não
 *    é filtro na Folha (o shell não mostra), mas o custo abre POR estabelecimento.
 *
 * ── Método (a validar no banco real) ─────────────────────────────────────────
 * O tipo da rubrica (provento/desconto) vem do cadastro `evento`, carregado num
 * Map; a classificação entra nas queries como array de códigos (`= any(...)`),
 * evitando juntar `evento` na varredura pesada de `calculoevento`. `evento` é
 * tratado como cadastro GLOBAL (como cargo/função/escala no Questor).
 */

/** Folhas que NÃO entram no custo: adiantamento(8), provisão(70/71), transferência(80). */
const TIPOS_FORA = [8, 70, 71, 80];

/** Filtro comum: uma empresa, folhas de pagamento cujo fim cai no período. */
const BASE = `pc.codigoempresa = $1 and pc.datafinalfolha between $2 and $3
  and pc.codigotipocalc not in (${TIPOS_FORA.join(", ")})`;

/** Join periodocalculo → calculoevento (a espinha de toda query de custo). */
const JOIN_CE = `join calculoevento ce
  on ce.codigoempresa = pc.codigoempresa and ce.codigopercalculo = pc.codigopercalculo`;

const TOP_RUBRICAS = 12;

export async function montarCustoFolha(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string
): Promise<CustoFolhaResp> {
  // ── Cadastro de rubricas (global) → código provento / desconto ──
  const evQ = await client.query<{ cod: number; descr: string; tipo: number }>(
    `select codigoevento cod, coalesce(nullif(btrim(descrevento), ''), '') descr, tipoevento tipo
       from evento`
  );
  const rubricaInfo = new Map(evQ.rows.map((r) => [r.cod, r]));
  const proventos = evQ.rows.filter((r) => r.tipo === 1).map((r) => r.cod);
  const descontos = evQ.rows.filter((r) => r.tipo === 3).map((r) => r.cod);

  const nomeQ = await client.query<{ nome: string }>(
    `select coalesce(nomeempresa, '') nome from empresa where codigoempresa = $1`,
    [empresa]
  );
  const nome = nomeQ.rows[0]?.nome ?? String(empresa);

  const base3 = [empresa, inicio, fim];
  const base4 = [empresa, inicio, fim, proventos]; // quebras só usam $4 (proventos)
  const base5 = [empresa, inicio, fim, proventos, descontos];
  // Somatório de provento/desconto por linha, reusado em várias queries.
  const somaProv = `sum(case when ce.codigoevento = any($4::int[]) then ce.valorevento else 0 end)::float`;
  const somaDesc = `sum(case when ce.codigoevento = any($5::int[]) then ce.valorevento else 0 end)::float`;

  // ── Por tipo de folha × competência (dá resumo, porTipo e série) ──
  const linhasQ = await client.query<{
    mes: string;
    tipo: number;
    descricao: string;
    proventos: number;
    descontos: number;
  }>(
    `select to_char(pc.datafinalfolha, 'YYYY-MM') mes,
            pc.codigotipocalc tipo,
            coalesce(nullif(btrim(tc.descrtipocalc), ''), 'Folha ' || pc.codigotipocalc) descricao,
            ${somaProv} proventos, ${somaDesc} descontos
       from periodocalculo pc
       join tipocalculo tc on tc.codigotipocalc = pc.codigotipocalc
       ${JOIN_CE}
      where ${BASE}
      group by mes, pc.codigotipocalc, tc.descrtipocalc`,
    base5
  );

  let totProv = 0;
  let totDesc = 0;
  const porTipoMap = new Map<number, CustoTipoFolha>();
  const serieMap = new Map<string, CustoPonto>();
  for (const r of linhasQ.rows) {
    totProv += r.proventos;
    totDesc += r.descontos;
    const t = porTipoMap.get(r.tipo) ?? {
      tipo: r.tipo,
      descricao: r.descricao,
      proventos: 0,
      descontos: 0,
    };
    t.proventos += r.proventos;
    t.descontos += r.descontos;
    porTipoMap.set(r.tipo, t);
    const p = serieMap.get(r.mes) ?? { compet: r.mes, proventos: 0, descontos: 0 };
    p.proventos += r.proventos;
    p.descontos += r.descontos;
    serieMap.set(r.mes, p);
  }
  const porTipo = [...porTipoMap.values()].sort((a, b) => b.proventos - a.proventos);
  const serie = [...serieMap.values()].sort((a, b) => a.compet.localeCompare(b.compet));

  // ── Funcionários distintos com folha no período ──
  const funcQ = await client.query<{ n: number }>(
    `select count(distinct ce.codigofunccontr)::int n
       from periodocalculo pc ${JOIN_CE} where ${BASE}`,
    base3
  );
  const funcionarios = funcQ.rows[0]?.n ?? 0;

  // ── Rubricas: total por evento; classifica pelo Map, top proventos e descontos ──
  const rubQ = await client.query<{ evento: number; total: number }>(
    `select ce.codigoevento evento, sum(ce.valorevento)::float total
       from periodocalculo pc ${JOIN_CE} where ${BASE}
      group by ce.codigoevento`,
    base3
  );
  const prov: CustoRubrica[] = [];
  const desc: CustoRubrica[] = [];
  for (const r of rubQ.rows) {
    const info = rubricaInfo.get(r.evento);
    if (!info) continue;
    if (info.tipo === 1)
      prov.push({ codigo: r.evento, descricao: info.descr || `Evento ${r.evento}`, lado: "provento", total: r.total });
    else if (info.tipo === 3)
      desc.push({ codigo: r.evento, descricao: info.descr || `Evento ${r.evento}`, lado: "desconto", total: r.total });
  }
  prov.sort((a, b) => b.total - a.total);
  desc.sort((a, b) => b.total - a.total);
  const rubricas = [...prov.slice(0, TOP_RUBRICAS), ...desc.slice(0, TOP_RUBRICAS)];

  // ── Quebras por dimensão (setor, cargo, estab) via a view funcionario ──
  const quebra = async (grupoExpr: string, join: string): Promise<CustoGrupo[]> => {
    const q = await client.query<{ grupo: string; proventos: number; funcs: number }>(
      `select ${grupoExpr} grupo, ${somaProv} proventos,
              count(distinct ce.codigofunccontr)::int funcs
         from periodocalculo pc
         ${JOIN_CE}
         join funcionario fn
           on fn.codigoempresa = ce.codigoempresa and fn.codigofunccontr = ce.codigofunccontr
         ${join}
        where ${BASE}
        group by grupo
        having ${somaProv} <> 0
        order by proventos desc`,
      base4
    );
    return q.rows.map((r) => ({
      grupo: r.grupo,
      proventos: r.proventos,
      funcionarios: r.funcs,
      custoMedio: r.funcs > 0 ? r.proventos / r.funcs : 0,
    }));
  };

  const porSetor = await quebra(
    `coalesce(nullif(btrim(o.descrorgan), ''), '(sem setor)')`,
    `left join organograma o
       on o.codigoempresa = fn.codigoempresa and o.codigoestab = fn.codigoestab and o.classiforgan = fn.classiforgan`
  );
  const porCargo = await quebra(
    `coalesce(nullif(btrim(ca.descrcargo), ''), '(sem cargo)')`,
    `left join cargo ca on ca.codigocargo = fn.codigocargo`
  );
  const porEstabelecimento = await quebra(
    `coalesce(nullif(btrim(es.apelidoestab), ''), nullif(btrim(es.nomeestab), ''), '(sem estab)')`,
    `left join estab es on es.codigoempresa = fn.codigoempresa and es.codigoestab = fn.codigoestab`
  );

  return {
    empresa: { codigo: empresa, nome },
    periodo: { inicio, fim },
    resumo: {
      proventos: totProv,
      descontos: totDesc,
      liquido: totProv - totDesc,
      funcionarios,
      custoMedio: funcionarios > 0 ? totProv / funcionarios : 0,
    },
    porTipo,
    rubricas,
    serie,
    porSetor,
    porCargo,
    porEstabelecimento,
  };
}
