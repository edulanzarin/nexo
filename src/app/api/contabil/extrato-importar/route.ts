import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { textoDoPdf } from "@/lib/pdf-texto";
import { lerOfx } from "@/lib/extrato-ofx";
import { lerPdf, PdfNaoReconhecido, type PdfLido } from "@/lib/extrato-pdf";
import { regrasDaConta } from "@/lib/extrato-store";
import { anotarPessoas } from "@/lib/contabil-funcionarios";
import { gerarLancamentos, type RegraExtrato } from "@/lib/regras-extrato";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Lê um extrato (OFX ou PDF), aplica as regras cadastradas da conta de banco e
 * devolve os lançamentos que seriam gerados. Não grava nada: é prévia, para
 * conferir antes de exportar.
 */
export const POST = apiRoute(async (req) => {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const empresa = Number(form.get("empresa"));
  const conta = Number(form.get("conta"));
  const senha = (form.get("senha") as string | null)?.trim() || undefined;

  if (!(arquivo instanceof File)) throw new FilterError("Envie o arquivo do extrato");
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);
  if (!Number.isInteger(conta)) throw new FilterError("Selecione a conta de banco");
  if (arquivo.size > MAX_BYTES) throw new FilterError("Arquivo muito grande (máx. 15 MB)");

  // Não exige cadastro prévio: qualquer conta de banco do plano serve, e sem
  // regra o extrato ainda é lido — as transações saem como pendentes.
  const banco = await regrasDaConta(empresa, conta);

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();

  let extrato: PdfLido;
  try {
    if (nome.endsWith(".pdf")) {
      extrato = lerPdf(await textoDoPdf(bytes, senha));
    } else {
      // OFX e variantes (.ofx, .qfx, .sta) são texto.
      extrato = lerOfx(bytes.toString("utf8"));
    }
  } catch (err) {
    if (err instanceof PdfNaoReconhecido) throw new FilterError(err.message);
    throw err;
  }

  if (!extrato.transacoes.length) {
    throw new FilterError("Nenhuma transação encontrada no arquivo");
  }

  const regras: RegraExtrato[] = banco.regras.map((r) => ({
    id: r.id,
    termo: r.termo,
    termoOriginal: r.termoOriginal,
    tipo: r.tipo,
    contaPagamento: r.contaPagamento,
    contaRecebimento: r.contaRecebimento,
    historico: r.historico,
    ativo: r.ativo,
  }));

  const lancamentos = gerarLancamentos(extrato.transacoes, banco.conta, regras);

  // Quem é gente da casa: o extrato não diz, mas a folha mora no mesmo banco.
  // Roda DEPOIS das regras e não interfere nelas — a conta continua sendo
  // escolha do contábil; o selo só o poupa de ir caçar na folha.
  const pessoas = await anotarPessoas(
    empresa,
    lancamentos.map((l) => l.descricao)
  );
  lancamentos.forEach((l, i) => {
    l.pessoa = pessoas[i];
  });

  const resumo = {
    total: lancamentos.length,
    prontos: lancamentos.filter((l) => !l.pendencia).length,
    semRegra: lancamentos.filter((l) => l.pendencia === "sem_regra").length,
    semConta: lancamentos.filter((l) => l.pendencia === "sem_conta").length,
    ambiguos: lancamentos.filter((l) => l.ambiguo).length,
    entradas: extrato.transacoes.filter((t) => t.valor > 0).reduce((a, b) => a + b.valor, 0),
    saidas: extrato.transacoes.filter((t) => t.valor < 0).reduce((a, b) => a + b.valor, 0),
  };

  return {
    arquivo: arquivo.name,
    banco: extrato.banco,
    agencia: extrato.agencia,
    conta: extrato.conta,
    inicio: extrato.inicio,
    fim: extrato.fim,
    // null = o extrato não traz saldo corrente, então não há o que conferir.
    saldoConfere: extrato.saldoConfere ?? null,
    contaBanco: { conta: banco.conta, descricao: banco.descricao, apelido: banco.apelido },
    resumo,
    lancamentos,
  };
});
