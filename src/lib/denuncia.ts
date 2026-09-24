import "server-only";
import { randomBytes } from "node:crypto";
import { appQuery } from "./app-db";
import { hashSenha, verificarSenha } from "./auth";
import {
  ehCategoria,
  type CategoriaDenuncia,
  type DenunciaDashboard,
  type DenunciaDetalhe,
  type DenunciaPublica,
  type DenunciaResumo,
  type MensagemDenuncia,
  type StatusDenuncia,
} from "./denuncia-tipos";

/**
 * Canal de DENÚNCIA (ouvidoria) — lógica no servidor. O denunciante é anônimo:
 * a única credencial é o par protocolo+senha que recebe ao enviar (senha guardada
 * só como hash). Nada aqui grava IP, identidade ou vínculo com `usuario`.
 */

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — protocolo e senha são lidos e
// digitados por humanos.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function sortear(n: number): string {
  const b = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return s;
}

/** Senha de acompanhamento: 12 chars em 3 grupos (ex. `ABCD-EF23-HJKM`). */
function gerarSenha(): string {
  const raw = sortear(12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function protocoloCandidato(): string {
  return `DEN-${new Date().getFullYear()}-${sortear(6)}`;
}

export interface NovaDenuncia {
  categoria: string;
  relato: string;
  setorEnvolvido?: string | null;
}

export interface DenunciaCriada {
  protocolo: string;
  senha: string;
}

/**
 * Cria a denúncia e devolve protocolo + senha EM CLARO — a única vez que a senha
 * existe legível. Retenta o protocolo em caso (raríssimo) de colisão.
 */
export async function criarDenuncia(dados: NovaDenuncia): Promise<{ ok: true; dados: DenunciaCriada } | { ok: false; erro: string }> {
  const categoria = String(dados.categoria || "");
  if (!ehCategoria(categoria)) return { ok: false, erro: "Escolha um assunto válido" };
  const relato = String(dados.relato || "").trim();
  if (relato.length < 20) return { ok: false, erro: "Descreva o ocorrido com mais detalhes (mínimo 20 caracteres)" };
  const setor = dados.setorEnvolvido?.trim() || null;

  const senha = gerarSenha();
  const senhaHash = await hashSenha(senha);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const protocolo = protocoloCandidato();
    try {
      const [linha] = await appQuery<{ protocolo: string }>(
        `insert into denuncia (protocolo, senha_hash, categoria, relato, setor_envolvido)
         values ($1, $2, $3, $4, $5)
         returning protocolo`,
        [protocolo, senhaHash, categoria, relato, setor]
      );
      return { ok: true, dados: { protocolo: linha.protocolo, senha } };
    } catch (err) {
      // 23505 = unique_violation no protocolo: tenta outro. Qualquer outra falha sobe.
      if ((err as { code?: string })?.code === "23505") continue;
      throw err;
    }
  }
  return { ok: false, erro: "Não foi possível registrar agora — tente novamente" };
}

interface LinhaDenuncia {
  id: number;
  protocolo: string;
  senha_hash: string;
  categoria: CategoriaDenuncia;
  relato: string;
  setor_envolvido: string | null;
  status: StatusDenuncia;
  criado_em: Date;
  atualizado_em: Date;
}

async function mensagensDe(denunciaId: number): Promise<MensagemDenuncia[]> {
  const rows = await appQuery<{ autor: "denunciante" | "rh"; autor_nome: string | null; corpo: string; criado_em: Date }>(
    `select autor, autor_nome, corpo, criado_em
       from denuncia_mensagem where denuncia_id = $1 order by criado_em asc`,
    [denunciaId]
  );
  return rows.map((m) => ({
    autor: m.autor,
    autorNome: m.autor_nome,
    corpo: m.corpo,
    criadoEm: m.criado_em.toISOString(),
  }));
}

/** Resolve protocolo+senha para a denúncia, ou null se qualquer um não bater. */
async function autenticar(protocolo: string, senha: string): Promise<LinhaDenuncia | null> {
  const [d] = await appQuery<LinhaDenuncia>(
    `select id, protocolo, senha_hash, categoria, relato, setor_envolvido, status, criado_em, atualizado_em
       from denuncia where protocolo = $1`,
    [protocolo.trim().toUpperCase()]
  );
  if (!d) return null;
  const ok = await verificarSenha(senha, d.senha_hash);
  return ok ? d : null;
}

/** Vista pública do acompanhamento (protocolo+senha). */
export async function consultarDenuncia(protocolo: string, senha: string): Promise<DenunciaPublica | null> {
  const d = await autenticar(protocolo, senha);
  if (!d) return null;
  return {
    protocolo: d.protocolo,
    categoria: d.categoria,
    status: d.status,
    relato: d.relato,
    criadoEm: d.criado_em.toISOString(),
    atualizadoEm: d.atualizado_em.toISOString(),
    mensagens: await mensagensDe(d.id),
  };
}

/** Denunciante adiciona informação à sua própria denúncia. */
export async function adicionarMensagemDenunciante(
  protocolo: string,
  senha: string,
  corpo: string
): Promise<{ ok: boolean; erro?: string }> {
  const texto = String(corpo || "").trim();
  if (!texto) return { ok: false, erro: "Escreva a mensagem" };
  const d = await autenticar(protocolo, senha);
  if (!d) return { ok: false, erro: "Protocolo ou senha inválidos" };
  if (d.status === "concluida" || d.status === "arquivada") {
    return { ok: false, erro: "Esta denúncia já foi encerrada" };
  }
  await appQuery(
    `insert into denuncia_mensagem (denuncia_id, autor, corpo) values ($1, 'denunciante', $2)`,
    [d.id, texto]
  );
  // Bumpa atualizado_em para a denúncia voltar ao topo da fila do RH.
  await appQuery(`update denuncia set atualizado_em = now() where id = $1`, [d.id]);
  return { ok: true };
}

// ── Gestão (RH) ──────────────────────────────────────────────────────────────

export async function listarDenuncias(filtro?: {
  status?: string | null;
  categoria?: string | null;
}): Promise<DenunciaResumo[]> {
  const status = filtro?.status && filtro.status !== "todas" ? filtro.status : null;
  const categoria = filtro?.categoria && filtro.categoria !== "todas" ? filtro.categoria : null;

  const rows = await appQuery<{
    id: number;
    protocolo: string;
    categoria: CategoriaDenuncia;
    status: StatusDenuncia;
    setor_envolvido: string | null;
    criado_em: Date;
    atualizado_em: Date;
    mensagens: number;
    ultimo_autor: "denunciante" | "rh" | null;
  }>(
    `select d.id, d.protocolo, d.categoria, d.status, d.setor_envolvido,
            d.criado_em, d.atualizado_em,
            (select count(*)::int from denuncia_mensagem m where m.denuncia_id = d.id) as mensagens,
            (select m.autor from denuncia_mensagem m
               where m.denuncia_id = d.id order by m.criado_em desc limit 1) as ultimo_autor
       from denuncia d
      where ($1::text is null or d.status = $1)
        and ($2::text is null or d.categoria = $2)
      order by d.atualizado_em desc`,
    [status, categoria]
  );

  return rows.map((r) => {
    const aberto = r.status === "recebida" || r.status === "em_analise";
    const aguardandoRh = aberto && (r.ultimo_autor === null || r.ultimo_autor === "denunciante");
    return {
      id: r.id,
      protocolo: r.protocolo,
      categoria: r.categoria,
      status: r.status,
      setorEnvolvido: r.setor_envolvido,
      criadoEm: r.criado_em.toISOString(),
      atualizadoEm: r.atualizado_em.toISOString(),
      mensagens: r.mensagens,
      aguardandoRh,
    };
  });
}

export async function detalheDenuncia(id: number): Promise<DenunciaDetalhe | null> {
  const [d] = await appQuery<LinhaDenuncia>(
    `select id, protocolo, senha_hash, categoria, relato, setor_envolvido, status, criado_em, atualizado_em
       from denuncia where id = $1`,
    [id]
  );
  if (!d) return null;
  return {
    id: d.id,
    protocolo: d.protocolo,
    categoria: d.categoria,
    status: d.status,
    relato: d.relato,
    setorEnvolvido: d.setor_envolvido,
    criadoEm: d.criado_em.toISOString(),
    atualizadoEm: d.atualizado_em.toISOString(),
    mensagens: await mensagensDe(d.id),
  };
}

export async function responderDenuncia(
  id: number,
  corpo: string,
  autorNome: string
): Promise<{ ok: boolean; erro?: string }> {
  const texto = String(corpo || "").trim();
  if (!texto) return { ok: false, erro: "Escreva a resposta" };
  const [d] = await appQuery<{ id: number }>(`select id from denuncia where id = $1`, [id]);
  if (!d) return { ok: false, erro: "Denúncia não encontrada" };
  await appQuery(
    `insert into denuncia_mensagem (denuncia_id, autor, autor_nome, corpo)
     values ($1, 'rh', $2, $3)`,
    [id, autorNome, texto]
  );
  await appQuery(`update denuncia set atualizado_em = now() where id = $1`, [id]);
  return { ok: true };
}

export async function mudarStatusDenuncia(
  id: number,
  status: StatusDenuncia
): Promise<{ ok: boolean; erro?: string }> {
  const r = await appQuery<{ id: number }>(
    `update denuncia set status = $2 where id = $1 returning id`,
    [id, status]
  );
  if (!r.length) return { ok: false, erro: "Denúncia não encontrada" };
  return { ok: true };
}

export async function dashboardDenuncia(): Promise<DenunciaDashboard> {
  const [porStatus, porCategoria, tempo] = await Promise.all([
    appQuery<{ status: StatusDenuncia; qtd: number }>(
      `select status, count(*)::int as qtd from denuncia group by status`
    ),
    appQuery<{ categoria: CategoriaDenuncia; qtd: number }>(
      `select categoria, count(*)::int as qtd from denuncia group by categoria order by qtd desc`
    ),
    appQuery<{ horas: number | null }>(
      // Horas médias entre a criação e a 1ª resposta do RH.
      `select avg(extract(epoch from (primeira - d.criado_em)) / 3600.0)::float as horas
         from denuncia d
         join lateral (
           select min(m.criado_em) as primeira
             from denuncia_mensagem m
            where m.denuncia_id = d.id and m.autor = 'rh'
         ) p on true
        where p.primeira is not null`
    ),
  ]);

  const statusMap = { recebida: 0, em_analise: 0, concluida: 0, arquivada: 0 } as Record<StatusDenuncia, number>;
  for (const s of porStatus) statusMap[s.status] = s.qtd;
  const total = porStatus.reduce((a, s) => a + s.qtd, 0);

  // aguardandoRh precisa do último autor por denúncia — reusa a lista.
  const abertas = await listarDenuncias({ status: null, categoria: null });
  const aguardando = abertas.filter((d) => d.aguardandoRh).length;

  return {
    total,
    porStatus: statusMap,
    porCategoria: porCategoria.map((c) => ({ categoria: c.categoria, qtd: c.qtd })),
    aguardandoRh: aguardando,
    horasPrimeiraResposta: tempo[0]?.horas ?? null,
  };
}
