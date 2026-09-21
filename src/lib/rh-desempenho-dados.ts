import "server-only";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import { enviarEmail } from "./mailer";
import { appUrl } from "./app-url";
import { dataBR } from "./format";
import { carregarFormulario } from "./formularios";
import { listarDiretorio, nomesDeSetor } from "./rh-diretorio";
import { gerarToken } from "./rh-experiencia-dados";
import { ehEmpresaRh, nomeEmpresaRh } from "./rh";
import type { EscopoRodada, StatusDesempenho } from "./rh-desempenho";
import type {
  DesempenhoDetalhe,
  DesempenhoItem,
  DesempenhoRodada,
  FuncionarioDiretorio,
} from "./rh-tipos";

/**
 * Lado servidor da avaliação de DESEMPENHO (migration 033): criar a rodada,
 * disparar aos gestores do setor de cada colaborador, listar com filtro e ler as
 * respostas.
 *
 * O que distingue da experiência: aqui a avaliação aceita VÁRIAS respostas (uma
 * por gestor, cada um se identificando) e não tem prazo — quem decide quando
 * avaliar é a RH. O link fecha quando ela encerra a avaliação.
 */

/** Colaborador a avaliar. O e-mail não vem daqui: os destinatários são os
 *  gestores do departamento (classiforgan), resolvidos no disparo. */
export interface ColaboradorAvaliado {
  codigoempresa: number;
  codigofunccontr: number;
  nome?: string | null;
  classiforgan?: string | null;
}

export interface ResultadoRodada {
  rodadaId: number;
  avaliacoes: number;
  enviados: number;
  semGestor: string[];
}

// ── Criação e disparo ─────────────────────────────────────────────────────────

/**
 * Cria uma rodada e uma avaliação por colaborador, disparando na hora. Quem não
 * tem gestor cadastrado no departamento fica de fora e volta em `semGestor` — a
 * avaliação sem destinatário não teria como ser respondida.
 *
 * `escopo` só descreve a origem (avulsa ou escritório inteiro): o caminho é o
 * mesmo, muda quem monta a lista de colaboradores.
 */
export async function criarRodada(params: {
  formularioId: number;
  titulo?: string | null;
  mensagem?: string | null;
  escopo?: EscopoRodada;
  colaboradores: ColaboradorAvaliado[];
  criadoPor?: string | null;
}): Promise<ResultadoRodada> {
  const form = await carregarFormulario(params.formularioId);
  if (!form) throw new FilterError("Formulário não encontrado");
  if (form.status !== "ativo") throw new FilterError("Só é possível enviar formulários ativos");
  if (!form.campos.length) throw new FilterError("O formulário não tem perguntas");

  const titulo = (params.titulo || form.nome).trim();
  const gestoresPorSetor = await contagemGestoresPorSetor();

  // Dedup por contrato e recusa de empresa fora do RH (o módulo é fechado nelas).
  const vistos = new Set<string>();
  const alvos: Required<ColaboradorAvaliado>[] = [];
  const semGestor: string[] = [];
  for (const c of params.colaboradores ?? []) {
    if (!Number.isInteger(c.codigoempresa) || !Number.isInteger(c.codigofunccontr)) continue;
    if (!ehEmpresaRh(c.codigoempresa)) continue;
    const chave = `${c.codigoempresa}:${c.codigofunccontr}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const nome = c.nome?.trim() || `Contrato ${c.codigofunccontr}`;
    const classiforgan = c.classiforgan?.trim() || "";
    if (!classiforgan || !gestoresPorSetor.get(classiforgan)) {
      semGestor.push(nome);
      continue;
    }
    alvos.push({ ...c, nome, classiforgan });
  }

  if (!alvos.length) {
    throw new FilterError(
      semGestor.length
        ? "Nenhum colaborador selecionado tem gestor cadastrado no departamento"
        : "Selecione ao menos um colaborador"
    );
  }

  const [rodada] = await appQuery<{ id: number }>(
    `insert into rh_desempenho_rodada (formulario_id, titulo, mensagem, escopo, criado_por)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      params.formularioId,
      titulo,
      params.mensagem?.trim() || null,
      params.escopo ?? "avulso",
      params.criadoPor ?? null,
    ]
  );

  for (const a of alvos) {
    await appQuery(
      `insert into rh_desempenho
          (rodada_id, codigoempresa, codigofunccontr, funcionario_nome, classiforgan, token)
       values ($1, $2, $3, $4, $5, $6)`,
      [rodada.id, a.codigoempresa, a.codigofunccontr, a.nome, a.classiforgan, gerarToken()]
    );
  }

  const enviados = await dispararRodada(rodada.id);
  return { rodadaId: rodada.id, avaliacoes: alvos.length, enviados, semGestor };
}

/** Envia as avaliações ainda pendentes de uma rodada. Devolve quantos e-mails
 *  saíram de fato (o driver de log marca como enviado e conta 0). */
export async function dispararRodada(rodadaId: number): Promise<number> {
  const pendentes = await appQuery<{ id: number }>(
    `select id from rh_desempenho where rodada_id = $1 and status = 'pendente' order by id`,
    [rodadaId]
  );
  let enviados = 0;
  for (const p of pendentes) if (await enviarAvaliacao(p.id)) enviados++;
  return enviados;
}

/**
 * Manda (ou remanda) UMA avaliação a todos os gestores do setor do colaborador.
 * É o mesmo link para todos — cada gestor responde a sua, dizendo o nome.
 */
export async function enviarAvaliacao(id: number): Promise<boolean> {
  const [a] = await appQuery<{
    id: number;
    token: string;
    classiforgan: string | null;
    funcionario_nome: string;
    codigoempresa: number;
    codigofunccontr: number;
    encerrado_em: string | null;
    titulo: string;
    mensagem: string | null;
  }>(
    `select d.id, d.token, d.classiforgan, d.funcionario_nome, d.codigoempresa,
            d.codigofunccontr, d.encerrado_em, r.titulo, r.mensagem
       from rh_desempenho d join rh_desempenho_rodada r on r.id = d.rodada_id
      where d.id = $1`,
    [id]
  );
  if (!a) throw new FilterError("Avaliação não encontrada");
  if (a.encerrado_em) throw new FilterError("Esta avaliação está encerrada — reabra antes de reenviar");

  const para = a.classiforgan ? await emailsDosGestores(a.classiforgan) : [];
  if (!para.length) {
    await appQuery(`update rh_desempenho set status = 'erro' where id = $1`, [id]);
    throw new FilterError("Nenhum gestor cadastrado no departamento deste colaborador");
  }

  const contrato = await contextoDoColaborador(a.codigoempresa, a.codigofunccontr);
  const { assunto, html } = await emailDesempenho({
    titulo: a.titulo,
    mensagem: a.mensagem,
    funcionario: a.funcionario_nome,
    empresa: a.codigoempresa,
    cargo: contrato?.cargo ?? null,
    setor: contrato?.setor ?? null,
    token: a.token,
  });

  try {
    const { enviado } = await enviarEmail({ para, assunto, html });
    await appQuery(
      `update rh_desempenho
          set status = case when status = 'respondido' then status else 'enviado' end,
              enviado_em = now()
        where id = $1`,
      [id]
    );
    return enviado;
  } catch (err) {
    await appQuery(`update rh_desempenho set status = 'erro' where id = $1`, [id]);
    console.error("[desempenho] falha ao enviar", id, err);
    throw new FilterError("Falha ao enviar o e-mail — ver log do servidor");
  }
}

// ── Lembrete: cobrar quem não respondeu ───────────────────────────────────────

export interface ResultadoLembrete {
  enviado: boolean;
  destinatarios: string[];
}

/**
 * Cobra UMA avaliação parada: manda o mesmo link aos gestores do setor, agora
 * com cara de lembrete (diz desde quando está esperando) e deixando rastro em
 * `rh_desempenho_lembrete` — é o rastro que responde "essa já foi cobrada?".
 *
 * As três recusas SÃO a regra do recurso: encerrada (o link não aceita mais
 * nada), já respondida (o link é um só para o setor inteiro e quem responde se
 * identifica digitando o nome — não dá para saber qual gestor faltou, então
 * cobrar de novo bateria em quem respondeu) e ainda não enviada (aí não é
 * lembrete, é o disparo, e quem faz isso é `enviarAvaliacao`).
 */
export async function enviarLembrete(
  id: number,
  criadoPor?: string | null
): Promise<ResultadoLembrete> {
  const [a] = await appQuery<{
    id: number;
    token: string;
    classiforgan: string | null;
    funcionario_nome: string;
    codigoempresa: number;
    codigofunccontr: number;
    status: StatusDesempenho;
    encerrado_em: string | null;
    enviado_em: string | null;
    titulo: string;
    mensagem: string | null;
    respostas: number;
  }>(
    `select d.id, d.token, d.classiforgan, d.funcionario_nome, d.codigoempresa,
            d.codigofunccontr, d.status, d.encerrado_em,
            to_char(d.enviado_em, 'YYYY-MM-DD') as enviado_em, r.titulo, r.mensagem,
            (select count(*)::int from rh_desempenho_resposta x where x.desempenho_id = d.id)
              as respostas
       from rh_desempenho d join rh_desempenho_rodada r on r.id = d.rodada_id
      where d.id = $1`,
    [id]
  );
  if (!a) throw new FilterError("Avaliação não encontrada");
  if (a.encerrado_em) throw new FilterError("Avaliação encerrada — não há o que cobrar");
  if (a.respostas > 0) throw new FilterError("Esta avaliação já foi respondida");
  if (a.status !== "enviado") {
    throw new FilterError(
      a.status === "pendente"
        ? "Esta avaliação ainda não saiu — dispare antes de cobrar"
        : "O envio desta avaliação falhou — reenvie antes de cobrar"
    );
  }

  const para = a.classiforgan ? await emailsDosGestores(a.classiforgan) : [];
  if (!para.length) {
    throw new FilterError("Nenhum gestor cadastrado no departamento deste colaborador");
  }

  const contrato = await contextoDoColaborador(a.codigoempresa, a.codigofunccontr);
  const { assunto, html } = await emailDesempenho({
    titulo: a.titulo,
    mensagem: a.mensagem,
    funcionario: a.funcionario_nome,
    empresa: a.codigoempresa,
    cargo: contrato?.cargo ?? null,
    setor: contrato?.setor ?? null,
    token: a.token,
    lembrete: { desde: a.enviado_em },
  });

  let enviado: boolean;
  try {
    ({ enviado } = await enviarEmail({ para, assunto, html }));
  } catch (err) {
    // O status NÃO vira 'erro': o disparo original deu certo: quem falhou foi a
    // cobrança. Rebaixar aqui apagaria da tela que a avaliação está no ar.
    console.error("[desempenho] falha ao cobrar", id, err);
    throw new FilterError("Falha ao enviar o lembrete — ver log do servidor");
  }

  await appQuery(
    `insert into rh_desempenho_lembrete (desempenho_id, destinatarios, criado_por)
     values ($1, $2, $3)`,
    [id, para.join(", "), criadoPor ?? null]
  );
  return { enviado, destinatarios: para };
}

export interface ResultadoCobranca {
  cobradas: number; // avaliações que receberam o lembrete
  enviados: number; // e-mails de fato despachados (o driver de log conta 0)
  ignoradas: number; // já respondidas, encerradas ou que nem saíram
  falhas: string[]; // colaborador cuja cobrança não foi (setor sem gestor, SMTP)
}

/**
 * Cobra a rodada inteira de uma vez — é assim que a RH usa: "aquela avaliação
 * de agosto, quem não respondeu?". Só entram as avaliações cobráveis; o resto é
 * contado em `ignoradas` em vez de virar erro, senão uma rodada meio respondida
 * nunca poderia ser cobrada.
 *
 * Falha de UMA avaliação (setor sem gestor, SMTP fora do ar) não derruba o
 * lote: vira nome em `falhas` e o laço segue.
 */
export async function cobrarRodada(
  rodadaId: number,
  criadoPor?: string | null
): Promise<ResultadoCobranca> {
  const linhas = await appQuery<{ id: number; funcionario_nome: string; cobravel: boolean }>(
    `select d.id, d.funcionario_nome,
            (d.status = 'enviado' and d.encerrado_em is null
             and not exists (select 1 from rh_desempenho_resposta x
                              where x.desempenho_id = d.id)) as cobravel
       from rh_desempenho d where d.rodada_id = $1 order by d.id`,
    [rodadaId]
  );
  if (!linhas.length) throw new FilterError("Rodada não encontrada");

  let cobradas = 0;
  let enviados = 0;
  let ignoradas = 0;
  const falhas: string[] = [];
  for (const l of linhas) {
    if (!l.cobravel) {
      ignoradas++;
      continue;
    }
    try {
      const r = await enviarLembrete(l.id, criadoPor);
      cobradas++;
      if (r.enviado) enviados++;
    } catch (err) {
      falhas.push(l.funcionario_nome);
      console.error("[desempenho] falha ao cobrar", l.id, err);
    }
  }
  return { cobradas, enviados, ignoradas, falhas };
}

/** Encerra (ou reabre) uma avaliação: encerrada, o link para de aceitar resposta. */
export async function encerrarAvaliacao(id: number, encerrar: boolean): Promise<void> {
  const linhas = await appQuery(
    `update rh_desempenho set encerrado_em = case when $2 then now() else null end
      where id = $1 returning id`,
    [id, encerrar]
  );
  if (!linhas.length) throw new FilterError("Avaliação não encontrada");
}

/** Exclui uma avaliação (respostas vão junto). Rodada sem avaliação some também. */
export async function excluirAvaliacao(id: number): Promise<void> {
  const [a] = await appQuery<{ rodada_id: number }>(
    `delete from rh_desempenho where id = $1 returning rodada_id`,
    [id]
  );
  if (!a) throw new FilterError("Avaliação não encontrada");
  await appQuery(
    `delete from rh_desempenho_rodada r
      where r.id = $1 and not exists (select 1 from rh_desempenho d where d.rodada_id = r.id)`,
    [a.rodada_id]
  );
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export interface FiltroDesempenho {
  empresa?: number | null;
  classiforgan?: string | null;
  formularioId?: number | null;
  rodadaId?: number | null;
  status?: StatusDesempenho | null;
  de?: string | null; // YYYY-MM-DD (criação da avaliação)
  ate?: string | null;
  busca?: string | null; // nome do colaborador
}

interface LinhaDesempenho {
  id: number;
  rodada_id: number;
  rodada_titulo: string;
  escopo: EscopoRodada;
  formulario_id: number;
  formulario_nome: string;
  codigoempresa: number;
  codigofunccontr: number;
  funcionario_nome: string;
  classiforgan: string | null;
  status: StatusDesempenho;
  respostas: number;
  respondentes: string[] | null;
  ultima_resposta: string | null;
  lembretes: number;
  ultimo_lembrete: string | null;
  criado_em: string;
  enviado_em: string | null;
  encerrado_em: string | null;
}

/**
 * Avaliações que casam com o filtro, da mais nova pra mais velha. O cargo/setor
 * vêm do Diretório (dado vivo), com o nome do setor caindo para o organograma
 * quando a pessoa já saiu — a linha não pode sumir só porque o contrato encerrou.
 */
export async function listarDesempenho(f: FiltroDesempenho = {}): Promise<DesempenhoItem[]> {
  const cond: string[] = [];
  const vals: unknown[] = [];
  const p = (v: unknown) => {
    vals.push(v);
    return `$${vals.length}`;
  };

  if (f.empresa != null && ehEmpresaRh(f.empresa)) cond.push(`d.codigoempresa = ${p(f.empresa)}`);
  if (f.classiforgan) cond.push(`d.classiforgan = ${p(f.classiforgan)}`);
  if (f.formularioId) cond.push(`r.formulario_id = ${p(f.formularioId)}`);
  if (f.rodadaId) cond.push(`d.rodada_id = ${p(f.rodadaId)}`);
  if (f.status) cond.push(`d.status = ${p(f.status)}`);
  if (f.de) cond.push(`d.criado_em >= ${p(f.de)}::date`);
  // `ate` é inclusivo: o dia inteiro entra (criado_em é timestamp).
  if (f.ate) cond.push(`d.criado_em < (${p(f.ate)}::date + 1)`);
  if (f.busca?.trim()) cond.push(`d.funcionario_nome ilike ${p(`%${f.busca.trim()}%`)}`);

  const where = cond.length ? `where ${cond.join(" and ")}` : "";
  const rows = await appQuery<LinhaDesempenho>(
    `select d.id, d.rodada_id, r.titulo as rodada_titulo, r.escopo,
            r.formulario_id, fo.nome as formulario_nome,
            d.codigoempresa, d.codigofunccontr, d.funcionario_nome, d.classiforgan, d.status,
            (select count(*)::int from rh_desempenho_resposta x where x.desempenho_id = d.id)
              as respostas,
            (select array_agg(x.respondido_por_nome order by x.respondido_em)
               from rh_desempenho_resposta x where x.desempenho_id = d.id) as respondentes,
            (select to_char(max(x.respondido_em), 'YYYY-MM-DD"T"HH24:MI:SS')
               from rh_desempenho_resposta x where x.desempenho_id = d.id) as ultima_resposta,
            (select count(*)::int from rh_desempenho_lembrete l where l.desempenho_id = d.id)
              as lembretes,
            (select to_char(max(l.enviado_em), 'YYYY-MM-DD"T"HH24:MI:SS')
               from rh_desempenho_lembrete l where l.desempenho_id = d.id) as ultimo_lembrete,
            to_char(d.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            to_char(d.enviado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as enviado_em,
            to_char(d.encerrado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as encerrado_em
       from rh_desempenho d
       join rh_desempenho_rodada r on r.id = d.rodada_id
       join formulario fo on fo.id = r.formulario_id
       ${where}
      order by d.criado_em desc, d.funcionario_nome`,
    vals
  );
  if (!rows.length) return [];

  const [diretorio, setores, gestores] = await Promise.all([
    listarDiretorio(),
    nomesDeSetor(),
    contagemGestoresPorSetor(),
  ]);
  const porContrato = new Map<string, FuncionarioDiretorio>(
    diretorio.map((f2) => [`${f2.codigoempresa}:${f2.contrato}`, f2])
  );

  return rows.map((r) => {
    const vivo = porContrato.get(`${r.codigoempresa}:${r.codigofunccontr}`);
    return {
      id: r.id,
      rodadaId: r.rodada_id,
      rodadaTitulo: r.rodada_titulo,
      escopo: r.escopo,
      formularioId: r.formulario_id,
      formularioNome: r.formulario_nome,
      codigoempresa: r.codigoempresa,
      contrato: r.codigofunccontr,
      nome: vivo?.nome ?? r.funcionario_nome,
      cargo: vivo?.cargo ?? null,
      setor: vivo?.setor ?? (r.classiforgan ? setores.get(r.classiforgan) ?? null : null),
      classiforgan: r.classiforgan,
      status: r.status,
      gestores: r.classiforgan ? gestores.get(r.classiforgan) ?? 0 : 0,
      respostas: r.respostas,
      respondentes: r.respondentes ?? [],
      ultimaResposta: r.ultima_resposta,
      lembretes: r.lembretes,
      ultimoLembrete: r.ultimo_lembrete,
      criadoEm: r.criado_em,
      enviadoEm: r.enviado_em,
      encerradoEm: r.encerrado_em,
    };
  });
}

/** Uma avaliação com o formulário usado e TODAS as respostas, para o modal. */
export async function carregarDesempenho(id: number): Promise<DesempenhoDetalhe | null> {
  const [a] = await appQuery<{
    id: number;
    titulo: string;
    formulario_id: number;
    codigoempresa: number;
    codigofunccontr: number;
    funcionario_nome: string;
    classiforgan: string | null;
    criado_em: string;
    encerrado_em: string | null;
  }>(
    `select d.id, r.titulo, r.formulario_id, d.codigoempresa, d.codigofunccontr,
            d.funcionario_nome, d.classiforgan,
            to_char(d.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            to_char(d.encerrado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as encerrado_em
       from rh_desempenho d join rh_desempenho_rodada r on r.id = d.rodada_id
      where d.id = $1`,
    [id]
  );
  if (!a) return null;
  const formulario = await carregarFormulario(a.formulario_id);
  if (!formulario) return null;

  const respostas = await appQuery<{
    id: number;
    respondido_por_nome: string;
    respondido_por_email: string | null;
    respondido_em: string;
    valores: Record<string, unknown> | null;
  }>(
    `select id, respondido_por_nome, respondido_por_email,
            to_char(respondido_em, 'YYYY-MM-DD"T"HH24:MI:SS') as respondido_em, valores
       from rh_desempenho_resposta where desempenho_id = $1 order by respondido_em`,
    [id]
  );

  const contexto = await contextoDoColaborador(a.codigoempresa, a.codigofunccontr);
  return {
    id: a.id,
    titulo: a.titulo,
    funcionarioNome: contexto?.nome ?? a.funcionario_nome,
    codigoempresa: a.codigoempresa,
    cargo: contexto?.cargo ?? null,
    setor:
      contexto?.setor ??
      (a.classiforgan ? (await nomesDeSetor()).get(a.classiforgan) ?? null : null),
    criadoEm: a.criado_em,
    encerradoEm: a.encerrado_em,
    formulario,
    respostas: respostas.map((r) => ({
      id: r.id,
      nome: r.respondido_por_nome,
      email: r.respondido_por_email,
      respondidoEm: r.respondido_em,
      valores: r.valores ?? {},
    })),
  };
}

/** Rodadas já disparadas, para o filtro da tela. */
export async function listarRodadas(): Promise<DesempenhoRodada[]> {
  const rows = await appQuery<{
    id: number;
    titulo: string;
    escopo: EscopoRodada;
    formulario_nome: string;
    criado_em: string;
    avaliacoes: number;
    respondidas: number;
    a_cobrar: number;
  }>(
    `select r.id, r.titulo, r.escopo, f.nome as formulario_nome,
            to_char(r.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            (select count(*)::int from rh_desempenho d where d.rodada_id = r.id) as avaliacoes,
            (select count(*)::int from rh_desempenho d
              where d.rodada_id = r.id and d.status = 'respondido') as respondidas,
            -- cobráveis: saíram, seguem abertas e ninguém respondeu (ver enviarLembrete)
            (select count(*)::int from rh_desempenho d
              where d.rodada_id = r.id and d.status = 'enviado' and d.encerrado_em is null
                and not exists (select 1 from rh_desempenho_resposta x
                                 where x.desempenho_id = d.id)) as a_cobrar
       from rh_desempenho_rodada r join formulario f on f.id = r.formulario_id
      order by r.criado_em desc`
  );
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    escopo: r.escopo,
    formularioNome: r.formulario_nome,
    criadoEm: r.criado_em,
    avaliacoes: r.avaliacoes,
    respondidas: r.respondidas,
    aCobrar: r.a_cobrar,
  }));
}

// ── Apoio ─────────────────────────────────────────────────────────────────────

/** Quantos gestores ATIVOS cada departamento tem (0 = ninguém receberia o link). */
export async function contagemGestoresPorSetor(): Promise<Map<string, number>> {
  const rows = await appQuery<{ classiforgan: string; n: number }>(
    `select classiforgan, count(distinct email)::int as n
       from rh_setor_gestor where ativo group by classiforgan`
  );
  return new Map(rows.map((r) => [r.classiforgan, r.n]));
}

async function emailsDosGestores(classiforgan: string): Promise<string[]> {
  const rows = await appQuery<{ email: string }>(
    `select distinct email from rh_setor_gestor where ativo and classiforgan = $1`,
    [classiforgan]
  );
  return rows.map((r) => r.email);
}

/** Nome/cargo/setor vivos do colaborador de uma avaliação (Diretório cobre CLT e PJ). */
async function contextoDoColaborador(
  codigoempresa: number,
  contrato: number
): Promise<{ nome: string; cargo: string | null; setor: string | null } | null> {
  const diretorio = await listarDiretorio();
  const f = diretorio.find((x) => x.codigoempresa === codigoempresa && x.contrato === contrato);
  return f ? { nome: f.nome, cargo: f.cargo, setor: f.setor } : null;
}

// ── E-mail ────────────────────────────────────────────────────────────────────

async function emailDesempenho(params: {
  titulo: string;
  mensagem: string | null;
  funcionario: string;
  empresa: number;
  cargo: string | null;
  setor: string | null;
  token: string;
  /** Cobrança de avaliação parada: muda assunto e abertura — o link é o mesmo. */
  lembrete?: { desde: string | null };
}): Promise<{ assunto: string; html: string }> {
  const link = `${await appUrl()}/f/${params.token}`;
  const { lembrete } = params;
  const assunto = lembrete
    ? `Lembrete: ${params.titulo} — ${params.funcionario}`
    : `${params.titulo} — ${params.funcionario}`;
  const msg = params.mensagem
    ? `<p style="white-space:pre-line">${escapar(params.mensagem)}</p>`
    : "";
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#555">${rotulo}</td><td style="padding:2px 0">${escapar(valor)}</td></tr>`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5">
    <p>Olá,</p>
    ${
      lembrete
        ? `<p>Um lembrete: a avaliação de desempenho sobre
             <strong>${escapar(params.funcionario)}</strong> continua sem resposta.</p>`
        : `<p>O RH da Navecon pede sua avaliação de desempenho sobre
             <strong>${escapar(params.funcionario)}</strong>.</p>`
    }
    <table style="font-size:13px;margin:12px 0">
      ${linha("Colaborador", params.funcionario)}
      ${linha("Empresa", nomeEmpresaRh(params.empresa))}
      ${linha("Cargo", params.cargo ?? "—")}
      ${linha("Setor", params.setor ?? "—")}
      ${lembrete?.desde ? linha("Enviada em", dataBR(lembrete.desde)) : ""}
    </table>
    ${msg}
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">
        Responder avaliação
      </a>
    </p>
    <p style="color:#555;font-size:12px">Ou copie este link: <br>${link}</p>
    <p style="color:#555;font-size:12px">
      Não é preciso login. O link vai a todos os gestores do setor — cada um responde a sua
      avaliação, informando o próprio nome no formulário.${
        lembrete ? " Se você já respondeu, desconsidere este aviso." : ""
      }
    </p>
  </div>`;
  return { assunto, html };
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
