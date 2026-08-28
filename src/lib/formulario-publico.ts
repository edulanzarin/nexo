import "server-only";
import { appQuery } from "./app-db";
import { carregarFormulario } from "./formularios";
import { validarRespostas, type Formulario, type RespostaValores } from "./formularios-tipos";
import { buscarUmContrato } from "./rh-experiencia-dados";
import { nomeEmpresaRh } from "./rh";
import { listarDiretorio } from "./rh-diretorio";
import { rotuloMarco, type Marco, type StatusExperiencia } from "./rh-experiencia";

/**
 * Formulário PÚBLICO por token (sem login) — resolução e submissão. Um token vem
 * de três lugares: uma avaliação de experiência (rh_experiencia), uma avaliação
 * de desempenho (rh_desempenho, migration 033) ou um destinatário de campanha
 * (envio_destinatario). Esta camada unifica os três numa mesma tela e num mesmo
 * endpoint.
 *
 * Experiência e campanha aceitam UMA resposta e fecham; desempenho aceita
 * VÁRIAS (uma por gestor) e só fecha quando a RH encerra a avaliação.
 */

export interface FormularioPublico {
  origem: "experiencia" | "envio" | "desempenho";
  formulario: Formulario;
  titulo: string;
  subtitulo: string | null;
  /** Cabeçalho de contexto (funcionário/empresa na experiência; nada na campanha). */
  contexto: { rotulo: string; valor: string }[];
  mensagem: string | null;
  /** Não aceita mais resposta (respondido, ou encerrado no caso do desempenho). */
  jaRespondido: boolean;
  /** Texto da tela de fechado, quando o motivo não é "já respondeu". */
  avisoFechado?: { titulo: string; texto: string };
  /** Aceita mais de uma resposta — a tela avisa que cada gestor manda a sua. */
  varias?: boolean;
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Resolve o token para a definição do formulário + contexto, ou null se inválido. */
export async function resolverTokenPublico(token: string): Promise<FormularioPublico | null> {
  const exp = await resolverExperiencia(token);
  if (exp) return exp;
  const des = await resolverDesempenho(token);
  if (des) return des;
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

/** Campanhas (migration 013): destinatário comum, sem colaborador avaliado — a
 *  avaliação sobre alguém virou trilha própria (resolverDesempenho). */
async function resolverEnvio(token: string): Promise<FormularioPublico | null> {
  const existe = await tabelaEnvioExiste();
  if (!existe) return null;
  const [d] = await appQuery<{
    formulario_id: number;
    titulo: string;
    mensagem: string | null;
    status: string;
  }>(
    `select e.formulario_id, e.titulo, e.mensagem, d.status
       from envio_destinatario d join envio e on e.id = d.envio_id
      where d.token = $1`,
    [token]
  );
  if (!d) return null;
  const formulario = await carregarFormulario(d.formulario_id);
  if (!formulario) return null;

  return {
    origem: "envio",
    formulario,
    titulo: d.titulo || formulario.nome,
    subtitulo: null,
    contexto: [],
    mensagem: d.mensagem,
    jaRespondido: d.status === "respondido",
  };
}

/**
 * Avaliação de desempenho (migration 033). O mesmo link vale para todos os
 * gestores do setor e aceita VÁRIAS respostas: só fecha quando a RH encerra —
 * por isso `jaRespondido` aqui olha `encerrado_em`, não o status.
 */
async function resolverDesempenho(token: string): Promise<FormularioPublico | null> {
  const [d] = await appQuery<{
    codigoempresa: number;
    codigofunccontr: number;
    funcionario_nome: string;
    classiforgan: string | null;
    encerrado_em: string | null;
    formulario_id: number;
    titulo: string;
    mensagem: string | null;
  }>(
    `select d.codigoempresa, d.codigofunccontr, d.funcionario_nome, d.classiforgan,
            d.encerrado_em, r.formulario_id, r.titulo, r.mensagem
       from rh_desempenho d join rh_desempenho_rodada r on r.id = d.rodada_id
      where d.token = $1`,
    [token]
  );
  if (!d) return null;
  const formulario = await carregarFormulario(d.formulario_id);
  if (!formulario) return null;

  // Nome/cargo/setor vivos do Diretório (cobre CLT e PJ); quem já saiu cai no
  // snapshot gravado no disparo.
  const diretorio = await listarDiretorio();
  const c = diretorio.find(
    (x) => x.codigoempresa === d.codigoempresa && x.contrato === d.codigofunccontr
  );

  return {
    origem: "desempenho",
    formulario,
    titulo: d.titulo || formulario.nome,
    subtitulo: "Avaliação de desempenho",
    contexto: [
      { rotulo: "Colaborador", valor: c?.nome ?? d.funcionario_nome },
      { rotulo: "Empresa", valor: nomeEmpresaRh(d.codigoempresa) },
      { rotulo: "Cargo", valor: c?.cargo ?? "—" },
      { rotulo: "Setor", valor: c?.setor ?? "—" },
    ],
    mensagem: d.mensagem,
    jaRespondido: d.encerrado_em != null,
    avisoFechado: {
      titulo: "Avaliação encerrada",
      texto: "O RH encerrou esta avaliação e ela não aceita mais respostas.",
    },
    varias: true,
  };
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
  if (alvo.fechado) return { ok: false, erro: alvo.erroFechado };

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

  if (alvo.origem === "desempenho") {
    // Sem `on conflict`: várias respostas por avaliação é a regra aqui — cada
    // gestor manda a sua, e o nome (obrigatório acima) é o que as distingue.
    await appQuery(
      `insert into rh_desempenho_resposta
          (desempenho_id, respondido_por_nome, respondido_por_email, valores)
       values ($1, $2, $3, $4)`,
      [
        alvo.id,
        dados.respondidoPorNome.trim(),
        dados.respondidoPorEmail?.trim() || null,
        JSON.stringify(dados.valores),
      ]
    );
    await appQuery(`update rh_desempenho set status = 'respondido' where id = $1`, [alvo.id]);
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
  origem: "experiencia" | "envio" | "desempenho";
  id: number;
  formularioId: number;
  /** Não aceita (mais) resposta: já respondido, ou encerrado no desempenho. */
  fechado: boolean;
  erroFechado: string;
}

const JA_RESPONDIDO = "Este formulário já foi respondido";

async function localizarAlvo(token: string): Promise<Alvo | null> {
  const [e] = await appQuery<{ id: number; status: string; formulario_id: number | null }>(
    `select id, status, formulario_id from rh_experiencia where token = $1`,
    [token]
  );
  if (e) {
    if (!e.formulario_id) return null;
    return {
      origem: "experiencia",
      id: e.id,
      formularioId: e.formulario_id,
      fechado: e.status === "respondido",
      erroFechado: JA_RESPONDIDO,
    };
  }

  const [d] = await appQuery<{ id: number; formulario_id: number; encerrado_em: string | null }>(
    `select d.id, r.formulario_id, d.encerrado_em
       from rh_desempenho d join rh_desempenho_rodada r on r.id = d.rodada_id
      where d.token = $1`,
    [token]
  );
  if (d) {
    return {
      origem: "desempenho",
      id: d.id,
      formularioId: d.formulario_id,
      fechado: d.encerrado_em != null,
      erroFechado: "Esta avaliação foi encerrada pelo RH",
    };
  }
  if (await tabelaEnvioExiste()) {
    const [e2] = await appQuery<{ id: number; status: string; formulario_id: number }>(
      `select d.id, d.status, e.formulario_id
         from envio_destinatario d join envio e on e.id = d.envio_id
        where d.token = $1`,
      [token]
    );
    if (e2) {
      return {
        origem: "envio",
        id: e2.id,
        formularioId: e2.formulario_id,
        fechado: e2.status === "respondido",
        erroFechado: JA_RESPONDIDO,
      };
    }
  }
  return null;
}
