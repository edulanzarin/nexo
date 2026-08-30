import { pool } from "@/lib/db";
import { apiRoute } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { FilterError } from "@/lib/fiscal-filters";
import { listarOverrides, salvarOverride, type Override } from "@/lib/plano-override";
import { appQuery } from "@/lib/app-db";
import type { ReplicarItem, ReplicarPreviewResp, ReplicarResp } from "@/lib/types";

/**
 * Replicação de overrides do plano de contabilização entre empresas: a empresa
 * de ORIGEM tem os overrides trabalhados; o DESTINO recebe cópias, gravadas
 * como regra GERAL (estab 0) — os códigos de estabelecimento não se
 * correspondem entre empresas, então o específico da origem vira geral no
 * destino (um override de estab criado depois no destino tem precedência).
 *
 * Segurança do plano de contas: conta fixa que não existe no `planoespec` do
 * destino invalida o override (replicar cobraria uma conta que não existe lá).
 * O preview marca; a execução pula e reporta.
 */

/** Um override por CFOP: geral (estab 0) tem preferência; senão o de menor estab. */
function porCfop(overrides: Override[]): Map<number, Override> {
  const mapa = new Map<number, Override>();
  for (const o of [...overrides].sort((a, b) => a.estab - b.estab)) {
    const atual = mapa.get(o.cfop);
    if (!atual || (o.estab === 0 && atual.estab !== 0)) mapa.set(o.cfop, o);
  }
  return mapa;
}

async function montarItens(origem: number, destino: number): Promise<ReplicarItem[]> {
  const overrides = await listarOverrides(origem);
  if (!overrides.length) return [];
  const escolhidos = [...porCfop(overrides).values()].sort((a, b) => a.cfop - b.cfop);

  const client = await pool.connect();
  let descrs: Map<number, string | null>;
  let contasDestino: Set<number>;
  try {
    // Descrição dos CFOPs (da origem — é ela que o usuário está vendo).
    const dRes = await client.query<{ cfop: number; descr: string | null }>(
      `select codigocfop cfop, min(descrcfop) descr from cfop
        where codigoempresa = $1 and codigocfop = any($2::int[]) group by codigocfop`,
      [origem, escolhidos.map((o) => o.cfop)]
    );
    descrs = new Map(dRes.rows.map((r) => [r.cfop, r.descr]));

    // Plano de contas do destino — conta fixa precisa existir lá.
    const cRes = await client.query<{ conta: number }>(
      `select contactb conta from planoespec where codigoempresa = $1`,
      [destino]
    );
    contasDestino = new Set(cRes.rows.map((r) => r.conta));
  } finally {
    client.release();
  }

  // Overrides que o destino já tem (replicar substitui o geral/estab 0).
  const jaTem = new Set(
    (
      await appQuery<{ codigo_cfop: number }>(
        `select distinct codigo_cfop from conf_regra where codigo_empresa = $1`,
        [destino]
      )
    ).map((r) => r.codigo_cfop)
  );

  return escolhidos.map((o) => ({
    cfop: o.cfop,
    estab: o.estab,
    descricao: descrs.get(o.cfop) ?? null,
    contabiliza: o.contabiliza,
    observacao: o.observacao,
    linhas: o.linhas,
    contasAusentes: [
      ...new Set(
        o.linhas
          .filter((l) => !l.contaVariavel && l.conta != null && !contasDestino.has(l.conta))
          .map((l) => l.conta as number)
      ),
    ],
    jaExiste: jaTem.has(o.cfop),
  }));
}

function parseEmpresas(origem: unknown, destino: unknown): [number, number] {
  const o = Number(origem);
  const d = Number(destino);
  // > 0: Number(null) vira 0 e passaria num check só de inteiro.
  if (!Number.isInteger(o) || o <= 0 || !Number.isInteger(d) || d <= 0) {
    throw new FilterError("Informe as empresas de origem e destino");
  }
  if (o === d) throw new FilterError("Origem e destino devem ser empresas diferentes");
  return [o, d];
}

/** Preview: o que a replicação faria, com os impedimentos por item. */
export const GET = apiRoute(async (req) => {
  const p = req.nextUrl.searchParams;
  const [origem, destino] = parseEmpresas(p.get("origem"), p.get("destino"));
  return { itens: await montarItens(origem, destino) } satisfies ReplicarPreviewResp;
});

interface CorpoReplicar {
  origem?: number;
  destino?: number;
  /** CFOPs escolhidos; ausente = todos os replicáveis. */
  cfops?: number[];
}

/** Executa a replicação dos CFOPs escolhidos. */
export const POST = apiRoute(async (req) => {
  const corpo = (await req.json()) as CorpoReplicar;
  const [origem, destino] = parseEmpresas(corpo.origem, corpo.destino);
  const escolha = corpo.cfops ? new Set(corpo.cfops) : null;

  // Re-deriva do estado atual (não confia em payload de linhas do cliente).
  const itens = (await montarItens(origem, destino)).filter(
    (i) => !escolha || escolha.has(i.cfop)
  );
  if (!itens.length) throw new FilterError("Nenhum override para replicar");

  let replicados = 0;
  const pulados: number[] = [];
  for (const item of itens) {
    if (item.contasAusentes.length) {
      pulados.push(item.cfop);
      continue;
    }
    await salvarOverride({
      empresa: destino,
      estab: 0,
      cfop: item.cfop,
      contabiliza: item.contabiliza,
      observacao: item.observacao,
      linhas: item.linhas.map((l) => ({
        natureza: l.natureza,
        conta: l.contaVariavel ? null : l.conta,
        origemConta: l.origemConta,
        regraValor: l.regraValor,
        rotulo: l.descrConta,
      })),
    });
    replicados += 1;
  }
  await registrarAuditoria({
    acao: "contabil.plano.replicar",
    modulo: "contabil",
    alvo: `${replicados} CFOP(s) da empresa ${origem} para ${destino}`,
    codigoempresa: destino,
    detalhe: { origem, destino, replicados, pulados: pulados.length },
  });
  return { replicados, pulados } satisfies ReplicarResp;
});
