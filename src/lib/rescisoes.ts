import "server-only";
import { query } from "./db";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional, empresasPermitidas } from "./sessao";
import { enviarEmail } from "./mailer";
import { appUrl } from "./app-url";
import type {
  RescisaoItem,
  RescisaoSituacao,
  RescisoesConfig,
  RescisoesResumo,
  RescisaoDestinatario,
} from "./rescisoes-tipos";

/**
 * CONTROLE DE RESCISÕES A PAGAR (DP). Junta o FATO do Questor — desligamento
 * (`funccontrato.datadem`) + rescisão calculada (`rescisao`) + a folha de
 * rescisão (tipo 60, `periodocalculo`) — com o que só o app guarda: o prazo de
 * pagamento (CLT art. 477: 10 dias), o override manual de "paga/homologada" e o
 * log de avisos por e-mail. Ver [[Módulo de folha e eSocial do Questor]].
 *
 * A rescisão é "resolvida" APENAS pela marcação manual do DP — nunca pela folha
 * do Questor. Motivo: `periodocalculo.datapgto` é a data PREVISTA (gravada no
 * cálculo, antes do pagamento de fato); resolver por ela apagaria o alarme antes
 * da hora. O sinal do Questor (calculada, pagamento previsto) entra só como
 * informação de apoio na tela.
 *
 * Escopo de empresa: mesmo funil da Folha — a sessão manda, a lista do cliente
 * afunila (interseção). Empresa é OPCIONAL (como a Produtividade do DP): sem
 * empresa, varre todo o escopo — é o retrato do escritório.
 *
 * Aproximações (visão gerencial, a conferir no Questor antes de agir): conta só
 * empregado CLT (`categoria = '01'`) e exclui desligamentos cuja causa contém
 * "transf" (transferência entre estabelecimentos infla a fila e não gera
 * pagamento). Ver a armadilha de transferência na nota do módulo de folha.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Teto de período: 1 ano, como no resto do app. */
const MAX_DIAS = 366;
/** Janela do cron: rescisões desligadas nos últimos N dias entram na varredura. */
const LOOKBACK_DIAS = 180;
/** Teto de linhas da tela — a fila é para conferência, o resumo já agrega. */
const LIMITE = 2000;

export interface RescisoesFiltros {
  inicio: string;
  fim: string;
  empresas: number[];
}

export function parseRescisoesFiltros(sp: URLSearchParams): RescisoesFiltros {
  const inicio = sp.get("inicio") ?? "";
  const fim = sp.get("fim") ?? "";
  if (!DATE_RE.test(inicio) || !DATE_RE.test(fim)) {
    throw new FilterError("Período inválido: informe inicio e fim como YYYY-MM-DD");
  }
  if (inicio > fim) throw new FilterError("Data inicial maior que a final");
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1;
  if (dias > MAX_DIAS) throw new FilterError("Período máximo permitido: 1 ano");

  const empresas = (sp.get("empresas") ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new FilterError(`Empresa inválida: ${v}`);
      return n;
    });

  return { inicio, fim, empresas };
}

/** Escopo efetivo de empresa: "todas" ou a lista permitida (interseção com o pedido). */
async function escopoEmpresas(empresas: number[]): Promise<number[] | "todas"> {
  const sessao = await getSessaoOpcional();
  const escopo: number[] | "todas" = sessao ? empresasPermitidas(sessao) : [];
  if (escopo === "todas") return empresas.length ? empresas : "todas";
  return empresas.length ? empresas.filter((e) => escopo.includes(e)) : escopo;
}

// ── Datas (locais, sem lib) ──────────────────────────────────────────────────

/** ISO "YYYY-MM-DD" + n dias (UTC, para não escorregar por fuso). */
function addDias(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}
/** Dias entre duas datas ISO (a − b). */
function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);
}
/** Hoje em ISO, no fuso do servidor. */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIG_PADRAO: RescisoesConfig = { prazoDias: 10, diasAntes: 3 };

export async function carregarConfigRescisoes(): Promise<RescisoesConfig> {
  const [row] = await appQuery<{ prazo_dias: number; dias_antes: number }>(
    `select prazo_dias, dias_antes from rescisao_config where id`
  );
  if (!row) return CONFIG_PADRAO;
  return { prazoDias: row.prazo_dias, diasAntes: row.dias_antes };
}

export async function salvarConfigRescisoes(prazoDias: number, diasAntes: number): Promise<void> {
  const p = Math.min(90, Math.max(1, Math.trunc(prazoDias)));
  const a = Math.min(30, Math.max(0, Math.trunc(diasAntes)));
  await appQuery(
    `insert into rescisao_config (id, prazo_dias, dias_antes)
     values (true, $1, $2)
     on conflict (id) do update set prazo_dias = excluded.prazo_dias,
                                    dias_antes = excluded.dias_antes,
                                    atualizado_em = now()`,
    [p, a]
  );
}

// ── Destinatários ────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listarDestinatarios(): Promise<RescisaoDestinatario[]> {
  return appQuery<RescisaoDestinatario>(
    `select id, nome, email, ativo from rescisao_destinatario order by ativo desc, nome`
  );
}

export async function adicionarDestinatario(nome: string, email: string): Promise<void> {
  const n = nome.trim();
  const e = email.trim().toLowerCase();
  if (!n) throw new FilterError("Informe o nome");
  if (!EMAIL_RE.test(e)) throw new FilterError("E-mail inválido");
  try {
    await appQuery(`insert into rescisao_destinatario (nome, email) values ($1, $2)`, [n, e]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate")) {
      throw new FilterError("Esse e-mail já está cadastrado");
    }
    throw err;
  }
}

export async function atualizarDestinatario(id: number, ativo: boolean): Promise<void> {
  await appQuery(`update rescisao_destinatario set ativo = $2 where id = $1`, [id, ativo]);
}

export async function removerDestinatario(id: number): Promise<void> {
  await appQuery(`delete from rescisao_destinatario where id = $1`, [id]);
}

/** E-mails dos destinatários ativos (para quem o cron dispara). */
async function destinatariosAtivos(): Promise<string[]> {
  const rows = await appQuery<{ email: string }>(
    `select email from rescisao_destinatario where ativo order by nome`
  );
  return rows.map((r) => r.email);
}

// ── Resolução manual (override no banco do app) ──────────────────────────────

export async function marcarResolvida(opts: {
  codigoempresa: number;
  codigofunccontr: number;
  resolvidaEm?: string | null;
  observacao?: string | null;
  usuarioId?: string | null;
}): Promise<void> {
  const dataResolvida = opts.resolvidaEm && DATE_RE.test(opts.resolvidaEm) ? opts.resolvidaEm : hojeISO();
  await appQuery(
    `insert into rescisao_resolvida (codigoempresa, codigofunccontr, resolvida_em, observacao, marcado_por)
     values ($1, $2, $3, $4, $5)
     on conflict (codigoempresa, codigofunccontr)
       do update set resolvida_em = excluded.resolvida_em,
                     observacao = excluded.observacao,
                     marcado_por = excluded.marcado_por`,
    [opts.codigoempresa, opts.codigofunccontr, dataResolvida, opts.observacao ?? null, opts.usuarioId ?? null]
  );
}

export async function desmarcarResolvida(codigoempresa: number, codigofunccontr: number): Promise<void> {
  await appQuery(`delete from rescisao_resolvida where codigoempresa = $1 and codigofunccontr = $2`, [
    codigoempresa,
    codigofunccontr,
  ]);
}

// ── Consulta do Questor ──────────────────────────────────────────────────────

interface RescisaoRaw {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  data_dem: string;
  causa: string | null;
  data_aviso: string | null;
  calculada: boolean;
  data_pgto: string | null;
}

const chave = (empresa: number, contrato: number) => `${empresa}:${contrato}`;

/**
 * Desligamentos de empregados CLT num intervalo de `datadem`. Pega a rescisão de
 * MENOR `complementar` por contrato (armadilha: nesta base `complementar` = 1,
 * não fixar = 0) e a folha de rescisão que ela aponta. Exclui transferências.
 */
async function consultarQuestor(inicio: string, fim: string, escopo: number[] | "todas"): Promise<RescisaoRaw[]> {
  const params: unknown[] = [inicio, fim];
  let condEmpresa = "";
  if (escopo !== "todas") {
    params.push(escopo);
    condEmpresa = ` and fc.codigoempresa = any($${params.length}::int[])`;
  }
  return query<RescisaoRaw>(
    `select fc.codigoempresa,
            coalesce(nullif(btrim(e.nomeempresa), ''), 'Empresa ' || fc.codigoempresa) as empresa,
            fc.codigofunccontr as contrato,
            coalesce(nullif(btrim(p.nomefunc, E' \\t\\r\\n'), ''), '(sem nome)') as funcionario,
            to_char(fc.datadem, 'YYYY-MM-DD') as data_dem,
            cd.descrcausa as causa,
            to_char(r.dataavprevio, 'YYYY-MM-DD') as data_aviso,
            (r.codigofunccontr is not null) as calculada,
            to_char(pc.datapgto, 'YYYY-MM-DD') as data_pgto
       from funccontrato fc
       left join funcpessoa p on p.codigofuncpessoa = fc.codigofuncpessoa
       left join empresa e on e.codigoempresa = fc.codigoempresa
       left join lateral (
         select rr.codigofunccontr, rr.codigocausa, rr.dataavprevio, rr.codigopercalculo
           from rescisao rr
          where rr.codigoempresa = fc.codigoempresa and rr.codigofunccontr = fc.codigofunccontr
          order by rr.complementar
          limit 1
       ) r on true
       left join causademissao cd on cd.codigocausa = r.codigocausa
       left join periodocalculo pc on pc.codigoempresa = fc.codigoempresa
                                  and pc.codigopercalculo = r.codigopercalculo
      where fc.datadem between $1 and $2
        and fc.categoria = '01'
        and (cd.descrcausa is null or cd.descrcausa not ilike '%transf%')${condEmpresa}
      order by fc.datadem desc
      limit ${LIMITE}`,
    params
  );
}

/** Overrides de "resolvida" indexados por (empresa, contrato). */
async function carregarResolvidas(): Promise<Map<string, { resolvidaEm: string; observacao: string | null }>> {
  const rows = await appQuery<{ codigoempresa: number; codigofunccontr: number; resolvida_em: string; observacao: string | null }>(
    `select codigoempresa, codigofunccontr, to_char(resolvida_em, 'YYYY-MM-DD') as resolvida_em, observacao
       from rescisao_resolvida`
  );
  const mapa = new Map<string, { resolvidaEm: string; observacao: string | null }>();
  for (const r of rows) mapa.set(chave(r.codigoempresa, r.codigofunccontr), { resolvidaEm: r.resolvida_em, observacao: r.observacao });
  return mapa;
}

/** Combina uma linha do Questor com o override e o prazo, derivando a situação. */
function montarItem(
  raw: RescisaoRaw,
  referencia: string,
  cfg: RescisoesConfig,
  override: { resolvidaEm: string; observacao: string | null } | undefined
): RescisaoItem {
  const prazo = addDias(raw.data_dem, cfg.prazoDias);
  let situacao: RescisaoSituacao;
  let diasParaPrazo: number | null;
  if (override) {
    situacao = "resolvida";
    diasParaPrazo = null;
  } else {
    diasParaPrazo = diffDias(prazo, referencia);
    if (diasParaPrazo < 0) situacao = "vencida";
    else if (diasParaPrazo <= cfg.diasAntes) situacao = "vence_breve";
    else situacao = "no_prazo";
  }
  return {
    codigoempresa: raw.codigoempresa,
    empresa: raw.empresa,
    contrato: raw.contrato,
    funcionario: raw.funcionario,
    dataDesligamento: raw.data_dem,
    causa: raw.causa,
    dataAviso: raw.data_aviso,
    calculada: raw.calculada,
    pgtoPrevisto: raw.data_pgto,
    prazo,
    diasParaPrazo,
    situacao,
    resolvidaEm: override?.resolvidaEm ?? null,
    resolvidaFonte: override ? "manual" : null,
    observacao: override?.observacao ?? null,
  };
}

const PESO: Record<RescisaoSituacao, number> = { vencida: 0, vence_breve: 1, no_prazo: 2, resolvida: 3 };

export async function montarRescisoes(f: RescisoesFiltros, referencia: string): Promise<RescisoesResumo> {
  const escopo = await escopoEmpresas(f.empresas);
  const [raws, resolvidas, cfg] = await Promise.all([
    consultarQuestor(f.inicio, f.fim, escopo),
    carregarResolvidas(),
    carregarConfigRescisoes(),
  ]);

  const itens = raws
    .map((r) => montarItem(r, referencia, cfg, resolvidas.get(chave(r.codigoempresa, r.contrato))))
    .sort(
      (a, b) =>
        PESO[a.situacao] - PESO[b.situacao] ||
        (a.diasParaPrazo ?? Infinity) - (b.diasParaPrazo ?? Infinity) ||
        a.funcionario.localeCompare(b.funcionario)
    );

  const resolvidasN = itens.filter((i) => i.situacao === "resolvida").length;
  return {
    referencia,
    prazoDias: cfg.prazoDias,
    diasAntes: cfg.diasAntes,
    total: itens.length,
    pendentes: itens.length - resolvidasN,
    vencidas: itens.filter((i) => i.situacao === "vencida").length,
    venceBreve: itens.filter((i) => i.situacao === "vence_breve").length,
    resolvidas: resolvidasN,
    itens,
  };
}

// ── Cron: aviso por e-mail ───────────────────────────────────────────────────

export interface ResumoCronRescisoes {
  candidatos: number; // rescisões pendentes dentro/depois do prazo
  novos: number; // avisos ainda não disparados neste slot
  enviado: boolean; // o e-mail foi de fato despachado (SMTP configurado)
  semDestinatarios: boolean;
}

function linhaEmail(i: RescisaoItem): string {
  const prazoTxt =
    i.diasParaPrazo == null
      ? "—"
      : i.diasParaPrazo < 0
        ? `<span style="color:#b91c1c;font-weight:600">vencida há ${-i.diasParaPrazo} dia(s)</span>`
        : `<span style="color:#b45309">vence em ${i.diasParaPrazo} dia(s)</span>`;
  const dem = i.dataDesligamento.split("-").reverse().join("/");
  const praz = i.prazo.split("-").reverse().join("/");
  return `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapar(i.funcionario)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapar(i.empresa)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap">${dem}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap">${praz}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap">${prazoTxt}</td>
  </tr>`;
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function emailRescisoes(itens: RescisaoItem[]): Promise<{ assunto: string; html: string }> {
  const vencidas = itens.filter((i) => i.situacao === "vencida");
  const link = `${await appUrl()}/folha/rescisoes`;
  const assunto = `[DP] ${itens.length} rescisão(ões) a pagar${vencidas.length ? ` — ${vencidas.length} vencida(s)` : ""}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px">
    <h2 style="font-size:16px;margin:0 0 4px">Rescisões a pagar</h2>
    <p style="font-size:13px;color:#555;margin:0 0 12px">
      ${itens.length} rescisão(ões) exigem atenção — ${vencidas.length} já venceu o prazo de pagamento (CLT art. 477).
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="text-align:left;color:#666">
          <th style="padding:6px 10px;border-bottom:2px solid #ddd">Funcionário</th>
          <th style="padding:6px 10px;border-bottom:2px solid #ddd">Empresa</th>
          <th style="padding:6px 10px;border-bottom:2px solid #ddd">Desligamento</th>
          <th style="padding:6px 10px;border-bottom:2px solid #ddd">Prazo</th>
          <th style="padding:6px 10px;border-bottom:2px solid #ddd">Situação</th>
        </tr>
      </thead>
      <tbody>${itens.map(linhaEmail).join("")}</tbody>
    </table>
    <p style="margin:16px 0 0">
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:13px">Abrir o controle de rescisões</a>
    </p>
  </div>`;
  return { assunto, html };
}

/**
 * Job diário dos avisos de rescisão. Varre os desligamentos dos últimos
 * LOOKBACK_DIAS ainda NÃO resolvidos, seleciona os que entraram na antecedência
 * (slot = dias_antes, aviso único) ou já venceram (slot = dias negativo, um por
 * dia), e manda UM e-mail-resumo com os avisos NOVOS. Idempotente: o log
 * `rescisao_aviso` tem unique por (empresa, contrato, slot) — rodar 2× no mesmo
 * dia não duplica. Sem destinatário ativo, não dispara.
 */
export async function rodarCronRescisoes(): Promise<ResumoCronRescisoes> {
  const hoje = hojeISO();
  const [cfg, destinatarios, resolvidas] = await Promise.all([
    carregarConfigRescisoes(),
    destinatariosAtivos(),
    carregarResolvidas(),
  ]);
  const raws = await consultarQuestor(addDias(hoje, -LOOKBACK_DIAS), hoje, "todas");

  // Pendentes que já pedem aviso (dentro da antecedência ou vencidas), com o slot.
  const candidatos: { item: RescisaoItem; slot: number }[] = [];
  for (const raw of raws) {
    if (resolvidas.has(chave(raw.codigoempresa, raw.contrato))) continue;
    const item = montarItem(raw, hoje, cfg, undefined);
    const dias = item.diasParaPrazo ?? 0;
    let slot: number;
    if (dias < 0) slot = dias; // vencida: um aviso por dia (slot muda a cada dia)
    else if (dias <= cfg.diasAntes) slot = cfg.diasAntes; // antecedência: aviso único
    else continue; // ainda folgado
    candidatos.push({ item, slot });
  }

  if (candidatos.length === 0) {
    return { candidatos: 0, novos: 0, enviado: false, semDestinatarios: destinatarios.length === 0 };
  }

  // Quais slots ainda não foram avisados (o e-mail é o resumo dos NOVOS).
  const novos: { item: RescisaoItem; slot: number }[] = [];
  for (const c of candidatos) {
    const [ja] = await appQuery<{ um: number }>(
      `select 1 as um from rescisao_aviso where codigoempresa = $1 and codigofunccontr = $2 and slot = $3`,
      [c.item.codigoempresa, c.item.contrato, c.slot]
    );
    if (!ja) novos.push(c);
  }

  if (novos.length === 0) {
    return { candidatos: candidatos.length, novos: 0, enviado: false, semDestinatarios: destinatarios.length === 0 };
  }
  if (destinatarios.length === 0) {
    return { candidatos: candidatos.length, novos: novos.length, enviado: false, semDestinatarios: true };
  }

  const { assunto, html } = await emailRescisoes(novos.map((n) => n.item));
  const { enviado } = await enviarEmail({ para: destinatarios, assunto, html });

  // Registra os avisos disparados (idempotente por slot).
  for (const n of novos) {
    await appQuery(
      `insert into rescisao_aviso (codigoempresa, codigofunccontr, slot, destinatarios)
       values ($1, $2, $3, $4)
       on conflict (codigoempresa, codigofunccontr, slot) do update set enviado_em = now()`,
      [n.item.codigoempresa, n.item.contrato, n.slot, destinatarios.join(", ")]
    );
  }

  return { candidatos: candidatos.length, novos: novos.length, enviado, semDestinatarios: false };
}

export { FilterError };
