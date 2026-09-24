import "server-only";
import { appPool, appQuery, erroAppDb } from "./app-db";
import { FilterError } from "./fiscal-filters";
import {
  TIPOS_CAMPO,
  type CampoConfig,
  type Formulario,
  type FormularioCampo,
  type FormularioResumo,
  type StatusFormulario,
  type TipoCampo,
} from "./formularios-tipos";

/**
 * Lado servidor dos formulários: CRUD do formulário e seus campos. As respostas
 * (público, por token) moram no envio que as gerou — ver rh-experiencia-dados
 * (experiência) e o módulo de campanhas (envios). Aqui é só a definição.
 */

interface CampoRow {
  id: number;
  ordem: number;
  tipo: TipoCampo;
  rotulo: string;
  ajuda: string | null;
  obrigatorio: boolean;
  config: CampoConfig;
}

interface FormRow {
  id: number;
  nome: string;
  descricao: string | null;
  status: StatusFormulario;
  criado_em?: string;
  atualizado_em?: string;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/** Lista de formulários (sem os campos; só a contagem), mais recentes primeiro. */
export async function listarFormularios(): Promise<FormularioResumo[]> {
  const rows = await appQuery<{
    id: number;
    nome: string;
    descricao: string | null;
    status: StatusFormulario;
    campos: number;
    atualizado_em: string;
  }>(
    `select f.id, f.nome, f.descricao, f.status,
            (select count(*)::int from formulario_campo c where c.formulario_id = f.id) as campos,
            to_char(f.atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em
       from formulario f
      order by f.atualizado_em desc`
  );
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    status: r.status,
    campos: r.campos,
    atualizadoEm: r.atualizado_em,
  }));
}

/** Um formulário com seus campos, ou null. */
export async function carregarFormulario(id: number): Promise<Formulario | null> {
  const [f] = await appQuery<FormRow>(
    `select id, nome, descricao, status,
            to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            to_char(atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em
       from formulario where id = $1`,
    [id]
  );
  if (!f) return null;
  const campos = await carregarCampos(id);
  return {
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    status: f.status,
    campos,
    criadoEm: f.criado_em,
    atualizadoEm: f.atualizado_em,
  };
}

async function carregarCampos(formularioId: number): Promise<FormularioCampo[]> {
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

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function criarFormulario(nome: string, descricao?: string | null): Promise<Formulario> {
  const n = (nome ?? "").trim();
  if (!n) throw new FilterError("Informe o nome do formulário");
  const [row] = await appQuery<FormRow>(
    `insert into formulario (nome, descricao) values ($1, $2)
     returning id, nome, descricao, status`,
    [n, descricao?.trim() || null]
  );
  return { id: row.id, nome: row.nome, descricao: row.descricao, status: row.status, campos: [] };
}

export async function atualizarFormularioMeta(
  id: number,
  dados: { nome?: string; descricao?: string | null; status?: StatusFormulario }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (dados.nome !== undefined) {
    const n = dados.nome.trim();
    if (!n) throw new FilterError("Informe o nome do formulário");
    params.push(n);
    sets.push(`nome = $${params.length}`);
  }
  if (dados.descricao !== undefined) {
    params.push(dados.descricao?.trim() || null);
    sets.push(`descricao = $${params.length}`);
  }
  if (dados.status !== undefined) {
    if (!["rascunho", "ativo", "arquivado"].includes(dados.status)) {
      throw new FilterError("Status inválido");
    }
    params.push(dados.status);
    sets.push(`status = $${params.length}`);
  }
  if (!sets.length) return;
  const [row] = await appQuery<{ id: number }>(
    `update formulario set ${sets.join(", ")} where id = $1 returning id`,
    params
  );
  if (!row) throw new FilterError("Formulário não encontrado");
}

export interface CampoEntrada {
  id?: number | null;
  ordem: number;
  tipo: string;
  rotulo: string;
  ajuda?: string | null;
  obrigatorio?: boolean;
  config?: CampoConfig;
}

/** Normaliza um campo vindo do client (defensivo — o builder é confiável, mas o
 *  banco não deve receber lixo). Lança FilterError em campo inválido. */
function sanitizarCampo(c: CampoEntrada, i: number): Omit<CampoEntrada, "id"> & { id: number | null } {
  const tipo = String(c.tipo) as TipoCampo;
  if (!(TIPOS_CAMPO as readonly string[]).includes(tipo)) {
    throw new FilterError(`Tipo de campo inválido: ${c.tipo}`);
  }
  const rotulo = String(c.rotulo ?? "").trim();
  if (!rotulo) throw new FilterError(`A pergunta ${i + 1} está sem enunciado`);

  const config: CampoConfig = {};
  const src = c.config ?? {};
  if (tipo === "selecao_unica" || tipo === "selecao_multipla") {
    const opcoes = (src.opcoes ?? []).map((o) => String(o).trim()).filter(Boolean);
    if (opcoes.length < 1) throw new FilterError(`A marcação "${rotulo}" precisa de ao menos uma opção`);
    config.opcoes = opcoes;
  }
  if (tipo === "nota" && src.escala?.length) {
    config.escala = src.escala.map((e) => String(e).trim()).filter(Boolean);
  }
  if (tipo === "nota" && !config.escala && typeof src.max === "number") {
    config.max = Math.max(2, Math.min(10, Math.round(src.max)));
  }
  if (tipo === "pontuacao") {
    config.min = typeof src.min === "number" ? Math.round(src.min) : 0;
    config.max = typeof src.max === "number" ? Math.round(src.max) : 100;
    if (config.max <= config.min) throw new FilterError(`A pontuação "${rotulo}" tem intervalo inválido`);
  }
  if (src.papel === "decisao") config.papel = "decisao";

  return {
    id: c.id ?? null,
    ordem: Number.isFinite(c.ordem) ? Math.round(c.ordem) : i,
    tipo,
    rotulo,
    ajuda: c.ajuda?.toString().trim() || null,
    obrigatorio: c.obrigatorio !== false,
    config,
  };
}

/**
 * Substitui os campos do formulário pelos informados, PRESERVANDO ids (upsert +
 * poda) para não invalidar respostas históricas guardadas por id de campo.
 * Roda em transação (delete + insert/update atômicos).
 */
export async function salvarCampos(formularioId: number, campos: CampoEntrada[]): Promise<void> {
  const norm = campos.map((c, i) => sanitizarCampo(c, i));
  const client = await appPool.connect();
  try {
    await client.query("begin");

    const { rows: existentes } = await client.query<{ id: number }>(
      `select id from formulario_campo where formulario_id = $1`,
      [formularioId]
    );
    const idsExistentes = new Set(existentes.map((r) => r.id));
    const idsMantidos = new Set<number>();

    for (const c of norm) {
      const config = JSON.stringify(c.config);
      if (c.id && idsExistentes.has(c.id)) {
        await client.query(
          `update formulario_campo
              set ordem = $2, tipo = $3, rotulo = $4, ajuda = $5, obrigatorio = $6, config = $7
            where id = $1 and formulario_id = $8`,
          [c.id, c.ordem, c.tipo, c.rotulo, c.ajuda, c.obrigatorio, config, formularioId]
        );
        idsMantidos.add(c.id);
      } else {
        await client.query(
          `insert into formulario_campo (formulario_id, ordem, tipo, rotulo, ajuda, obrigatorio, config)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [formularioId, c.ordem, c.tipo, c.rotulo, c.ajuda, c.obrigatorio, config]
        );
      }
    }

    const remover = [...idsExistentes].filter((id) => !idsMantidos.has(id));
    if (remover.length) {
      await client.query(`delete from formulario_campo where id = any($1::int[])`, [remover]);
    }
    // toca o atualizado_em do formulário (trigger é on update do formulario)
    await client.query(`update formulario set atualizado_em = now() where id = $1`, [formularioId]);

    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    if (e instanceof FilterError) throw e;
    throw erroAppDb(e);
  } finally {
    client.release();
  }
}

/** Duplica um formulário (nova cópia em rascunho, com os mesmos campos). */
export async function duplicarFormulario(id: number): Promise<Formulario> {
  const orig = await carregarFormulario(id);
  if (!orig) throw new FilterError("Formulário não encontrado");
  const novo = await criarFormulario(`${orig.nome} (cópia)`, orig.descricao);
  await salvarCampos(
    novo.id,
    orig.campos.map((c) => ({ ...c, id: null }))
  );
  return (await carregarFormulario(novo.id))!;
}

/** Exclui um formulário (e seus campos, por cascade). */
export async function excluirFormulario(id: number): Promise<void> {
  await appQuery(`delete from formulario where id = $1`, [id]);
}
