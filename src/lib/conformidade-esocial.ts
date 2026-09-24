import { PoolClient } from "pg";
import type {
  ConformidadeEsocialResp,
  EventoEsocial,
  PendenciaEsocial,
} from "./types";

/**
 * CONFORMIDADE ESOCIAL — o que foi transmitido, aceito, rejeitado ou está
 * pendente no eSocial. A fonte é `esocialtransacao` (uma linha por evento gerado);
 * a regra de situação está em [[Módulo de folha e eSocial do Questor]]:
 *   recibo preenchido = aceito · sem recibo + status 13 = rejeitado ·
 *   sem recibo, sem rejeição = pendente · sem transação = não enviado.
 *
 * Duas lentes: o PANORAMA por tipo de evento (volume × situação, direto da
 * transação) e as PENDÊNCIAS obrigatórias que o DP precisa caçar — admissão sem
 * S-2200 aceito e rescisão sem S-2299 aceito (liga o contrato à transação pela
 * `esocialdadoss<NNNN>`, pegando a última por `datahoralcto`, como a Produtividade
 * do DP já faz para o S-2200).
 */

/** Nome legível dos eventos eSocial mais comuns; o resto mostra o próprio código. */
const NOME_EVENTO: Record<string, string> = {
  "S-1000": "Informações do empregador",
  "S-1005": "Estabelecimentos e obras",
  "S-1010": "Rubricas",
  "S-1020": "Lotações tributárias",
  "S-1070": "Processos administrativos/judiciais",
  "S-1200": "Remuneração (folha)",
  "S-1202": "Remuneração RPPS",
  "S-1207": "Benefícios previdenciários",
  "S-1210": "Pagamentos de rendimentos",
  "S-1260": "Comercialização produção rural",
  "S-1270": "Trabalhadores avulsos",
  "S-1280": "Informações complementares",
  "S-1298": "Reabertura de eventos periódicos",
  "S-1299": "Fechamento de eventos periódicos",
  "S-2190": "Admissão preliminar",
  "S-2200": "Admissão",
  "S-2205": "Alteração cadastral",
  "S-2206": "Alteração contratual",
  "S-2210": "CAT (acidente de trabalho)",
  "S-2220": "Monitoramento da saúde (ASO)",
  "S-2221": "Exame toxicológico",
  "S-2230": "Afastamento temporário",
  "S-2231": "Cessão / requisição",
  "S-2240": "Condições ambientais do trabalho",
  "S-2245": "Treinamentos e capacitações",
  "S-2298": "Reintegração",
  "S-2299": "Desligamento",
  "S-2300": "Trabalhador sem vínculo — início",
  "S-2306": "Trabalhador sem vínculo — alteração",
  "S-2399": "Trabalhador sem vínculo — término",
  "S-3000": "Exclusão de eventos",
  "S-5001": "Contribuições sociais por trabalhador",
  "S-5002": "IRRF por trabalhador",
  "S-5003": "FGTS por trabalhador",
  "S-5011": "Contribuições sociais consolidadas",
  "S-5012": "IRRF consolidado",
  "S-5013": "FGTS consolidado",
};

const nomeEvento = (ev: string) => NOME_EVENTO[ev] ?? ev;

/** Expressão SQL: recibo preenchido (aceito pelo governo). */
const ACEITO = `t.recibo is not null and btrim(t.recibo) <> ''`;

export async function montarConformidadeEsocial(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string
): Promise<ConformidadeEsocialResp> {
  const nomeQ = await client.query<{ nome: string }>(
    `select coalesce(nomeempresa, '') nome from empresa where codigoempresa = $1`,
    [empresa]
  );
  const nome = nomeQ.rows[0]?.nome ?? String(empresa);

  // ── Panorama por tipo de evento (volume × situação) ──
  const evQ = await client.query<{
    evento: string;
    aceitos: number;
    rejeitados: number;
    pendentes: number;
  }>(
    `select et.evento,
            count(*) filter (where et.recibo is not null and btrim(et.recibo) <> '')::int aceitos,
            count(*) filter (where (et.recibo is null or btrim(et.recibo) = '') and et.status = 13)::int rejeitados,
            count(*) filter (where (et.recibo is null or btrim(et.recibo) = '') and coalesce(et.status, 0) <> 13)::int pendentes
       from esocialtransacao et
      where et.codigoempresa = $1 and et.datahoralcto::date between $2 and $3
        and et.evento is not null
      group by et.evento`,
    [empresa, inicio, fim]
  );
  const eventos: EventoEsocial[] = evQ.rows
    .map((r) => ({
      evento: r.evento,
      descricao: nomeEvento(r.evento),
      aceitos: r.aceitos,
      pendentes: r.pendentes,
      rejeitados: r.rejeitados,
      total: r.aceitos + r.pendentes + r.rejeitados,
    }))
    .sort((a, b) => b.total - a.total);

  const resumo = eventos.reduce(
    (acc, e) => ({
      total: acc.total + e.total,
      aceitos: acc.aceitos + e.aceitos,
      pendentes: acc.pendentes + e.pendentes,
      rejeitados: acc.rejeitados + e.rejeitados,
    }),
    { total: 0, aceitos: 0, pendentes: 0, rejeitados: 0 }
  );

  // ── Pendências obrigatórias: admissão (S-2200) e rescisão (S-2299) ──
  const admissoesPendentes = await pendencias(
    client,
    empresa,
    inicio,
    fim,
    "dataadm",
    "esocialdadoss2200",
    "S-2200"
  );
  const rescisoesPendentes = await pendencias(
    client,
    empresa,
    inicio,
    fim,
    "datadem",
    "esocialdadoss2299",
    "S-2299"
  );

  return {
    empresa: { codigo: empresa, nome },
    periodo: { inicio, fim },
    resumo,
    eventos,
    admissoesPendentes,
    rescisoesPendentes,
  };
}

/**
 * Contratos cujo evento obrigatório do período não foi aceito. Liga o contrato à
 * transação pela `esocialdadoss<NNNN>` (última por `datahoralcto`) e mantém só os
 * NÃO aceitos: `pendente` quando há transação sem recibo, `nao_enviado` sem
 * transação. `dataCol` é `dataadm` (admissão) ou `datadem` (desligamento).
 */
async function pendencias(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  dataCol: "dataadm" | "datadem",
  tabelaDados: string,
  evento: string
): Promise<PendenciaEsocial[]> {
  const q = await client.query<{
    contrato: number;
    funcionario: string;
    data: string;
    situacao: "pendente" | "nao_enviado";
  }>(
    `select src.codigofunccontr contrato,
            coalesce(nullif(btrim(p.nomefunc), ''), 'Contrato ' || src.codigofunccontr) funcionario,
            to_char(src.${dataCol}, 'YYYY-MM-DD') data,
            case when t.codigoesocialtransacao is not null then 'pendente' else 'nao_enviado' end situacao
       from funccontrato src
       left join funcpessoa p on p.codigofuncpessoa = src.codigofuncpessoa
       left join lateral (
         select et.recibo, et.codigoesocialtransacao
           from ${tabelaDados} d
           join esocialtransacao et
             on et.codigoempresa = d.codigoempresa and et.codigoesocialtransacao = d.codigoesocialtransacao
          where d.codigoempresa = src.codigoempresa and d.codigofunccontr = src.codigofunccontr
            and et.evento = $4
          order by et.datahoralcto desc
          limit 1
       ) t on true
      where src.codigoempresa = $1 and src.${dataCol} between $2 and $3
        and not (${ACEITO})
      order by src.${dataCol} desc`,
    [empresa, inicio, fim, evento]
  );
  return q.rows;
}
