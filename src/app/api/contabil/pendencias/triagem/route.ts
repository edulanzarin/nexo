import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { appQuery } from "@/lib/app-db";
import { getSessaoOpcional } from "@/lib/sessao";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Triagem de uma pendência: resolver, ignorar ou reabrir. Grava só no banco do
 * app (conf_triagem) — o Questor nunca é tocado. O gate de seção do apiRoute já
 * exige acesso a "pendencias"; acesso à seção libera gravar, como no resto do app.
 */
const FONTES = new Set(["conferencia", "auditoria"]);
const STATUS = new Set(["resolvido", "ignorado"]);

export const POST = apiRoute(async (req) => {
  const body = await req.json().catch(() => null);
  const empresa = Number(body?.empresa);
  const fonte = body?.fonte;
  const chave = body?.chave;
  const tipo = body?.tipo;
  const status = body?.status;
  const observacao =
    typeof body?.observacao === "string" && body.observacao.trim()
      ? body.observacao.trim()
      : null;

  if (!Number.isInteger(empresa)) throw new FilterError("Empresa inválida");
  await assertEmpresaVisivel(empresa);
  if (!FONTES.has(fonte) || typeof chave !== "string" || typeof tipo !== "string") {
    throw new FilterError("Pendência inválida");
  }

  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Sessão expirada — entre novamente");

  if (status === "reabrir") {
    // Reabrir = apagar a triagem: o achado volta a contar como aberto.
    await appQuery(
      `delete from conf_triagem
        where fonte = $1 and codigo_empresa = $2 and chave = $3 and tipo = $4`,
      [fonte, empresa, chave, tipo]
    );
  } else {
    if (!STATUS.has(status)) throw new FilterError("Status inválido");
    await appQuery(
      `insert into conf_triagem
         (fonte, codigo_empresa, chave, tipo, status, observacao, usuario_id, usuario_nome)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (fonte, codigo_empresa, chave, tipo) do update
         set status = excluded.status, observacao = excluded.observacao,
             usuario_id = excluded.usuario_id, usuario_nome = excluded.usuario_nome,
             atualizado_em = now()`,
      [fonte, empresa, chave, tipo, status, observacao, sessao.usuario.id, sessao.usuario.nome]
    );
  }

  await registrarAuditoria({
    acao: "contabil.pendencia.triar",
    alvo: `${fonte}:${chave} (${tipo})`,
    codigoempresa: empresa,
    detalhe: { status },
  });

  return { ok: true };
});
