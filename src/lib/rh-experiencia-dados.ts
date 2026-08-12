import "server-only";
import { randomBytes } from "node:crypto";
import { query } from "./db";
import { appQuery } from "./app-db";
import { enviarEmail } from "./mailer";
import { carregarFormulario } from "./formularios";
import type { Formulario, RespostaValores } from "./formularios-tipos";
import { appUrl } from "./app-url";
import { EMPRESAS_RH, PJ_CONTRATO_OFFSET, ehContratoPj, nomeEmpresaRh, pjIdDoContrato } from "./rh";
import { MARCOS, rotuloMarco, type Marco, type StatusExperiencia } from "./rh-experiencia";
import type { ExperienciaItem } from "./rh-tipos";

/**
 * Lado servidor da experiência: a consulta ao Questor dos contratos em curso e
 * o e-mail do formulário. Separado da parte pura (rh-experiencia) para não
 * arrastar `pg`/`server-only` para o formulário público (client).
 */

export interface ContratoExperiencia {
  codigoempresa: number;
  codigofunccontr: number;
  nome: string;
  dataadm: string; // YYYY-MM-DD
  codigoestab: number;
  classiforgan: string | null;
  setor: string | null;
  cargo: string | null;
}

/** Token opaco do link público (URL-safe). */
export function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Contratos das empresas RH ainda dentro da janela de experiência — admitidos
 * há no máximo `janelaDias` (default 120: cobre o marco de 90 + folga p/ atraso)
 * e ainda ativos. Só CLT/empregado (`categoria = '01'`); diretor/estagiário não
 * entram em experiência. Base é a view `funcionario` (ficha atual por contrato).
 */
export async function buscarContratosExperiencia(
  empresas: number[] = [...EMPRESAS_RH],
  janelaDias = 120
): Promise<ContratoExperiencia[]> {
  const [clt, pj] = await Promise.all([
    query<ContratoExperiencia>(
      `select f.codigoempresa, f.codigofunccontr, f.nomefunc as nome,
              to_char(f.dataadm, 'YYYY-MM-DD') as dataadm,
              f.codigoestab, f.classiforgan,
              nullif(btrim(o.descrorgan), '') as setor,
              nullif(btrim(ca.descrcargo), '') as cargo
         from funcionario f
         left join organograma o
           on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab
          and o.classiforgan = f.classiforgan
         left join cargo ca on ca.codigocargo = f.codigocargo
        where f.codigoempresa = any($1::int[])
          and f.datadem is null
          and f.categoria = '01'
          and f.dataadm >= current_date - ($2::int)
        order by f.dataadm desc, f.codigoempresa`,
      [empresas, janelaDias]
    ),
    buscarContratosPjExperiencia(empresas, janelaDias),
  ]);
  return [...clt, ...pj];
}

/**
 * Pessoas PJ marcadas com experiência (rh_pessoa_pj.tem_experiencia) ainda dentro
 * da janela — data de início há no máximo `janelaDias`. Sobem no mesmo formato de
 * ContratoExperiencia, com o contrato sintético (PJ_CONTRATO_OFFSET + id) e o nome
 * vivo do setor. O setor do organograma não se aplica: o nome vem de rh_setor.
 */
async function buscarContratosPjExperiencia(
  empresas: number[],
  janelaDias: number
): Promise<ContratoExperiencia[]> {
  const rows = await appQuery<{
    id: number;
    codigoempresa: number;
    nome: string;
    dataadm: string;
    classiforgan: string | null;
    cargo: string | null;
    setor: string | null;
  }>(
    `select p.id, p.codigoempresa, p.nome,
            to_char(p.data_inicio, 'YYYY-MM-DD') as dataadm,
            p.classiforgan, p.cargo,
            coalesce(s.nome, p.classiforgan) as setor
       from rh_pessoa_pj p
       left join rh_setor s on s.classiforgan = p.classiforgan and s.ativo
      where p.ativo and p.tem_experiencia
        and p.codigoempresa = any($1::int[])
        and p.data_inicio is not null
        and p.data_inicio >= current_date - ($2::int)
      order by p.data_inicio desc, p.codigoempresa`,
    [empresas, janelaDias]
  );
  return rows.map((p) => ({
    codigoempresa: p.codigoempresa,
    codigofunccontr: PJ_CONTRATO_OFFSET + p.id,
    nome: p.nome,
    dataadm: p.dataadm,
    codigoestab: 0, // PJ não tem estabelecimento do Questor
    classiforgan: p.classiforgan,
    setor: p.setor,
    cargo: p.cargo,
  }));
}

// ── Configuração da experiência (qual formulário e antecedência por marco) ────

export interface ConfigMarco {
  formularioId: number;
  diasAntes: number;
}

/** Config por marco (45/90): formulário ligado e dias de antecedência do aviso.
 *  Marco sem linha = não é enviado (a RH ainda não ligou um formulário). */
export async function carregarConfigExperiencia(): Promise<Map<Marco, ConfigMarco>> {
  const m = new Map<Marco, ConfigMarco>();
  for (const r of await listarConfigExperiencia()) {
    m.set(r.marco, { formularioId: r.formularioId, diasAntes: r.diasAntes });
  }
  return m;
}

export interface ConfigMarcoLinha {
  marco: Marco;
  formularioId: number;
  diasAntes: number;
}

/** Config em lista (para a tela). */
export async function listarConfigExperiencia(): Promise<ConfigMarcoLinha[]> {
  const rows = await appQuery<{ marco: Marco; formulario_id: number; dias_antes: number }>(
    `select marco, formulario_id, dias_antes from rh_experiencia_config order by marco`
  );
  return rows.map((r) => ({ marco: r.marco, formularioId: r.formulario_id, diasAntes: r.dias_antes }));
}

/** Liga (ou desliga, com formularioId=null) um formulário a um marco. */
export async function salvarConfigMarco(
  marco: Marco,
  formularioId: number | null,
  diasAntes: number
): Promise<void> {
  if (formularioId == null) {
    await appQuery(`delete from rh_experiencia_config where marco = $1`, [marco]);
    return;
  }
  const dias = Math.max(0, Math.min(60, Math.round(diasAntes)));
  await appQuery(
    `insert into rh_experiencia_config (marco, formulario_id, dias_antes)
     values ($1, $2, $3)
     on conflict (marco) do update
       set formulario_id = excluded.formulario_id, dias_antes = excluded.dias_antes,
           atualizado_em = now()`,
    [marco, formularioId, dias]
  );
}

export interface RespostaExperienciaDetalhe {
  formulario: Formulario;
  respondidoPorNome: string | null;
  respondidoEm: string | null;
  valores: RespostaValores;
}

/** Respostas de uma avaliação de experiência (por id de rh_experiencia): o
 *  formulário usado + o que o gestor respondeu, para o painel abrir em leitura. */
export async function carregarRespostaExperiencia(
  id: number
): Promise<RespostaExperienciaDetalhe | null> {
  const [r] = await appQuery<{
    formulario_id: number | null;
    respondido_por_nome: string | null;
    respondido_em: string | null;
    respostas: { valores?: RespostaValores } | null;
  }>(
    `select e.formulario_id, rr.respondido_por_nome,
            to_char(rr.respondido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as respondido_em, rr.respostas
       from rh_experiencia e
       join rh_experiencia_resposta rr on rr.experiencia_id = e.id
      where e.id = $1`,
    [id]
  );
  if (!r || !r.formulario_id) return null;
  const formulario = await carregarFormulario(r.formulario_id);
  if (!formulario) return null;
  return {
    formulario,
    respondidoPorNome: r.respondido_por_nome,
    respondidoEm: r.respondido_em,
    valores: r.respostas?.valores ?? {},
  };
}

/** Um contrato específico (para reenvio pontual do formulário). PJ (contrato
 *  sintético) vem do app-db; CLT vem do Questor. */
export async function buscarUmContrato(
  codigoempresa: number,
  contrato: number
): Promise<ContratoExperiencia | null> {
  if (ehContratoPj(contrato)) {
    const [pj] = await appQuery<{
      codigoempresa: number;
      nome: string;
      dataadm: string;
      classiforgan: string | null;
      cargo: string | null;
      setor: string | null;
    }>(
      `select p.codigoempresa, p.nome,
              to_char(p.data_inicio, 'YYYY-MM-DD') as dataadm,
              p.classiforgan, p.cargo,
              coalesce(s.nome, p.classiforgan) as setor
         from rh_pessoa_pj p
         left join rh_setor s on s.classiforgan = p.classiforgan and s.ativo
        where p.id = $1 and p.ativo`,
      [pjIdDoContrato(contrato)]
    );
    if (!pj || !pj.dataadm) return null;
    return {
      codigoempresa: pj.codigoempresa,
      codigofunccontr: contrato,
      nome: pj.nome,
      dataadm: pj.dataadm,
      codigoestab: 0,
      classiforgan: pj.classiforgan,
      setor: pj.setor,
      cargo: pj.cargo,
    };
  }
  const [row] = await query<ContratoExperiencia>(
    `select f.codigoempresa, f.codigofunccontr, f.nomefunc as nome,
            to_char(f.dataadm, 'YYYY-MM-DD') as dataadm,
            f.codigoestab, f.classiforgan,
            nullif(btrim(o.descrorgan), '') as setor,
            nullif(btrim(ca.descrcargo), '') as cargo
       from funcionario f
       left join organograma o
         on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab
        and o.classiforgan = f.classiforgan
       left join cargo ca on ca.codigocargo = f.codigocargo
      where f.codigoempresa = $1 and f.codigofunccontr = $2`,
    [codigoempresa, contrato]
  );
  return row ?? null;
}

/** Data de vencimento de um marco (admissão + marco dias). */
export function vencimentoMarco(dataadm: string, marco: Marco): string {
  return addDias(dataadm, marco);
}

/** Corpo do e-mail do formulário de experiência (HTML simples, inline). */
export async function emailExperiencia(params: {
  funcionario: string;
  empresa: number;
  cargo: string | null;
  setor: string | null;
  marco: Marco;
  vencimento: string; // YYYY-MM-DD
  token: string;
  atrasado?: boolean;
}): Promise<{ assunto: string; html: string }> {
  const link = `${await appUrl()}/f/${params.token}`;
  const venc = formatarData(params.vencimento);
  const marcoTxt = rotuloMarco(params.marco);
  const urgencia = params.atrasado
    ? `<p style="color:#b91c1c;font-weight:600">Este prazo já venceu (${venc}). Responda o quanto antes.</p>`
    : `<p>Prazo para avaliação: <strong>${venc}</strong>.</p>`;

  const assunto = `${params.atrasado ? "[ATRASADO] " : ""}Avaliação de experiência (${marcoTxt}) — ${params.funcionario}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5">
    <p>Olá,</p>
    <p>O contrato de experiência de <strong>${escapar(params.funcionario)}</strong>
       está no marco de <strong>${marcoTxt}</strong> e precisa da sua avaliação.</p>
    <table style="border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:2px 8px;color:#555">Empresa</td><td style="padding:2px 8px"><strong>${nomeEmpresaRh(params.empresa)}</strong></td></tr>
      <tr><td style="padding:2px 8px;color:#555">Cargo</td><td style="padding:2px 8px">${escapar(params.cargo ?? "—")}</td></tr>
      <tr><td style="padding:2px 8px;color:#555">Setor</td><td style="padding:2px 8px">${escapar(params.setor ?? "—")}</td></tr>
    </table>
    ${urgencia}
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">
        Preencher avaliação
      </a>
    </p>
    <p style="color:#555;font-size:12px">Ou copie este link: <br>${link}</p>
    <p style="color:#555;font-size:12px">Não é preciso login. O link é pessoal — não repasse.</p>
  </div>`;

  return { assunto, html };
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

// ── Datas (DATE do Postgres vem como "YYYY-MM-DD"; trabalha em UTC p/ não pular
//    de dia por fuso) ──────────────────────────────────────────────────────────
function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

interface LinhaExperiencia {
  id: number;
  codigoempresa: number;
  codigofunccontr: number;
  marco: Marco;
  status: StatusExperiencia;
  recomendacao: string | null;
  respondido_por_nome: string | null;
  respondido_em: string | null;
  comentarios: string | null;
  ultimo_lembrete: string | null;
}

/** Contagem de gestores ativos por DEPARTAMENTO (chave = classiforgan). */
async function contagemGestores(): Promise<Map<string, number>> {
  const rows = await appQuery<{ classiforgan: string; n: number }>(
    `select classiforgan, count(*)::int as n
       from rh_setor_gestor where ativo
      group by classiforgan`
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.classiforgan, r.n);
  return m;
}

/**
 * Painel de experiência: para cada contrato em curso, projeta os marcos 45 e 90
 * e casa com o que já foi materializado (rh_experiencia + resposta + último
 * lembrete). Mostra marco projetado quando ainda não materializado (o job só
 * cria a linha ao entrar na janela de 15 dias), e o materializado sempre.
 */
export async function montarPainelExperiencia(
  empresas: number[] = [...EMPRESAS_RH]
): Promise<ExperienciaItem[]> {
  const [contratos, gestores] = await Promise.all([
    buscarContratosExperiencia(empresas, 120),
    contagemGestores(),
  ]);

  const linhas = await appQuery<LinhaExperiencia>(
    `select e.id, e.codigoempresa, e.codigofunccontr, e.marco, e.status,
            r.recomendacao, r.respondido_por_nome,
            to_char(r.respondido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as respondido_em,
            r.comentarios,
            (select to_char(max(l.enviado_em), 'YYYY-MM-DD"T"HH24:MI:SS')
               from rh_experiencia_lembrete l where l.experiencia_id = e.id) as ultimo_lembrete
       from rh_experiencia e
       left join rh_experiencia_resposta r on r.experiencia_id = e.id
      where e.codigoempresa = any($1::int[])`,
    [empresas]
  );
  const porChave = new Map<string, LinhaExperiencia>();
  for (const l of linhas) porChave.set(`${l.codigoempresa}|${l.codigofunccontr}|${l.marco}`, l);

  const hoje = hojeISO();
  const itens: ExperienciaItem[] = [];

  for (const c of contratos) {
    for (const marco of MARCOS) {
      const vencimento = addDias(c.dataadm, marco);
      const chave = `${c.codigoempresa}|${c.codigofunccontr}|${marco}`;
      const linha = porChave.get(chave);
      const diasParaVencer = diasEntre(hoje, vencimento);

      // Projetado (sem linha) só entra se relevante: recém-vencido pra frente.
      // Materializado entra sempre (está em andamento).
      if (!linha && diasParaVencer < -20) continue;

      // Status atual = a verdade de hoje: respondido manda; senão, vencido sem
      // resposta é atraso; senão o que o banco guarda (enviado/pendente); sem
      // linha ainda, pendente.
      const respondido = linha?.status === "respondido";
      const status: StatusExperiencia = respondido
        ? "respondido"
        : diasParaVencer < 0
          ? "atraso"
          : linha
            ? linha.status
            : "pendente";

      itens.push({
        id: linha?.id ?? null,
        codigoempresa: c.codigoempresa,
        contrato: c.codigofunccontr,
        nome: c.nome,
        cargo: c.cargo,
        setor: c.setor,
        classiforgan: c.classiforgan,
        dataadm: c.dataadm,
        marco,
        vencimento,
        status,
        diasParaVencer,
        gestores: gestores.get(c.classiforgan ?? "") ?? 0,
        ultimoLembrete: linha?.ultimo_lembrete ?? null,
        resposta:
          respondido && linha
            ? {
                recomendacao: linha.recomendacao ?? "",
                respondidoPor: linha.respondido_por_nome ?? "",
                respondidoEm: linha.respondido_em ?? "",
                comentarios: linha.comentarios,
              }
            : null,
      });
    }
  }

  // Mais urgente primeiro: respondidos ao fim; entre os demais, menor prazo (mais
  // atrasado) primeiro.
  return itens.sort((a, b) => {
    const ra = a.status === "respondido" ? 1 : 0;
    const rb = b.status === "respondido" ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return a.diasParaVencer - b.diasParaVencer;
  });
}

export interface ResumoCron {
  verificados: number;
  enviados: number;
  jaEnviados: number;
  jaRespondidos: number;
  semGestores: number;
  semFormulario: number;
  erros: number;
}

/**
 * Job diário: varre os contratos em experiência e dispara o lembrete DEVIDO de
 * cada marco. Por rodada, cada marco manda no máximo UM e-mail — o slot mais
 * próximo já alcançado (15→10→5→1 antes; 0 = atraso depois do vencimento) que
 * ainda não foi enviado. Assim um contrato que aparece já em cima da data não
 * leva os quatro lembretes de uma vez. Idempotente: rodar 2× no mesmo dia não
 * duplica (o log de lembrete tem unique por slot).
 */
export async function rodarCronExperiencia(
  empresas: number[] = [...EMPRESAS_RH]
): Promise<ResumoCron> {
  const [contratos, config] = await Promise.all([
    buscarContratosExperiencia(empresas, 120),
    carregarConfigExperiencia(),
  ]);
  const hoje = hojeISO();
  const resumo: ResumoCron = {
    verificados: 0,
    enviados: 0,
    jaEnviados: 0,
    jaRespondidos: 0,
    semGestores: 0,
    semFormulario: 0,
    erros: 0,
  };

  for (const c of contratos) {
    for (const marco of MARCOS) {
      const cfg = config.get(marco);
      if (!cfg) continue; // marco sem formulário ligado: não dispara

      const vencimento = addDias(c.dataadm, marco);
      const dias = diasEntre(hoje, vencimento);

      // Antes do fim: UM disparo, quando entra na antecedência configurada (padrão
      // 7 dias antes) — slot = diasAntes, o unique por slot não deixa repetir.
      // Depois do fim (atrasado): lembrete TODO DIA até responderem — slot = dias
      // (negativo, distinto por dia), então um e-mail por dia, sem duplicar no dia.
      let slot: number;
      if (dias < 0) slot = dias;
      else if (dias <= cfg.diasAntes) slot = cfg.diasAntes;
      else continue; // ainda distante

      resumo.verificados++;
      try {
        const r = await enviarFormularioExperiencia({ contrato: c, marco, vencimento, slot, config });
        if (r.enviado) resumo.enviados++;
        else if (r.jaRespondido) resumo.jaRespondidos++;
        else if (r.jaEnviado) resumo.jaEnviados++;
        else if (r.semGestores) resumo.semGestores++;
        else if (r.semFormulario) resumo.semFormulario++;
        else resumo.enviados++; // registrado (driver de log sem SMTP)
      } catch (err) {
        resumo.erros++;
        console.error("[rh:cron] falha no marco", c.codigofunccontr, marco, err);
      }
    }
  }
  return resumo;
}

/** E-mails dos gestores ativos de um departamento (classiforgan). */
export async function gestoresDoSetor(classiforgan: string): Promise<string[]> {
  const rows = await appQuery<{ email: string }>(
    `select email from rh_setor_gestor where ativo and classiforgan = $1`,
    [classiforgan]
  );
  return rows.map((r) => r.email);
}

/**
 * Garante a linha rh_experiencia (empresa, contrato, marco), criando com token
 * se ainda não existe. Idempotente (o unique protege corrida). Devolve id+token.
 */
export async function materializarExperiencia(params: {
  codigoempresa: number;
  contrato: number;
  marco: Marco;
  dataadm: string;
  vencimento: string;
  formularioId: number;
}): Promise<{ id: number; token: string }> {
  const [row] = await appQuery<{ id: number; token: string }>(
    `insert into rh_experiencia
        (codigoempresa, codigofunccontr, marco, data_admissao, data_vencimento, token, formulario_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (codigoempresa, codigofunccontr, marco)
       do update set atualizado_em = now(), formulario_id = excluded.formulario_id
     returning id, token`,
    [
      params.codigoempresa,
      params.contrato,
      params.marco,
      params.dataadm,
      params.vencimento,
      gerarToken(),
      params.formularioId,
    ]
  );
  return row;
}

export interface ResultadoEnvio {
  enviado: boolean;
  jaEnviado?: boolean; // esse slot de lembrete já tinha sido disparado
  jaRespondido?: boolean; // avaliação já respondida — não manda mais nada
  semGestores?: boolean; // setor sem gestor cadastrado — não há para quem enviar
  semFormulario?: boolean; // marco sem formulário configurado — nada a enviar
  destinatarios: string[];
}

/**
 * Dispara (ou reenvia) o formulário de experiência de um marco. Materializa a
 * linha (com o formulário configurado para o marco), resolve os gestores do
 * setor, manda o e-mail e registra o lembrete. `slot` é o dias-antes do disparo
 * (a antecedência configurada, 0 = atraso; -1 = reenvio manual). Sem `forcado`,
 * um slot já disparado não repete (o log tem unique por slot). Sem formulário
 * ligado ao marco, devolve `semFormulario` (nada a enviar).
 */
export async function enviarFormularioExperiencia(opts: {
  contrato: ContratoExperiencia;
  marco: Marco;
  vencimento: string;
  slot: number;
  forcado?: boolean;
  config?: Map<Marco, ConfigMarco>;
}): Promise<ResultadoEnvio> {
  const { contrato: c, marco, vencimento, slot, forcado } = opts;

  const config = opts.config ?? (await carregarConfigExperiencia());
  const cfg = config.get(marco);
  if (!cfg) return { enviado: false, semFormulario: true, destinatarios: [] };

  const { id, token } = await materializarExperiencia({
    codigoempresa: c.codigoempresa,
    contrato: c.codigofunccontr,
    marco,
    dataadm: c.dataadm,
    vencimento,
    formularioId: cfg.formularioId,
  });

  // Já respondida? Não manda mais nada — nem lembrete diário de atraso, nem
  // reenvio manual. O link é único e compartilhado: quem respondeu travou o resto.
  const [st] = await appQuery<{ status: StatusExperiencia }>(
    `select status from rh_experiencia where id = $1`,
    [id]
  );
  if (st?.status === "respondido") return { enviado: false, jaRespondido: true, destinatarios: [] };

  // Slot já disparado antes? (só trava o disparo automático; reenvio manual passa)
  if (!forcado) {
    const [ja] = await appQuery<{ um: number }>(
      `select 1 as um from rh_experiencia_lembrete where experiencia_id = $1 and dias_antes = $2`,
      [id, slot]
    );
    if (ja) return { enviado: false, jaEnviado: true, destinatarios: [] };
  }

  const destinatarios = await gestoresDoSetor(c.classiforgan ?? "");
  if (destinatarios.length === 0) {
    return { enviado: false, semGestores: true, destinatarios: [] };
  }

  const atrasado = diasEntre(hojeISO(), vencimento) < 0;
  const { assunto, html } = await emailExperiencia({
    funcionario: c.nome,
    empresa: c.codigoempresa,
    cargo: c.cargo,
    setor: c.setor,
    marco,
    vencimento,
    token,
    atrasado,
  });
  const { enviado } = await enviarEmail({ para: destinatarios, assunto, html });

  // Registra o lembrete (idempotente por slot) e atualiza o status — sem
  // rebaixar quem já respondeu.
  await appQuery(
    `insert into rh_experiencia_lembrete (experiencia_id, dias_antes, destinatarios)
     values ($1, $2, $3)
     on conflict (experiencia_id, dias_antes)
       do update set enviado_em = now(), destinatarios = excluded.destinatarios`,
    [id, slot, destinatarios.join(", ")]
  );
  await appQuery(
    `update rh_experiencia set status = $2
      where id = $1 and status <> 'respondido'`,
    [id, atrasado ? "atraso" : "enviado"]
  );

  return { enviado, destinatarios };
}
