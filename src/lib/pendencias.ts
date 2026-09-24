/**
 * CENTRAL DE PENDÊNCIAS — junta, numa fila só, os achados da Conferência Fiscal
 * (notas com problema) e os da Auditoria de Lançamentos (lançamentos anômalos),
 * e cola em cada um o estado de TRIAGEM gravado no banco do app.
 *
 * Nada de novo é lido do Questor: reaproveita `conferirTudo` (a conferência sem
 * paginação de tela) e `montarAuditoria`. Os achados são recalculados ao vivo a
 * cada carga (read-only); só a triagem (resolver/ignorar) persiste — ver a
 * migration 017 e a rota de triagem.
 *
 * Identidade estável de cada achado = (fonte, chave, tipo). Como o `tipo` entra
 * na chave, uma nota que era `pendente` e virou `divergente` reaparece sozinha.
 */
import { PoolClient } from "pg";
import { conferirTudo } from "./conferencia-servico";
import { montarAuditoria } from "./auditoria-lancamentos";
import { appQuery } from "./app-db";
import type {
  LancamentoAchado,
  NotaConferida,
  Pendencia,
  PendenciasResp,
  TriagemInfo,
} from "./types";

/** Só estas três situações da conferência são "pendência". O resto (ok,
 *  consolidada, não exige, cancelada) não entra na fila. */
const CONF_META: Record<string, { titulo: string; severidade: "alta" | "media" }> = {
  pendente: { titulo: "Não contabilizada", severidade: "alta" },
  duplicada: { titulo: "Contabilizada em duplicidade", severidade: "alta" },
  divergente: { titulo: "Conta divergente", severidade: "media" },
};

function descricaoNota(n: NotaConferida): string {
  const nf = `NF ${n.numero}${n.serie ? `/${n.serie}` : ""}`;
  return n.contraparte ? `${nf} · ${n.contraparte}` : nf;
}

function descricaoLancamento(l: LancamentoAchado): string {
  const partes: string[] = [];
  if (l.contaDeb != null) partes.push(`D ${l.contaDeb}`);
  if (l.contaCred != null) partes.push(`C ${l.contaCred}`);
  const contas = partes.join(" · ") || "—";
  return l.detalhe ? `${contas} · ${l.detalhe}` : contas;
}

interface TriagemRow {
  fonte: string;
  chave: string;
  tipo: string;
  status: "resolvido" | "ignorado";
  observacao: string | null;
  usuario_nome: string;
  em: string;
}

export async function montarPendencias(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[]
): Promise<PendenciasResp> {
  // Conferência (dois lados) + Auditoria em paralelo — todas read-only no Questor.
  const [ent, sai, auditoria] = await Promise.all([
    conferirTudo(client, empresa, inicio, fim, estabs, "ent"),
    conferirTudo(client, empresa, inicio, fim, estabs, "sai"),
    montarAuditoria(client, empresa, inicio, fim, estabs),
  ]);

  const itens: Pendencia[] = [];

  // Conferência: notas-problema dos dois lados. Prefixo ME/MS na chave para não
  // colidir entre ent e sai (as chaves são sequências separadas no Questor).
  for (const [lado, res] of [
    ["ent", ent],
    ["sai", sai],
  ] as const) {
    const prefixo = lado === "ent" ? "ME" : "MS";
    for (const n of res.conferidas) {
      const meta = CONF_META[n.situacao];
      if (!meta) continue;
      itens.push({
        fonte: "conferencia",
        chave: `${prefixo}${n.chave}`,
        tipo: n.situacao,
        titulo: meta.titulo,
        severidade: meta.severidade,
        valor: n.valor,
        data: n.data,
        descricao: descricaoNota(n),
        lado,
        nota: n,
        triagem: null,
      });
    }
  }

  // Auditoria: cada lançamento da amostra de cada grupo vira uma pendência (a
  // amostra é o top-N por valor; a tela de Auditoria mostra o total do grupo).
  for (const g of auditoria.grupos) {
    for (const l of g.amostra) {
      itens.push({
        fonte: "auditoria",
        chave: l.chave,
        tipo: g.tipo,
        titulo: g.titulo,
        severidade: g.severidade,
        valor: l.valor,
        data: l.data,
        descricao: descricaoLancamento(l),
        lancamento: l,
        triagem: null,
      });
    }
  }

  // Cola o estado de triagem gravado (uma consulta por empresa).
  const triadas = await appQuery<TriagemRow>(
    `select fonte, chave, tipo, status, observacao, usuario_nome,
            to_char(atualizado_em, 'YYYY-MM-DD"T"HH24:MI') em
       from conf_triagem where codigo_empresa = $1`,
    [empresa]
  );
  const mapa = new Map<string, TriagemInfo>();
  for (const t of triadas) {
    mapa.set(`${t.fonte}|${t.chave}|${t.tipo}`, {
      status: t.status,
      observacao: t.observacao,
      usuario: t.usuario_nome,
      em: t.em,
    });
  }
  for (const it of itens) {
    it.triagem = mapa.get(`${it.fonte}|${it.chave}|${it.tipo}`) ?? null;
  }

  // Abertas antes de triadas; dentro, alta antes de média; depois maior valor.
  const sevRank = { alta: 0, media: 1 } as const;
  itens.sort((a, b) => {
    const ta = a.triagem ? 1 : 0;
    const tb = b.triagem ? 1 : 0;
    if (ta !== tb) return ta - tb;
    if (a.severidade !== b.severidade) return sevRank[a.severidade] - sevRank[b.severidade];
    return b.valor - a.valor;
  });

  const abertas = itens.filter((i) => !i.triagem);
  return {
    empresa: auditoria.empresa,
    periodo: { inicio, fim },
    itens,
    resumo: {
      total: itens.length,
      abertas: abertas.length,
      tratadas: itens.length - abertas.length,
      valorAberto: abertas.reduce((s, i) => s + i.valor, 0),
      alta: abertas.filter((i) => i.severidade === "alta").length,
    },
  };
}
