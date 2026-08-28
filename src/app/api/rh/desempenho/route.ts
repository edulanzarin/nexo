import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import {
  carregarDesempenho,
  criarRodada,
  encerrarAvaliacao,
  enviarAvaliacao,
  excluirAvaliacao,
  listarDesempenho,
  listarRodadas,
  type ColaboradorAvaliado,
} from "@/lib/rh-desempenho-dados";
import { listarDiretorio } from "@/lib/rh-diretorio";
import { ehEmpresaRh } from "@/lib/rh";
import { STATUS_DESEMPENHO, type StatusDesempenho } from "@/lib/rh-desempenho";
import { getSessaoOpcional } from "@/lib/sessao";

/**
 * Avaliações de desempenho. `?id=` traz o detalhe (formulário + todas as
 * respostas); `?rodadas=1` lista as rodadas para o filtro; sem nada, a lista
 * filtrada.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;

  const id = Number(sp.get("id"));
  if (Number.isInteger(id) && id > 0) {
    const d = await carregarDesempenho(id);
    if (!d) throw new FilterError("Avaliação não encontrada");
    return d;
  }
  if (sp.get("rodadas")) return listarRodadas();

  const num = (v: string | null) => (v && Number.isInteger(Number(v)) ? Number(v) : null);
  const status = sp.get("status");
  return listarDesempenho({
    empresa: num(sp.get("empresa")),
    classiforgan: sp.get("setor"),
    formularioId: num(sp.get("formulario")),
    rodadaId: num(sp.get("rodada")),
    status: STATUS_DESEMPENHO.includes(status as StatusDesempenho)
      ? (status as StatusDesempenho)
      : null,
    de: sp.get("de"),
    ate: sp.get("ate"),
    busca: sp.get("busca"),
  });
});

/**
 * POST abre uma rodada e dispara. Dois modos, mesmo caminho:
 *   { colaboradores: [...] }            -> avulsa, a dedo
 *   { escritorio: true, empresa?, setor? } -> uma avaliação por colaborador ativo
 */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const formularioId = Number(body.formularioId);
  if (!Number.isInteger(formularioId)) throw new FilterError("Escolha um formulário");

  const escritorio = body.escritorio === true;
  let colaboradores: ColaboradorAvaliado[];

  if (escritorio) {
    // O escritório inteiro é o Diretório de hoje, opcionalmente recortado por
    // empresa/setor — resolvido aqui, no disparo, e não guardado como regra.
    const empresa = Number(body.empresa);
    const setor = typeof body.setor === "string" ? body.setor : null;
    const diretorio = await listarDiretorio();
    colaboradores = diretorio
      .filter((f) => (ehEmpresaRh(empresa) ? f.codigoempresa === empresa : true))
      .filter((f) => (setor ? f.classiforgan === setor : true))
      .map((f) => ({
        codigoempresa: f.codigoempresa,
        codigofunccontr: f.contrato,
        nome: f.nome,
        classiforgan: f.classiforgan,
      }));
    if (!colaboradores.length) throw new FilterError("Nenhum colaborador nesse recorte");
  } else {
    colaboradores = Array.isArray(body.colaboradores)
      ? (body.colaboradores as ColaboradorAvaliado[])
      : [];
  }

  const sessao = await getSessaoOpcional();
  return criarRodada({
    formularioId,
    titulo: (body.titulo as string) ?? null,
    mensagem: (body.mensagem as string) ?? null,
    escopo: escritorio ? "escritorio" : "avulso",
    colaboradores,
    criadoPor: sessao?.usuario.id ?? null,
  });
});

/** PATCH age sobre UMA avaliação: reenviar aos gestores, encerrar ou reabrir. */
export const PATCH = apiRoute(async (req) => {
  const body = (await req.json()) as { id?: number; acao?: string };
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new FilterError("Avaliação não informada");

  switch (body.acao) {
    case "reenviar": {
      const enviado = await enviarAvaliacao(id);
      return { enviado };
    }
    case "encerrar":
      await encerrarAvaliacao(id, true);
      return { encerrado: true };
    case "reabrir":
      await encerrarAvaliacao(id, false);
      return { encerrado: false };
    default:
      throw new FilterError("Ação desconhecida");
  }
});

/** DELETE apaga a avaliação e suas respostas. */
export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("Avaliação não informada");
  await excluirAvaliacao(id);
  return { ok: true };
});
