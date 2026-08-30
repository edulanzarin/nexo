import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { FilterError } from "@/lib/fiscal-filters";
import {
  contasFaltantes,
  listarContasBanco,
  regrasDaConta,
  removerRegra,
  replicarRegras,
  salvarRegra,
  type Destino,
} from "@/lib/extrato-store";

/**
 * Sem `conta`: as contas que já têm regra, para a tela mostrar onde há cadastro.
 * Com `conta`: as regras daquela conta — mesmo que ainda não exista cadastro,
 * porque não há passo de "adicionar conta": ela vem do plano do Questor e o
 * cadastro nasce quando a primeira regra é salva.
 */
export const GET = apiRoute(async (req) => {
  const p = req.nextUrl.searchParams;
  const empresa = Number(p.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);

  // Prévia da replicação: quais contrapartidas não existem no plano do destino.
  const faltantesConta = p.get("faltantesDe");
  const faltantesEm = p.get("faltantesEm");
  if (faltantesConta && faltantesEm) {
    const c = Number(faltantesConta);
    const d = Number(faltantesEm);
    if (!Number.isInteger(c) || !Number.isInteger(d)) throw new FilterError("Parâmetros inválidos");
    await assertEmpresaVisivel(d);
    return { faltantes: await contasFaltantes({ empresa, conta: c }, d) };
  }

  const contaParam = p.get("conta");
  if (contaParam) {
    const conta = Number(contaParam);
    if (!Number.isInteger(conta)) throw new FilterError("Conta inválida");
    return await regrasDaConta(empresa, conta);
  }

  return await listarContasBanco(empresa);
});

interface Corpo {
  acao?: "regra" | "replicar";
  empresa?: number;
  conta?: number;
  // regra
  id?: number;
  termo?: string;
  tipo?: string;
  contaPagamento?: number | null;
  contaRecebimento?: number | null;
  historico?: string | null;
  ativo?: boolean;
  // replicação
  destinos?: Destino[];
}

export const POST = apiRoute(async (req) => {
  const c = (await req.json()) as Corpo;
  if (!Number.isInteger(c.empresa) || !Number.isInteger(c.conta)) {
    throw new FilterError("Informe a empresa e a conta do banco");
  }
  await assertEmpresaVisivel(c.empresa!);

  if (c.acao === "replicar") {
    if (!c.destinos?.length) throw new FilterError("Escolha ao menos um destino para replicar");
    for (const d of c.destinos) {
      if (!Number.isInteger(d.empresa) || !Number.isInteger(d.conta)) {
        throw new FilterError("Destino inválido");
      }
      await assertEmpresaVisivel(d.empresa);
    }
    const resultado = await replicarRegras({ empresa: c.empresa!, conta: c.conta! }, c.destinos);
    await registrarAuditoria({
      acao: "contabil.regra.replicar",
      modulo: "contabil",
      alvo: `Conta ${c.conta} da empresa ${c.empresa} para ${c.destinos.length} destino(s)`,
      codigoempresa: c.empresa!,
      detalhe: { conta: c.conta, destinos: c.destinos.length },
    });
    return { resultado, ok: true };
  }

  const termo = (c.termo ?? "").trim();
  if (!termo) throw new FilterError("Informe o termo a procurar na descrição");
  if (c.tipo !== "exato" && c.tipo !== "parcial") throw new FilterError("Tipo inválido");
  if (c.contaPagamento == null && c.contaRecebimento == null) {
    throw new FilterError("Informe a conta de pagamento, a de recebimento, ou as duas");
  }

  const id = await salvarRegra({
    id: c.id,
    empresa: c.empresa!,
    conta: c.conta!,
    termo,
    tipo: c.tipo,
    contaPagamento: c.contaPagamento ?? null,
    contaRecebimento: c.contaRecebimento ?? null,
    historico: c.historico?.trim() || null,
    ativo: c.ativo ?? true,
  });
  // Regra de extrato é o cadastro que faz a Conciliação acertar a contrapartida
  // sozinha: escrevê-la é o trabalho que evita o próximo lançamento a dedo.
  await registrarAuditoria({
    acao: "contabil.regra.salvar",
    modulo: "contabil",
    alvo: `"${termo}" · conta ${c.conta} · empresa ${c.empresa}`,
    codigoempresa: c.empresa!,
    detalhe: { conta: c.conta, termo, tipo: c.tipo, novo: c.id == null },
  });
  return { id, ok: true };
});

export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("regra"));
  if (!Number.isInteger(id)) throw new FilterError("Regra inválida");
  const ok = await removerRegra(id);
  if (ok) {
    await registrarAuditoria({
      acao: "contabil.regra.remover",
      modulo: "contabil",
      alvo: `Regra ${id}`,
      detalhe: { regra: id },
    });
  }
  return { ok };
});
