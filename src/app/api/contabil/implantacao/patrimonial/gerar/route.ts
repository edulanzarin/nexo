import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { FilterError } from "@/lib/fiscal-filters";
import { gerarArquivoPatrimonial } from "@/lib/patrimonial-gerar";
import { validarContasBens } from "@/lib/patrimonial-servico";
import type { BemLido } from "@/lib/patrimonial-tipos";

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** O corpo vem da tela, editado à mão: cada bem é validado antes de virar linha. */
function validarBem(b: BemLido, contas: Set<string>): void {
  const qual = `Bem ${b?.codigo ?? "?"}`;
  if (!b || typeof b.descricao !== "string" || !b.descricao.trim()) {
    throw new FilterError(`${qual}: descrição vazia`);
  }
  if (!contas.has(b.conta)) throw new FilterError(`${qual}: conta de origem desconhecida`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.aquisicao ?? "")) {
    throw new FilterError(`${qual}: data de aquisição inválida`);
  }
  if (!finito(b.valor) || b.valor <= 0) throw new FilterError(`${qual}: valor inválido`);
  if (!finito(b.depreciacao) || b.depreciacao < 0) {
    throw new FilterError(`${qual}: depreciação acumulada inválida`);
  }
  if (!finito(b.taxa) || b.taxa < 0 || b.taxa > 100) throw new FilterError(`${qual}: taxa inválida`);
  if (!finito(b.quantidade) || b.quantidade <= 0) throw new FilterError(`${qual}: quantidade inválida`);
}

/**
 * Gera o arquivo de importação do patrimonial. As contas do Questor vêm da tela
 * (o que o usuário está vendo) e são conferidas contra o plano da empresa.
 * Gerar arquivo de dado contábil é evento auditável.
 */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as {
    empresa: number;
    sistema?: string;
    contas: { chave: string; conta: number | null }[];
    bens: BemLido[];
  };
  if (!Number.isInteger(body.empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(body.empresa);
  if (!Array.isArray(body.contas) || !Array.isArray(body.bens) || !body.bens.length) {
    throw new FilterError("Leia o relatório de bens antes de gerar");
  }

  const contas = await validarContasBens(body.empresa, body.contas);
  const chaves = new Set(contas.keys());
  for (const b of body.bens) validarBem(b, chaves);

  // Só pesa conta que ainda tem bem: a que ficou vazia na tela não vai pro arquivo.
  const usadas = new Set(body.bens.map((b) => b.conta));
  const semConta = [...usadas].filter((chave) => contas.get(chave) == null).length;
  if (semConta) {
    throw new FilterError(
      semConta === 1
        ? "Uma conta do relatório ainda está sem conta do Questor"
        : `${semConta} contas do relatório ainda estão sem conta do Questor`
    );
  }

  const res = gerarArquivoPatrimonial(body.bens, (chave) => contas.get(chave) ?? null);

  await registrarAuditoria({
    acao: "contabil.implantacao.patrimonial",
    alvo: `Empresa ${body.empresa} · ${res.linhas} bens`,
    codigoempresa: body.empresa,
    detalhe: {
      bens: res.linhas,
      valor: res.valor,
      depreciacao: res.depreciacao,
      sistema: body.sistema ?? null,
    },
  });

  return res;
});
