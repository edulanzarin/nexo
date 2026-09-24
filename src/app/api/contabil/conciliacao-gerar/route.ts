import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { gerarArquivoConciliacao, type LancamentoCsv } from "@/lib/conciliacao-gerar";

/**
 * Gera o CSV de importação do Questor a partir dos lançamentos JÁ resolvidos
 * da Conciliação (regra casada ou conta escolhida à mão). Só os prontos entram —
 * pendência não vira linha. Não grava nada no Questor; devolve o texto que o
 * contador importa. Gerar dado contábil é evento auditável.
 */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as {
    empresa?: number;
    estab?: number;
    lancamentos?: LancamentoCsv[];
  };

  if (!Number.isInteger(body.empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(body.empresa!);
  if (!Number.isInteger(body.estab)) throw new FilterError("Informe a filial (estabelecimento)");
  if (!Array.isArray(body.lancamentos) || !body.lancamentos.length) {
    throw new FilterError("Nenhum lançamento pronto para exportar");
  }

  const contas = new Set<number>();
  for (const l of body.lancamentos) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data ?? "")) throw new FilterError("Lançamento com data inválida");
    if (!Number.isInteger(l.contaDebito) || !Number.isInteger(l.contaCredito)) {
      throw new FilterError("Lançamento sem conta de débito ou crédito");
    }
    if (!Number.isFinite(l.valor) || l.valor <= 0) throw new FilterError("Lançamento com valor inválido");
    contas.add(l.contaDebito);
    contas.add(l.contaCredito);
  }

  // Nada de arquivo apontando para conta que não existe no plano da empresa: o
  // Questor recusaria a importação inteira, longe da causa.
  const { rows } = await pool.query<{ contactb: number }>(
    `select contactb from planoespec
      where codigoempresa = $1 and tipoconta = 2 and contactb = any($2::bigint[])`,
    [body.empresa, [...contas]]
  );
  const existem = new Set(rows.map((r) => r.contactb));
  const faltando = [...contas].filter((c) => !existem.has(c));
  if (faltando.length) {
    throw new FilterError(`Conta ${faltando.join(", ")} não existe no plano desta empresa (ou não é analítica)`);
  }

  const res = gerarArquivoConciliacao(body.lancamentos, { estab: body.estab! });

  await registrarAuditoria({
    acao: "contabil.conciliacao.gerar",
    alvo: `Empresa ${body.empresa} · ${res.linhas} lançamentos`,
    codigoempresa: body.empresa,
    detalhe: { linhas: res.linhas, total: res.total },
  });

  return res;
});
