import type { NextRequest } from "next/server";
import { apiRoute } from "./api-route";
import { FilterError } from "./fiscal-filters";
import {
  podeLerRelatorio,
  podeLerSetor,
  podePreencher,
  sessaoPM,
  setorDaRota,
} from "./postmortem-acesso";
import { SECAO_PM_GESTAO } from "./postmortem-secoes";
import type { SetorPM } from "./postmortem-setores";
import {
  criarPostMortem,
  excluirPostMortem,
  listarDoSetor,
  listarMeus,
  obterPostMortem,
  salvarPostMortem,
  enviarPostMortem,
} from "./postmortem";
import { coerceDados } from "./postmortem-tipos";
import type { Sessao } from "./sessao";

/**
 * Os handlers do Post Mortem, escritos UMA vez e reexportados pelas rotas de
 * cada módulo de setor (`/api/fiscal/post-mortem`, `/api/folha/post-mortem`…).
 *
 * Por que a rota é namespaceada por módulo em vez de um `/api/postmortem`
 * único: o gate do `apiRoute` deriva o módulo do CAMINHO, e a permissão do post
 * mortem agora é por setor. Um caminho comum obrigaria o gate a confiar num
 * parâmetro para saber qual setor conferir — e parâmetro é do cliente. Com o
 * módulo no caminho, quem pede o post mortem do Fiscal passa pelo gate do
 * Fiscal antes de o handler rodar.
 *
 * O setor, por consequência, nunca vem do corpo nem da query: sai do caminho.
 */
function setorDaRequisicao(req: NextRequest): SetorPM {
  const m = req.nextUrl.pathname.match(/^\/api\/([a-z]+)\/post-mortem(?:\/|$)/);
  if (!m) throw new FilterError("Rota inválida");
  return setorDaRota(m[1]);
}

function idDaRota(id: string | undefined): number {
  const n = Number(id);
  if (!Number.isInteger(n)) throw new FilterError("Id inválido");
  return n;
}

/**
 * Lê um relatório conferindo as duas coisas que o caminho promete: que ele é do
 * setor pedido (relatório de outro setor não existe neste caminho) e que a
 * sessão pode lê-lo. Some como "não encontrado" para quem não pode — não
 * revela existência.
 */
async function lerOuSumir(id: number, setor: SetorPM, sessao: Sessao) {
  const rel = await obterPostMortem(id);
  if (!rel || rel.setor !== setor.id || !podeLerRelatorio(sessao, rel)) {
    throw new FilterError("Relatório não encontrado");
  }
  return rel;
}

/**
 * `GET /api/<modulo>/post-mortem?secao=…` — a lista. `post-mortem-gestao`
 * devolve o setor inteiro; qualquer outra coisa devolve os do próprio usuário.
 * O gate do apiRoute já garantiu ALGUMA das duas seções; o recorte fino é aqui.
 *
 * `POST` cria um rascunho do próprio usuário no setor do caminho.
 */
export const GET = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  const setor = setorDaRequisicao(req);

  if (req.nextUrl.searchParams.get("secao") === SECAO_PM_GESTAO) {
    if (!podeLerSetor(sessao, setor)) {
      throw new FilterError("Você não lê os relatórios deste setor");
    }
    return listarDoSetor(setor.id);
  }

  if (!podePreencher(sessao, setor) && !podeLerSetor(sessao, setor)) {
    throw new FilterError("Você não tem acesso a este setor");
  }
  return listarMeus(sessao.usuario.id, setor.id);
});

export const POST = apiRoute(async (req) => {
  const sessao = await sessaoPM();
  const setor = setorDaRequisicao(req);
  if (!podePreencher(sessao, setor)) {
    throw new FilterError("Você não preenche o relatório deste setor");
  }
  const id = await criarPostMortem(sessao.usuario.id, setor.id);
  return { id };
});

/** `GET /api/<modulo>/post-mortem/<id>` — dono sempre; alheio só a gestão do setor. */
export const GET_RELATORIO = apiRoute(async (req, ctx) => {
  const sessao = await sessaoPM();
  const setor = setorDaRequisicao(req);
  return lerOuSumir(idDaRota((await ctx.params).id), setor, sessao);
});

/** Salva o rascunho (só o dono, só enquanto rascunho). */
export const PATCH_RELATORIO = apiRoute(async (req, ctx) => {
  const sessao = await sessaoPM();
  await salvarPostMortem(
    idDaRota((await ctx.params).id),
    sessao.usuario.id,
    setorDaRequisicao(req).id,
    coerceDados(await req.json())
  );
  return { ok: true };
});

/** Exclui um rascunho do próprio autor. */
export const DELETE_RELATORIO = apiRoute(async (req, ctx) => {
  const sessao = await sessaoPM();
  await excluirPostMortem(
    idDaRota((await ctx.params).id),
    sessao.usuario.id,
    setorDaRequisicao(req).id
  );
  return { ok: true };
});

/**
 * Envia: grava o corpo, cobra os campos essenciais, aloca o nº sequencial e
 * fecha. Só o dono, só a partir de rascunho. Devolve o número.
 */
export const POST_ENVIAR = apiRoute(async (req, ctx) => {
  const sessao = await sessaoPM();
  const numero = await enviarPostMortem(
    idDaRota((await ctx.params).id),
    sessao.usuario.id,
    setorDaRequisicao(req).id,
    coerceDados(await req.json())
  );
  return { numero };
});
