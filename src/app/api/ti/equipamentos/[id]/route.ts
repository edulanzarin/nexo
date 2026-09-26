import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { getSessaoOpcional, podeSecao } from "@/lib/sessao";
import { acessosDoEquipamento } from "@/lib/ti-acessos";
import { carregarEquipamento, conferido, excluirEquipamento, salvarEquipamento } from "@/lib/ti-equipamentos";
import { lerDadosEquipamento } from "@/lib/ti-regras";

type Ctx = { params: Promise<Record<string, string>> };

async function idDaRota(ctx: Ctx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new FilterError("Equipamento inválido");
  return id;
}

/**
 * O equipamento aberto, com o histórico inteiro de quem ele passou. Os acessos
 * dele (o admin do roteador) vêm só para quem tem o cofre; para o resto, `null`.
 */
export const GET = apiRoute(async (_req, ctx) => {
  const id = await idDaRota(ctx);
  const sessao = await getSessaoOpcional();
  const [e, acessos] = await Promise.all([
    carregarEquipamento(id),
    sessao && podeSecao(sessao, "ti", "acessos") ? acessosDoEquipamento(id) : null,
  ]);
  if (!e) throw new FilterError("O equipamento não existe mais. Alguém pode ter apagado.");
  return { ...e, acessos };
});

/** Corrige o cadastro. Com quem ele está não muda aqui: isso é movimentação. */
export const PATCH = apiRoute(async (req, ctx) => {
  const id = await idDaRota(ctx);
  const corpo = await req.json().catch(() => null);
  await salvarEquipamento(id, conferido(() => lerDadosEquipamento(corpo)));
  return { id };
});

export const DELETE = apiRoute(async (_req, ctx) => {
  await excluirEquipamento(await idDaRota(ctx));
  return { ok: true };
});
