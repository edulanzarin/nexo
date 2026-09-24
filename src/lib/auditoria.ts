import "server-only";
import { appQuery } from "./app-db";
import { getSessaoOpcional } from "./sessao";

/**
 * Trilha de auditoria: registra acesso a dado sensível (ver ficha, gerar laudo,
 * exportar) num sistema com PII e dado fiscal. Ver migration 015.
 *
 * O registro é BEST-EFFORT: nunca derruba o fluxo principal. Se o banco do app
 * estiver fora ou a sessão sumir, engole o erro (loga no servidor) — auditar é
 * importante, mas não a ponto de impedir o usuário de ver a ficha que pediu.
 */

export interface EventoAuditoria {
  /** Verbo estável, prefixado pelo módulo: 'folha.ficha.ver', 'contabil.laudo.gerar'. */
  acao: string;
  modulo?: string;
  /** Descrição legível do alvo: nome do colaborador, "Empresa 12 · 2026-01 a 2026-06". */
  alvo?: string;
  codigoempresa?: number | null;
  detalhe?: Record<string, unknown>;
}

/** Grava um evento na trilha. Resolve o autor pela sessão do request. */
export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    const sessao = await getSessaoOpcional();
    if (!sessao) return; // sem autor, não há o que auditar
    const modulo = evento.modulo ?? evento.acao.split(".")[0] ?? null;
    await appQuery(
      `insert into auditoria (usuario_id, usuario_nome, acao, modulo, alvo, codigoempresa, detalhe)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessao.usuario.id,
        sessao.usuario.nome,
        evento.acao,
        modulo,
        evento.alvo ?? null,
        evento.codigoempresa ?? null,
        evento.detalhe ? JSON.stringify(evento.detalhe) : null,
      ]
    );
  } catch (err) {
    console.error("[auditoria]", err instanceof Error ? err.message : err);
  }
}

export interface LinhaAuditoria {
  id: number;
  usuario_nome: string;
  acao: string;
  modulo: string | null;
  alvo: string | null;
  codigoempresa: number | null;
  criado_em: string;
}

export interface FiltroAuditoria {
  modulo?: string;
  busca?: string;
  limite?: number;
  offset?: number;
}

/** Lista a trilha (mais recente primeiro) para a tela de administração. */
export async function listarAuditoria(
  filtro: FiltroAuditoria = {}
): Promise<{ linhas: LinhaAuditoria[]; total: number }> {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (filtro.modulo) {
    params.push(filtro.modulo);
    cond.push(`modulo = $${params.length}`);
  }
  if (filtro.busca?.trim()) {
    params.push(`%${filtro.busca.trim()}%`);
    cond.push(`(usuario_nome ilike $${params.length} or alvo ilike $${params.length} or acao ilike $${params.length})`);
  }
  const where = cond.length ? `where ${cond.join(" and ")}` : "";

  const limite = Math.min(Math.max(filtro.limite ?? 100, 1), 500);
  const offset = Math.max(filtro.offset ?? 0, 0);

  const [linhas, [tot]] = await Promise.all([
    appQuery<LinhaAuditoria>(
      `select id, usuario_nome, acao, modulo, alvo, codigoempresa,
              to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em
         from auditoria ${where}
        order by criado_em desc
        limit ${limite} offset ${offset}`,
      params
    ),
    appQuery<{ n: number }>(`select count(*)::int as n from auditoria ${where}`, params),
  ]);
  return { linhas, total: tot?.n ?? 0 };
}
