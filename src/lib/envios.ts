import "server-only";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import { enviarEmail } from "./mailer";
import { carregarFormulario } from "./formularios";
import type { Formulario, RespostaValores } from "./formularios-tipos";
import { gerarToken } from "./rh-experiencia-dados";
import { appUrl } from "./app-url";

/**
 * Campanhas de envio de formulário (o caminho "outros formulários"): a RH escolhe
 * um formulário ativo e dispara para gestores e/ou e-mails avulsos, agora ou
 * agendado. Cada destinatário recebe um token próprio; a resposta usa o mesmo
 * formulário público (/f/<token>) e submissão da experiência.
 *
 * Campanha é sempre GENÉRICA: avaliação sobre um colaborador saiu daqui e virou
 * seção própria (rh_desempenho, migration 033), onde a mesma avaliação aceita
 * várias respostas e a lista é filtrável.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DestinatarioEntrada {
  email: string;
  nome?: string | null;
  gestorId?: number | null;
}

// ── Criação e disparo ─────────────────────────────────────────────────────────

export async function criarEnvio(params: {
  formularioId: number;
  titulo?: string | null;
  mensagem?: string | null;
  destinatarios?: DestinatarioEntrada[];
  agendarPara?: string | null;
  criadoPor?: string | null;
}): Promise<{
  id: number;
  enviados: number;
  total: number;
  agendado: boolean;
}> {
  const form = await carregarFormulario(params.formularioId);
  if (!form) throw new FilterError("Formulário não encontrado");
  if (form.status !== "ativo") throw new FilterError("Só é possível enviar formulários ativos");
  if (!form.campos.length) throw new FilterError("O formulário não tem perguntas");

  const titulo = (params.titulo || form.nome).trim();

  // Destinatários comuns (gestores/avulsos): dedup por e-mail (o mesmo gestor
  // pode cair em "todos" e "avulso").
  const vistos = new Set<string>();
  const dests: Required<DestinatarioEntrada>[] = [];
  for (const d of params.destinatarios ?? []) {
    const email = (d.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || vistos.has(email)) continue;
    vistos.add(email);
    dests.push({ email, nome: d.nome?.trim() || null, gestorId: d.gestorId ?? null });
  }

  const total = dests.length;
  if (!total) throw new FilterError("Selecione ao menos um destinatário válido");

  const quando = params.agendarPara ? new Date(params.agendarPara) : null;
  const futuro = quando != null && !Number.isNaN(quando.getTime()) && quando.getTime() > Date.now();

  const [env] = await appQuery<{ id: number }>(
    `insert into envio (formulario_id, tipo, titulo, mensagem, agendado_para, criado_por)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      params.formularioId,
      futuro ? "agendado" : "manual",
      titulo,
      params.mensagem?.trim() || null,
      futuro ? quando!.toISOString() : null,
      params.criadoPor ?? null,
    ]
  );

  for (const d of dests) {
    await appQuery(
      `insert into envio_destinatario (envio_id, nome, email, gestor_id, token)
       values ($1, $2, $3, $4, $5)`,
      [env.id, d.nome, d.email, d.gestorId, gerarToken()]
    );
  }
  if (futuro) return { id: env.id, enviados: 0, total, agendado: true };
  const enviados = await dispararEnvio(env.id);
  return { id: env.id, enviados, total, agendado: false };
}

/** Envia (ou reenvia) os destinatários pendentes de uma campanha. Devolve quantos
 *  e-mails saíram de fato (o driver de log conta 0 mas marca como enviado). */
export async function dispararEnvio(envioId: number): Promise<number> {
  const [env] = await appQuery<{ titulo: string; mensagem: string | null }>(
    `select titulo, mensagem from envio where id = $1`,
    [envioId]
  );
  if (!env) return 0;

  const dests = await appQuery<{ id: number; email: string; token: string }>(
    `select id, email, token
       from envio_destinatario where envio_id = $1 and status = 'pendente'`,
    [envioId]
  );

  let enviados = 0;
  for (const d of dests) {
    const para = d.email ? [d.email] : [];
    if (!para.length) {
      await appQuery(`update envio_destinatario set status = 'erro' where id = $1`, [d.id]);
      console.error("[envio] destinatário sem e-mail para envio", d.id);
      continue;
    }
    const link = `${await appUrl()}/f/${d.token}`;
    const { assunto, html } = emailFormulario({ titulo: env.titulo, mensagem: env.mensagem, link });
    try {
      const { enviado } = await enviarEmail({ para, assunto, html });
      await appQuery(
        `update envio_destinatario set status = 'enviado', enviado_em = now() where id = $1`,
        [d.id]
      );
      if (enviado) enviados++;
    } catch (e) {
      await appQuery(`update envio_destinatario set status = 'erro' where id = $1`, [d.id]);
      console.error("[envio] falha ao enviar para", para, e);
    }
  }
  await appQuery(`update envio set disparado_em = now() where id = $1`, [envioId]);
  return enviados;
}

/** Job: dispara as campanhas agendadas cujo horário já chegou. */
export async function processarEnviosAgendados(): Promise<{ campanhas: number; enviados: number }> {
  const pend = await appQuery<{ id: number }>(
    `select id from envio
      where disparado_em is null and agendado_para is not null and agendado_para <= now()
      order by agendado_para`
  );
  let enviados = 0;
  for (const p of pend) enviados += await dispararEnvio(p.id);
  return { campanhas: pend.length, enviados };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export interface EnvioResumo {
  id: number;
  formularioNome: string;
  titulo: string;
  tipo: string;
  agendadoPara: string | null;
  disparadoEm: string | null;
  criadoEm: string;
  total: number;
  respondidos: number;
}

export async function listarEnvios(): Promise<EnvioResumo[]> {
  const rows = await appQuery<{
    id: number;
    formulario_nome: string;
    titulo: string;
    tipo: string;
    agendado_para: string | null;
    disparado_em: string | null;
    criado_em: string;
    total: number;
    respondidos: number;
  }>(
    `select e.id, f.nome as formulario_nome, e.titulo, e.tipo,
            to_char(e.agendado_para, 'YYYY-MM-DD"T"HH24:MI:SS') as agendado_para,
            to_char(e.disparado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as disparado_em,
            to_char(e.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            (select count(*)::int from envio_destinatario d where d.envio_id = e.id) as total,
            (select count(*)::int from envio_destinatario d
              where d.envio_id = e.id and d.status = 'respondido') as respondidos
       from envio e join formulario f on f.id = e.formulario_id
      order by coalesce(e.disparado_em, e.agendado_para, e.criado_em) desc`
  );
  return rows.map((r) => ({
    id: r.id,
    formularioNome: r.formulario_nome,
    titulo: r.titulo,
    tipo: r.tipo,
    agendadoPara: r.agendado_para,
    disparadoEm: r.disparado_em,
    criadoEm: r.criado_em,
    total: r.total,
    respondidos: r.respondidos,
  }));
}

export interface EnvioDestinatario {
  id: number;
  nome: string | null;
  email: string | null;
  status: string;
  respondidoPorNome: string | null;
  respondidoEm: string | null;
  valores: RespostaValores | null;
}

export interface EnvioDetalhe {
  id: number;
  titulo: string;
  formulario: Formulario;
  destinatarios: EnvioDestinatario[];
}

export async function carregarEnvio(id: number): Promise<EnvioDetalhe | null> {
  const [e] = await appQuery<{ id: number; titulo: string; formulario_id: number }>(
    `select id, titulo, formulario_id from envio where id = $1`,
    [id]
  );
  if (!e) return null;
  const formulario = await carregarFormulario(e.formulario_id);
  if (!formulario) return null;

  const rows = await appQuery<{
    id: number;
    nome: string | null;
    email: string | null;
    status: string;
    respondido_por_nome: string | null;
    respondido_em: string | null;
    valores: { valores?: RespostaValores } | null;
  }>(
    `select id, nome, email, status, respondido_por_nome,
            to_char(respondido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as respondido_em, valores
       from envio_destinatario where envio_id = $1 order by email`,
    [id]
  );
  return {
    id: e.id,
    titulo: e.titulo,
    formulario,
    destinatarios: rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      status: r.status,
      respondidoPorNome: r.respondido_por_nome,
      respondidoEm: r.respondido_em,
      // `valores` é gravado embrulhado ({ valores: {...} }) — desembrulha p/ o mapa plano.
      valores: r.valores?.valores ?? null,
    })),
  };
}

// ── E-mail genérico da campanha ───────────────────────────────────────────────

function emailFormulario(params: { titulo: string; mensagem: string | null; link: string }): {
  assunto: string;
  html: string;
} {
  const assunto = params.titulo;
  const msg = params.mensagem
    ? `<p style="white-space:pre-line">${escapar(params.mensagem)}</p>`
    : "";
  const pedido = `O RH da Navecon pede que você responda o formulário <strong>${escapar(params.titulo)}</strong>.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5">
    <p>Olá,</p>
    <p>${pedido}</p>
    ${msg}
    <p style="margin:20px 0">
      <a href="${params.link}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">
        Responder formulário
      </a>
    </p>
    <p style="color:#555;font-size:12px">Ou copie este link: <br>${params.link}</p>
    <p style="color:#555;font-size:12px">Não é preciso login. O link é pessoal — não repasse.</p>
  </div>`;
  return { assunto, html };
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
