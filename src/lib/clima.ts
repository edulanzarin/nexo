import "server-only";
import { randomBytes } from "node:crypto";
import { appQuery } from "./app-db";
import type {
  ClimaDashboard,
  RespostaClimaInput,
  RodadaPublica,
  RodadaResumo,
  StatusRodada,
} from "./clima-tipos";
import {
  validarRespostas,
  valorPreenchido,
  type CampoConfig,
  type FormularioCampo,
  type RespostaValores,
  type TipoCampo,
} from "./formularios-tipos";

/**
 * CLIMA (avaliação anônima da empresa) — lógica no servidor. A rodada aponta para
 * um FORMULÁRIO do construtor; o link público (slug) renderiza os campos dele e
 * cada pessoa responde uma vez, anonimamente. Nenhuma coluna de identidade: o que
 * sai daqui não amarra resposta a pessoa.
 */

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "rodada";
}

interface CampoRow {
  id: number;
  ordem: number;
  tipo: TipoCampo;
  rotulo: string;
  ajuda: string | null;
  obrigatorio: boolean;
  config: CampoConfig;
}

async function camposDoFormulario(formularioId: number): Promise<FormularioCampo[]> {
  const rows = await appQuery<CampoRow>(
    `select id, ordem, tipo, rotulo, ajuda, obrigatorio, config
       from formulario_campo where formulario_id = $1
      order by ordem, id`,
    [formularioId]
  );
  return rows.map((r) => ({
    id: r.id,
    ordem: r.ordem,
    tipo: r.tipo,
    rotulo: r.rotulo,
    ajuda: r.ajuda,
    obrigatorio: r.obrigatorio,
    config: r.config ?? {},
  }));
}

/** Mantém só os valores de campos que existem no formulário (defesa contra lixo). */
function sanitizarValores(campos: FormularioCampo[], valores: RespostaValores): RespostaValores {
  const limpos: RespostaValores = {};
  for (const c of campos) {
    const v = valores[String(c.id)];
    if (valorPreenchido(c.tipo, v)) limpos[String(c.id)] = v;
  }
  return limpos;
}

// ── Público ──────────────────────────────────────────────────────────────────

interface LinhaRodada {
  id: number;
  titulo: string;
  descricao: string | null;
  slug: string;
  status: StatusRodada;
  formulario_id: number | null;
}

export async function rodadaAbertaPorSlug(slug: string): Promise<RodadaPublica | null> {
  const [r] = await appQuery<LinhaRodada>(
    `select id, titulo, descricao, slug, status, formulario_id
       from clima_rodada where slug = $1 and status = 'aberta'`,
    [slug]
  );
  if (!r || r.formulario_id == null) return null;
  const campos = await camposDoFormulario(r.formulario_id);
  return { slug: r.slug, titulo: r.titulo, descricao: r.descricao, campos };
}

export async function salvarRespostaClima(
  slug: string,
  input: RespostaClimaInput
): Promise<{ ok: boolean; erro?: string }> {
  const [r] = await appQuery<LinhaRodada>(
    `select id, titulo, descricao, slug, status, formulario_id
       from clima_rodada where slug = $1 and status = 'aberta'`,
    [slug]
  );
  if (!r || r.formulario_id == null) return { ok: false, erro: "Esta avaliação não está mais disponível" };

  const campos = await camposDoFormulario(r.formulario_id);
  const erros = validarRespostas(campos, input.valores ?? {});
  if (Object.keys(erros).length) return { ok: false, erro: "Revise as respostas antes de enviar" };

  const valores = sanitizarValores(campos, input.valores ?? {});

  await appQuery(
    `insert into clima_resposta (rodada_id, valores) values ($1, $2)`,
    [r.id, JSON.stringify(valores)]
  );
  return { ok: true };
}

// ── Gestão (RH) ──────────────────────────────────────────────────────────────

export async function listarRodadas(): Promise<RodadaResumo[]> {
  const rows = await appQuery<{
    id: number;
    titulo: string;
    slug: string;
    status: StatusRodada;
    respostas: number;
    aberto_em: Date;
    fechado_em: Date | null;
  }>(
    `select r.id, r.titulo, r.slug, r.status, r.aberto_em, r.fechado_em,
            (select count(*)::int from clima_resposta c where c.rodada_id = r.id) as respostas
       from clima_rodada r
      order by r.aberto_em desc`
  );
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    slug: r.slug,
    status: r.status,
    respostas: r.respostas,
    abertoEm: r.aberto_em.toISOString(),
    fechadoEm: r.fechado_em ? r.fechado_em.toISOString() : null,
  }));
}

export async function criarRodada(dados: {
  titulo: string;
  descricao?: string | null;
  formularioId: number;
}): Promise<{ ok: boolean; erro?: string; id?: number; slug?: string }> {
  const titulo = String(dados.titulo || "").trim();
  if (!titulo) return { ok: false, erro: "Dê um título à rodada" };

  const formularioId = Number(dados.formularioId);
  if (!Number.isInteger(formularioId) || formularioId <= 0) {
    return { ok: false, erro: "Escolha um formulário para a rodada" };
  }
  const [form] = await appQuery<{ id: number; status: string; campos: number }>(
    `select f.id, f.status,
            (select count(*)::int from formulario_campo c where c.formulario_id = f.id) as campos
       from formulario f where f.id = $1`,
    [formularioId]
  );
  if (!form) return { ok: false, erro: "Formulário não encontrado" };
  if (form.status !== "ativo") return { ok: false, erro: "Só dá para usar um formulário ativo" };
  if (form.campos === 0) return { ok: false, erro: "O formulário escolhido não tem perguntas" };

  const base = slugify(titulo);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const slug = tentativa === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      const [linha] = await appQuery<{ id: number; slug: string }>(
        `insert into clima_rodada (titulo, descricao, slug, formulario_id)
         values ($1, $2, $3, $4) returning id, slug`,
        [titulo, dados.descricao?.trim() || null, slug, formularioId]
      );
      return { ok: true, id: linha.id, slug: linha.slug };
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") continue; // slug em uso
      throw err;
    }
  }
  return { ok: false, erro: "Não foi possível criar a rodada — tente outro título" };
}

export async function definirStatusRodada(
  id: number,
  status: StatusRodada
): Promise<{ ok: boolean; erro?: string }> {
  const r = await appQuery<{ id: number }>(
    `update clima_rodada
        set status = $2,
            fechado_em = case when $2 = 'fechada' then now() else null end
      where id = $1 returning id`,
    [id, status]
  );
  if (!r.length) return { ok: false, erro: "Rodada não encontrada" };
  return { ok: true };
}

export async function dashboardClima(rodadaId: number): Promise<ClimaDashboard | null> {
  const [rodada] = await appQuery<LinhaRodada>(
    `select id, titulo, descricao, slug, status, formulario_id from clima_rodada where id = $1`,
    [rodadaId]
  );
  if (!rodada) return null;

  const campos = rodada.formulario_id != null ? await camposDoFormulario(rodada.formulario_id) : [];

  const linhas = await appQuery<{ valores: RespostaValores; criado_em: Date }>(
    `select valores, criado_em from clima_resposta where rodada_id = $1 order by criado_em desc`,
    [rodadaId]
  );

  const respostas = linhas.map((l) => ({
    valores: l.valores ?? {},
    criadoEm: l.criado_em.toISOString(),
  }));

  return {
    rodada: { id: rodada.id, titulo: rodada.titulo, slug: rodada.slug, status: rodada.status },
    campos,
    total: respostas.length,
    respostas,
  };
}
