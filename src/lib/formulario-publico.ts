import "server-only";
import { appQuery } from "./app-db";
import { carregarFormulario } from "./formularios";
import { validarRespostas, type Formulario, type RespostaValores } from "./formularios-tipos";
import { buscarUmContrato } from "./rh-experiencia-dados";
import { nomeEmpresaRh, ehContratoPj, pjIdDoContrato } from "./rh";
import { nomesDeSetor } from "./rh-diretorio";
import { rotuloMarco, type Marco, type StatusExperiencia } from "./rh-experiencia";

/**
 * Formulário PÚBLICO por token (sem login) — resolução e submissão. Um token
 * pode vir de dois lugares: uma avaliação de experiência (rh_experiencia) ou um
 * destinatário de campanha (envio_destinatario, migration 013). Esta camada
 * unifica os dois numa mesma tela e num mesmo endpoint.
 */

export interface FormularioPublico {
  origem: "experiencia" | "envio";
  formulario: Formulario;
  titulo: string;
  subtitulo: string | null;
  /** Cabeçalho de contexto (funcionário/empresa na experiência; nada na campanha). */
  contexto: { rotulo: string; valor: string }[];
  mensagem: string | null;
  jaRespondido: boolean;
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Resolve o token para a definição do formulário + contexto, ou null se inválido. */
export async function resolverTokenPublico(token: string): Promise<FormularioPublico | null> {
  const exp = await resolverExperiencia(token);
  if (exp) return exp;
  const env = await resolverEnvio(token);
  if (env) return env;
  return null;
}

async function resolverExperiencia(token: string): Promise<FormularioPublico | null> {
  const [e] = await appQuery<{
    codigoempresa: number;
    codigofunccontr: number;
    marco: Marco;
    status: StatusExperiencia;
    formulario_id: number | null;
    vencimento: string;
  }>(
    `select codigoempresa, codigofunccontr, marco, status, formulario_id,
            to_char(data_vencimento, 'YYYY-MM-DD') as vencimento
       from rh_experiencia where token = $1`,
    [token]
  );
  if (!e) return null;
  if (!e.formulario_id) return null; // sem formulário ligado: nada a renderizar
  const formulario = await carregarFormulario(e.formulario_id);
  if (!formulario) return null;

  const c = await buscarUmContrato(e.codigoempresa, e.codigofunccontr);
  return {
    origem: "experiencia",
    formulario,
    titulo: "Avaliação de experiência",
    subtitulo: rotuloMarco(e.marco),
    contexto: [
      { rotulo: "Funcionário", valor: c?.nome ?? "Funcionário" },
      { rotulo: "Empresa", valor: nomeEmpresaRh(e.codigoempresa) },
      { rotulo: "Cargo", valor: c?.cargo ?? "—" },
      { rotulo: "Setor", valor: c?.setor ?? "—" },
      { rotulo: "Fim do período", valor: formatarData(e.vencimento) },
    ],
    mensagem: null,
    jaRespondido: e.status === "respondido",
  };
}

/** Campanhas (migration 013). Ausente na Fase 2 — a tabela ainda não existe. */
async function resolverEnvio(token: string): Promise<FormularioPublico | null> {
  const existe = await tabelaEnvioExiste();
  if (!existe) return null;
  const [d] = await appQuery<{
    formulario_id: number;
    titulo: string;
    mensagem: string | null;
    status: string;
    codigoempresa: number | null;
    codigofunccontr: number | null;
    funcionario_nome: string | null;
  }>(
    `select e.formulario_id, e.titulo, e.mensagem, d.status,
            d.codigoempresa, d.codigofunccontr, d.funcionario_nome
       from envio_destinatario d join envio e on e.id = d.envio_id
      where d.token = $1`,
    [token]
  );
  if (!d) return null;
  const formulario = await carregarFormulario(d.formulario_id);
  if (!formulario) return null;

  // "Sobre um colaborador": cabeçalho com o contrato (nome/cargo/setor/empresa),
  // buscado fresco no Questor — igual à experiência.
  let subtitulo: string | null = null;
  const contexto: { rotulo: string; valor: string }[] = [];
  if (d.codigoempresa != null && d.codigofunccontr != null) {
    // PJ tem "contrato" sintético e não existe no Questor — resolve no app-db.
    const c = ehContratoPj(d.codigofunccontr)
      ? await contextoPj(d.codigofunccontr)
      : await buscarUmContrato(d.codigoempresa, d.codigofunccontr);
    subtitulo = "Sobre um colaborador";
    contexto.push(
      { rotulo: "Colaborador", valor: c?.nome ?? d.funcionario_nome ?? "Colaborador" },
      { rotulo: "Empresa", valor: nomeEmpresaRh(d.codigoempresa) },
      { rotulo: "Cargo", valor: c?.cargo ?? "—" },
      { rotulo: "Setor", valor: c?.setor ?? "—" }
    );
  }

  return {
    origem: "envio",
    formulario,
    titulo: d.titulo || formulario.nome,
    subtitulo,
    contexto,
    mensagem: d.mensagem,
    jaRespondido: d.status === "respondido",
  };
}

/** Contexto (nome/cargo/setor) de uma pessoa PJ, para o cabeçalho do formulário. */
async function contextoPj(
  contrato: number
): Promise<{ nome: string; cargo: string | null; setor: string | null } | null> {
  const [p] = await appQuery<{ nome: string; cargo: string | null; classiforgan: string | null }>(
    `select nome, cargo, classiforgan from rh_pessoa_pj where id = $1`,
    [pjIdDoContrato(contrato)]
  );
  if (!p) return null;
  const setor = p.classiforgan ? (await nomesDeSetor()).get(p.classiforgan) ?? null : null;
  return { nome: p.nome, cargo: p.cargo, setor };
}

let _envioExiste: boolean | undefined;
async function tabelaEnvioExiste(): Promise<boolean> {
  if (_envioExiste !== undefined) return _envioExiste;
  const [r] = await appQuery<{ existe: boolean }>(
    `select to_regclass('public.envio_destinatario') is not null as existe`
  );
  _envioExiste = !!r?.existe;
  return _envioExiste;
}

export interface RespostaPublica {
  respondidoPorNome: string;
  respondidoPorEmail?: string | null;
  valores: RespostaValores;
}

/** Salva a resposta do formulário público (experiência ou campanha). */
export async function salvarRespostaPublica(
  token: string,
  dados: RespostaPublica
): Promise<{ ok: boolean; erro?: string }> {
  if (!dados.respondidoPorNome?.trim()) return { ok: false, erro: "Informe seu nome" };

  const alvo = await localizarAlvo(token);
  if (!alvo) return { ok: false, erro: "Formulário não encontrado" };
  if (alvo.jaRespondido) return { ok: false, erro: "Este formulário já foi respondido" };

  const formulario = await carregarFormulario(alvo.formularioId);
  if (!formulario) return { ok: false, erro: "Formulário indisponível" };

  const erros = validarRespostas(formulario.campos, dados.valores);
  if (Object.keys(erros).length) {
    return { ok: false, erro: "Revise os campos destacados antes de enviar" };
  }
  const respostas = JSON.stringify({ valores: dados.valores });

  if (alvo.origem === "experiencia") {
    const [inserida] = await appQuery<{ id: number }>(
      `insert into rh_experiencia_resposta
          (experiencia_id, respondido_por_nome, respondido_por_email, respostas)
       values ($1, $2, $3, $4)
       on conflict (experiencia_id) do nothing
       returning id`,
      [alvo.id, dados.respondidoPorNome.trim(), dados.respondidoPorEmail?.trim() || null, respostas]
    );
    if (!inserida) return { ok: false, erro: "Este formulário já foi respondido" };
    await appQuery(`update rh_experiencia set status = 'respondido' where id = $1`, [alvo.id]);
    return { ok: true };
  }

  // origem === "envio" (Fase 3)
  await appQuery(
    `update envio_destinatario
        set status = 'respondido', valores = $2, respondido_por_nome = $3, respondido_em = now()
      where id = $1 and status <> 'respondido'`,
    [alvo.id, respostas, dados.respondidoPorNome.trim()]
  );
  return { ok: true };
}

interface Alvo {
  origem: "experiencia" | "envio";
  id: number;
  formularioId: number;
  jaRespondido: boolean;
}

async function localizarAlvo(token: string): Promise<Alvo | null> {
  const [e] = await appQuery<{ id: number; status: string; formulario_id: number | null }>(
    `select id, status, formulario_id from rh_experiencia where token = $1`,
    [token]
  );
  if (e) {
    if (!e.formulario_id) return null;
    return { origem: "experiencia", id: e.id, formularioId: e.formulario_id, jaRespondido: e.status === "respondido" };
  }
  if (await tabelaEnvioExiste()) {
    const [d] = await appQuery<{ id: number; status: string; formulario_id: number }>(
      `select d.id, d.status, e.formulario_id
         from envio_destinatario d join envio e on e.id = d.envio_id
        where d.token = $1`,
      [token]
    );
    if (d) {
      return { origem: "envio", id: d.id, formularioId: d.formulario_id, jaRespondido: d.status === "respondido" };
    }
  }
  return null;
}
