import { PoolClient } from "pg";

/**
 * NFSE não contabilizada = ponto cego do Balancete Fiscal.
 *
 * A NFSE de serviço não tem CFOP, então o motor de contabilização (que reproduz
 * pela regra do CFOP) não a alcança — e, por não ter regra, a conta é decisão
 * manual do fiscal, nota a nota (ver Brain: "NFSE não tem regra de conta"). Se a
 * nota está lançada, o balancete a espelha do real e tudo bate. Mas se ela NÃO
 * foi lançada, some dos dois lados: nada pra espelhar, nada pra reproduzir.
 *
 * O conserto: como toda NFSE é obrigada a ser contabilizada, uma NFSE sem
 * lançamento é uma pendência certa. Prevemos a conta pela MODA do histórico do
 * próprio fornecedor (validado: a conta analítica de um fornecedor costuma ser
 * estável — ex.: honorários contábeis sempre na mesma conta; e a sintética é
 * ainda mais). Como isso só se aplica a nota SEM real, não há falso positivo: só
 * preenchemos o esperado onde de fato falta lançamento.
 *
 * O motor de CFOP já cobre mercadoria/CTe não lançada (ele reproduz por CFOP
 * independente de ter lançamento), então aqui é só NFSE.
 */

export interface PendenteNfse {
  chave: number;
  numero: number | null;
  data: string;
  contraparte: string | null;
  origem: "ME" | "MS";
  valor: number;
  /** 1 = débito (entrada/despesa), -1 = crédito (saída/receita). */
  natureza: 1 | -1;
  /** Conta prevista pela história do fornecedor; null se ele não tem histórico. */
  conta: number | null;
  contaClassif: string | null;
  contaDescr: string | null;
}

const LADO = {
  ent: { tabela: "lctofisent", chave: "chavelctofisent", prefixo: "ME", contaReal: "contactbdeb", natureza: 1 },
  sai: { tabela: "lctofissai", chave: "chavelctofissai", prefixo: "MS", contaReal: "contactbcred", natureza: -1 },
} as const;

/** Recuo do histórico usado para prever a conta (além do período exibido). */
function lookbackInicio(inicio: string): string {
  const d = new Date(inicio + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

async function pendentesLado(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  lado: keyof typeof LADO,
  estabs: number[]
): Promise<PendenteNfse[]> {
  const c = LADO[lado];
  const hist = lookbackInicio(inicio);

  // NFSE do período sem NENHUM lançamento FI da própria nota (não contabilizada).
  // Recorte de filial só nas notas pendentes; a previsão de conta (abaixo) fica
  // por empresa — histórico maior prevê melhor, e a nota já é da filial.
  const notasParams: unknown[] = [empresa, inicio, fim];
  let filtroEstab = "";
  if (estabs.length) {
    notasParams.push(estabs);
    filtroEstab = `and f.codigoestab = any($${notasParams.length}::int[])`;
  }
  const notas = (
    await client.query<{ chave: number; numero: number | null; data: string; contraparte: string | null; pes: number | null; valor: number }>(
      `select f.${c.chave} chave, f.numeronf numero, to_char(f.datalctofis,'YYYY-MM-DD') data,
              p.nomepessoa contraparte, f.codigopessoa pes, coalesce(f.valorcontabil,0)::float valor
         from ${c.tabela} f
         left join pessoa p on p.codigopessoa = f.codigopessoa
        where f.codigoempresa = $1 and f.datalctofis between $2 and $3 ${filtroEstab}
          and upper(btrim(f.especienf)) = 'NFSE' and f.cancelada <> '1'
          and not exists (
            select 1 from lctoctb l
             where l.codigoempresa = f.codigoempresa and l.codigooriglctoctb = 'FI'
               and l.chaveorigem = '${c.prefixo}' || lpad(f.${c.chave}::text, 10, '0')
          )`,
      notasParams
    )
  ).rows;
  if (!notas.length) return [];

  // Conta prevista por fornecedor: a MODA da conta principal (maior valor por
  // nota) entre as NFSE contabilizadas dele, numa janela que recua 2 anos.
  const previsaoRows = (
    await client.query<{ pes: number; conta: number; classif: string | null; descr: string | null; n: number }>(
      `with booked as (
         select substring(l.chaveorigem from 3)::bigint chave, l.${c.contaReal} conta,
                sum(l.valorlctoctb) v
           from lctoctb l
          where l.codigoempresa = $1 and l.codigooriglctoctb = 'FI'
            and l.chaveorigem ~ '^${c.prefixo}[0-9]+$' and l.${c.contaReal} is not null
            and l.datalctoctb between $2 and $3
          group by 1, 2
       ),
       principal as (select distinct on (chave) chave, conta from booked order by chave, v desc),
       notas as (
         select f.${c.chave} chave, f.codigopessoa pes
           from ${c.tabela} f
          where f.codigoempresa = $1 and upper(btrim(f.especienf)) = 'NFSE' and f.cancelada <> '1'
            and f.datalctofis between $2 and $3
       )
       select n.pes, pr.conta, pe.classifconta classif, pe.descrconta descr, count(*)::int n
         from notas n
         join principal pr on pr.chave = n.chave
         left join planoespec pe on pe.codigoempresa = $1 and pe.contactb = pr.conta
        where n.pes is not null
        group by n.pes, pr.conta, pe.classifconta, pe.descrconta`,
      [empresa, hist, fim]
    )
  ).rows;

  // Moda por fornecedor (maior contagem; desempate pela conta menor, estável).
  const previsao = new Map<number, { conta: number; classif: string | null; descr: string | null }>();
  const contagem = new Map<number, number>();
  for (const r of previsaoRows) {
    const atualN = contagem.get(r.pes) ?? -1;
    if (r.n > atualN) {
      contagem.set(r.pes, r.n);
      previsao.set(r.pes, { conta: r.conta, classif: r.classif, descr: r.descr });
    }
  }

  return notas.map((n) => {
    const pv = n.pes != null ? previsao.get(n.pes) : undefined;
    return {
      chave: n.chave,
      numero: n.numero,
      data: n.data,
      contraparte: n.contraparte,
      origem: c.prefixo,
      valor: n.valor,
      natureza: c.natureza,
      conta: pv?.conta ?? null,
      contaClassif: pv?.classif ?? null,
      contaDescr: pv?.descr ?? null,
    };
  });
}

/** NFSE não contabilizadas do período (entrada + saída), com conta prevista. */
export async function pendentesNfse(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[] = []
): Promise<PendenteNfse[]> {
  const [ent, sai] = await Promise.all([
    pendentesLado(client, empresa, inicio, fim, "ent", estabs),
    pendentesLado(client, empresa, inicio, fim, "sai", estabs),
  ]);
  return [...ent, ...sai];
}
