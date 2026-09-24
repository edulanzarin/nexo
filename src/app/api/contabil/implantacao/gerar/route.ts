import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { registrarAuditoria } from "@/lib/auditoria";
import { casarLinhas } from "@/lib/implantacao-servico";
import { gerarArquivoImplantacao } from "@/lib/implantacao-gerar";
import type { LinhaOrigem } from "@/lib/implantacao-tipos";

/**
 * Gera o arquivo de importação do Questor. Re-casa as linhas que a tela já leu
 * do PDF aplicando os overrides salvos (fonte da verdade), aplica os parâmetros
 * do lote e devolve o texto. Gerar arquivo de dado contábil é evento auditável.
 */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as {
    empresa: number;
    estab: number;
    data: string;
    contaImplantacao: number;
    codigoHistorico: number;
    complemento: string;
    linhas: LinhaOrigem[];
  };
  if (!Number.isInteger(body.empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(body.empresa);
  if (!Number.isInteger(body.estab)) throw new FilterError("Informe a filial (estabelecimento)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data ?? "")) throw new FilterError("Informe a data dos lançamentos");
  if (!Number.isInteger(body.contaImplantacao)) throw new FilterError("Escolha a conta transitória de implantação");
  if (!Number.isInteger(body.codigoHistorico)) throw new FilterError("Informe o código do histórico");
  if (!Array.isArray(body.linhas) || !body.linhas.length) throw new FilterError("Leia o balancete antes de gerar");

  const casadas = await casarLinhas(body.empresa, body.linhas);
  const res = gerarArquivoImplantacao(casadas, {
    empresa: body.empresa,
    estab: body.estab,
    data: body.data,
    contaImplantacao: body.contaImplantacao,
    codigoHistorico: body.codigoHistorico,
    complemento: body.complemento ?? "",
  });

  await registrarAuditoria({
    acao: "contabil.implantacao.gerar",
    alvo: `Empresa ${body.empresa} · ${body.data} · ${res.linhas} lançamentos`,
    codigoempresa: body.empresa,
    detalhe: {
      linhas: res.linhas,
      totalDebito: res.totalDebito,
      totalCredito: res.totalCredito,
      transitoriaZera: res.transitoriaZera,
      semConta: res.semConta.length,
    },
  });

  return res;
});
