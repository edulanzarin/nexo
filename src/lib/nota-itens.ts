import { query } from "./db";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional, podeVerEmpresa } from "./sessao";
import type { NotaItem } from "./types";

/**
 * Itens (produtos) de uma nota. A mesma consulta serve o Fiscal (drill-down do
 * explorador de notas) e o Contábil (modal de detalhe da Conferência) — cada
 * módulo pela sua própria rota, gateada pelo módulo; a query é uma só.
 */
export async function buscarNotaItens(sp: URLSearchParams): Promise<NotaItem[]> {
  const tipo = sp.get("tipo") === "ent" ? "ent" : "sai";
  const empresa = Number(sp.get("empresa"));
  const chave = sp.get("chave") ?? "";
  if (!Number.isInteger(empresa) || !/^\d+$/.test(chave)) {
    throw new FilterError("empresa e chave são obrigatórios");
  }
  // Drill-down por empresa avulsa: sem o funil do buildWhere, o escopo se trava
  // aqui — inclusive as empresas do RH, invisíveis fora do módulo RH.
  const sessao = await getSessaoOpcional();
  if (!sessao || !podeVerEmpresa(sessao, empresa)) {
    throw new FilterError("Empresa fora do seu escopo de acesso");
  }
  const tabela = `lctofis${tipo}produto`;
  const chaveCol = tipo === "ent" ? "chavelctofisent" : "chavelctofissai";

  return query<NotaItem>(
    `select f.seq as seq,
            f.codigoproduto as produto,
            pr.descrproduto as descricao,
            f.codigocfop as cfop,
            cf.descrcfop as "cfopDescr",
            nullif(btrim(f.unidademedida), '') as unidade,
            f.quantidade::float as quantidade,
            f.valorunitario::float as "valorUnitario",
            f.valortotal::float as "valorTotal",
            coalesce(f.valoricms, 0)::float as icms,
            coalesce(f.valoripi, 0)::float as ipi
       from ${tabela} f
       left join produto pr on pr.codigoempresa = f.codigoempresa
                           and pr.codigoproduto = f.codigoproduto
       left join cfop cf on cf.codigoempresa = f.codigoempresa
                        and cf.codigoestab = f.codigoestab
                        and cf.codigocfop = f.codigocfop
      where f.codigoempresa = $1 and f.${chaveCol} = $2
      order by f.seq`,
    [empresa, chave]
  );
}
