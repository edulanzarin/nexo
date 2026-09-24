import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { contasDoAlvo } from "@/lib/plano-contabil";
import type { BalanceteLancamento, BalanceteLancamentosResp } from "@/lib/types";

/**
 * Lançamentos REAIS (origem fiscal) que compõem o movimento de uma conta no
 * balancete — o drill-down ao clicar num valor da coluna Contábil. Aceita a
 * classificação (sintética → soma todas as analíticas abaixo) e a natureza
 * (1 débito, -1 crédito). Traz a nota de origem (ME/MS) quando existe.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  if (f.empresas.length !== 1) throw new FilterError("Selecione uma empresa");
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);
  const classif = (sp.get("classif") ?? "").trim();
  if (!classif) throw new FilterError("classif é obrigatório");
  const natureza = sp.get("natureza") === "-1" ? -1 : 1;
  const natCol = natureza === 1 ? "contactbdeb" : "contactbcred";
  const conta = Number(sp.get("conta") ?? 0);
  const sintetica = sp.get("sintetica") === "1";

  const client = await pool.connect();
  try {
    const contas = await contasDoAlvo(client, empresa, classif, sintetica, conta);
    if (!contas.length) {
      return { lancamentos: [], total: 0 } satisfies BalanceteLancamentosResp;
    }

    const rows = await client.query<BalanceteLancamento>(
      `with lc as (
         select to_char(l.datalctoctb,'YYYY-MM-DD') data,
                case when l.chaveorigem like 'MOV%' then 'MOV'
                     else substring(l.chaveorigem from 1 for 2) end origem,
                -- só ME/MS têm chave de nota; IM (apuração, ex.: 'IMP01') / RE não.
                case when l.chaveorigem ~ '^M[ES][0-9]+$'
                     then substring(l.chaveorigem from 3)::bigint end chave,
                l.valorlctoctb::float valor, l.complhist hist, l.${natCol} conta
           from lctoctb l
          where l.codigoempresa=$1 and l.codigooriglctoctb='FI'
            -- toda origem fiscal (notas ME/MS + consolidação MOV + apuração IM + retenção RE)
            and l.datalctoctb between $2 and $3 and l.${natCol} = any($4::bigint[])${f.estabs.length ? ` and l.codigoestab = any($5::int[])` : ""}
       )
       select lc.data, lc.origem, lc.chave, lc.valor, lc.conta,
              coalesce(nullif(lc.hist,''), '') historico,
              coalesce(e.numeronf, s.numeronf) numero,
              upper(btrim(coalesce(e.especienf, s.especienf))) especie,
              coalesce(pe.nomepessoa, ps.nomepessoa) contraparte
         from lc
         left join lctofisent e on lc.origem='ME' and e.codigoempresa=$1 and e.chavelctofisent=lc.chave
         left join lctofissai s on lc.origem='MS' and s.codigoempresa=$1 and s.chavelctofissai=lc.chave
         left join pessoa pe on pe.codigopessoa=e.codigopessoa
         left join pessoa ps on ps.codigopessoa=s.codigopessoa
        order by lc.valor desc
        limit 500`,
      f.estabs.length ? [empresa, f.inicio, f.fim, contas, f.estabs] : [empresa, f.inicio, f.fim, contas]
    );

    return {
      lancamentos: rows.rows,
      total: rows.rows.length,
    } satisfies BalanceteLancamentosResp;
  } finally {
    client.release();
  }
});
