import "server-only";
import type { PoolClient } from "pg";
import { appQuery } from "./app-db";
import { registrarAuditoria } from "./auditoria";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional } from "./sessao";
import { cifrar, chaveDaCifra, contextoSegredo, decifrar, ErroCofre, idDaChave, lerChave } from "./ti-cofre";
import { comTransacao } from "./ti-equipamentos";
import type { ModoRevelar } from "./ti-acessos-regras";
import {
  rotuloSegredo,
  tipoAcesso,
  type AcaoEvento,
  type AcessoDetalhe,
  type AcessoLista,
  type DadosAcesso,
  type EquipamentoDoAcesso,
  type EventoAcesso,
  type ListaAcessos,
  type PedidoSegredos,
  type RegistroAcesso,
  type SegredoId,
} from "./ti-acessos-tipos";
import { nomeEquipamento } from "./ti-tipos";

/**
 * O cofre de Acessos da TI: o cadastro (`ti_acesso`), os segredos cifrados e o
 * registro de quem viu, copiou ou trocou cada um (`ti_acesso_evento`). Ver a
 * migration 042.
 *
 * A cifra só sai do banco por `revelarSegredo`, e só depois de o registro ter
 * sido gravado: se o registro falha, a senha não aparece.
 */

// ── A chave ──────────────────────────────────────────────────────────────────

/** A chave do ambiente; chave malformada vira o recado de como consertar. */
function chaveDoAmbiente(): Buffer | null {
  try {
    return lerChave(process.env.TI_COFRE_CHAVE);
  } catch (err) {
    if (err instanceof ErroCofre) throw new FilterError(err.message);
    throw err;
  }
}

function chaveObrigatoria(): Buffer {
  const chave = chaveDoAmbiente();
  if (!chave)
    throw new FilterError(
      "O cofre está sem chave. Configure a TI_COFRE_CHAVE no .env do servidor para guardar e abrir senhas."
    );
  return chave;
}

/** Se a tela pode guardar e abrir segredo. Chave malformada conta como sem chave. */
export function cofreTemChave(): boolean {
  try {
    return chaveDoAmbiente() != null;
  } catch {
    return false;
  }
}

// ── Linhas do banco ──────────────────────────────────────────────────────────

type SegredoGuardado = { c: string; em: string };
type Segredos = Partial<Record<SegredoId, SegredoGuardado>>;

/**
 * O acesso para a tela: dos segredos, só QUAIS existem e a data da última
 * troca, montados no próprio SQL. A cifra não sai do banco nem na listagem.
 */
const SELECT_ACESSO = `
  select a.id, a.tipo, a.nome, a.grupo, a.campos, a.observacoes,
         coalesce((select jsonb_object_agg(s.key, to_char((s.value->>'em')::timestamptz, 'YYYY-MM-DD"T"HH24:MI:SS'))
                     from jsonb_each(a.segredos) s), '{}'::jsonb) as segredos,
         coalesce((select array_agg(s.key order by s.key)
                     from jsonb_each(a.segredos) s
                    where $1::text is not null and split_part(s.value->>'c', '.', 2) <> $1::text), '{}') as outra_chave,
         e.id as e_id, e.tipo as e_tipo, e.marca as e_marca, e.modelo as e_modelo, e.patrimonio as e_patrimonio,
         to_char(a.atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em,
         to_char(a.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em
    from ti_acesso a
    left join ti_equipamento e on e.id = a.equipamento_id`;

interface LinhaAcesso {
  id: number;
  tipo: string;
  nome: string;
  grupo: string | null;
  campos: AcessoLista["campos"];
  observacoes: string | null;
  segredos: AcessoLista["segredos"];
  outra_chave: SegredoId[];
  e_id: number | null;
  e_tipo: string | null;
  e_marca: string | null;
  e_modelo: string | null;
  e_patrimonio: string | null;
  atualizado_em: string;
  criado_em: string;
}

function acessoDe(l: LinhaAcesso): AcessoLista {
  return {
    id: l.id,
    tipo: l.tipo,
    nome: l.nome,
    grupo: l.grupo,
    campos: l.campos ?? {},
    segredos: l.segredos ?? {},
    outraChave: l.outra_chave ?? [],
    observacoes: l.observacoes,
    equipamento:
      l.e_id != null
        ? {
            id: l.e_id,
            tipo: l.e_tipo!,
            nome: nomeEquipamento({ tipo: l.e_tipo!, marca: l.e_marca, modelo: l.e_modelo }),
            patrimonio: l.e_patrimonio,
          }
        : null,
    atualizadoEm: l.atualizado_em,
  };
}

/** O id da chave de agora, para marcar o que foi guardado com outra. */
const idAtual = () => {
  const chave = cofreTemChave() ? chaveDoAmbiente() : null;
  return chave ? idDaChave(chave) : null;
};

// ── Leitura ──────────────────────────────────────────────────────────────────

export async function listarAcessos(): Promise<AcessoLista[]> {
  const linhas = await appQuery<LinhaAcesso>(`${SELECT_ACESSO} order by a.grupo nulls last, lower(a.nome), a.id`, [idAtual()]);
  return linhas.map(acessoDe);
}

/** O que dá para vincular a um acesso: o inventário sem os baixados. */
async function equipamentosVinculaveis(): Promise<EquipamentoDoAcesso[]> {
  const linhas = await appQuery<{ id: number; tipo: string; marca: string | null; modelo: string | null; patrimonio: string | null }>(
    `select e.id, e.tipo, e.marca, e.modelo, e.patrimonio
       from ti_equipamento e
      where (select m.destino from ti_movimentacao m where m.equipamento_id = e.id order by m.data desc, m.id desc limit 1) <> 'baixa'
      order by e.patrimonio nulls last, e.id`
  );
  return linhas.map((e) => ({ id: e.id, tipo: e.tipo, nome: nomeEquipamento(e), patrimonio: e.patrimonio }));
}

/**
 * A lista do cofre. O vínculo com o inventário vem junto, e não da rota dos
 * Equipamentos: quem cuida do cofre não precisa, e não deveria precisar, da
 * permissão do inventário para escolher o roteador.
 */
export async function listaDoCofre(): Promise<ListaAcessos> {
  const [acessos, equipamentos] = await Promise.all([listarAcessos(), equipamentosVinculaveis()]);
  return { acessos, equipamentos, chave: cofreTemChave() };
}

const COLUNAS_EVENTO = `ev.id, ev.acao, coalesce(ev.campos, '{}') as campos, ev.usuario_nome,
  to_char(ev.em, 'YYYY-MM-DD"T"HH24:MI:SS') as em`;

interface LinhaEvento {
  id: string;
  acao: AcaoEvento;
  campos: string[];
  usuario_nome: string | null;
  em: string;
}

const eventoDe = (l: LinhaEvento): EventoAcesso => ({
  id: Number(l.id),
  acao: l.acao,
  campos: l.campos,
  usuario: l.usuario_nome,
  em: l.em,
});

export async function carregarAcesso(id: number): Promise<AcessoDetalhe | null> {
  const [l] = await appQuery<LinhaAcesso>(`${SELECT_ACESSO} where a.id = $2`, [idAtual(), id]);
  if (!l) return null;
  const eventos = await appQuery<LinhaEvento>(
    `select ${COLUNAS_EVENTO} from ti_acesso_evento ev where ev.acesso_id = $1 order by ev.em desc, ev.id desc limit 300`,
    [id]
  );
  return { ...acessoDe(l), criadoEm: l.criado_em, eventos: eventos.map(eventoDe) };
}

/** O registro do cofre inteiro, do mais recente para trás. */
export async function listarRegistro(limite = 3000): Promise<RegistroAcesso[]> {
  const linhas = await appQuery<LinhaEvento & { acesso_id: number | null; acesso_nome: string; acesso_tipo: string }>(
    `select ${COLUNAS_EVENTO}, ev.acesso_id, coalesce(a.nome, ev.acesso_nome) as acesso_nome,
            coalesce(a.tipo, ev.acesso_tipo) as acesso_tipo
       from ti_acesso_evento ev
       left join ti_acesso a on a.id = ev.acesso_id
      order by ev.em desc, ev.id desc
      limit $1`,
    [limite]
  );
  return linhas.map((l) => ({
    ...eventoDe(l),
    acesso: { id: l.acesso_id, nome: l.acesso_nome, tipo: l.acesso_tipo },
  }));
}

/** Os acessos de um equipamento, para a ficha dele. */
export async function acessosDoEquipamento(equipamentoId: number): Promise<{ id: number; nome: string; tipo: string }[]> {
  return appQuery(`select id, nome, tipo from ti_acesso where equipamento_id = $1 order by lower(nome)`, [equipamentoId]);
}

// ── Escrita ──────────────────────────────────────────────────────────────────

type Alvo = { id: number; nome: string; tipo: string };

async function registrarEvento(c: PoolClient | null, alvo: Alvo, acao: AcaoEvento, campos: string[] | null) {
  const sessao = await getSessaoOpcional();
  const sql = `insert into ti_acesso_evento (acesso_id, acesso_nome, acesso_tipo, acao, campos, usuario_id, usuario_nome)
               values ($1, $2, $3, $4, $5, $6, $7)`;
  const params = [alvo.id, alvo.nome, alvo.tipo, acao, campos, sessao?.usuario.id ?? null, sessao?.usuario.nome ?? null];
  if (c) await c.query(sql, params);
  else await appQuery(sql, params);
}

async function conferirEquipamento(c: PoolClient, id: number | null) {
  if (id == null) return;
  const { rowCount } = await c.query(`select 1 from ti_equipamento where id = $1`, [id]);
  if (!rowCount) throw new FilterError("O equipamento escolhido não existe mais. Recarregue a tela.");
}

/**
 * Aplica o pedido sobre os segredos guardados. Guarda só os que o tipo tem
 * (trocar VPN por Wi-Fi descarta a chave compartilhada), cifra o que chegou e
 * diz o que foi trocado e o que foi removido.
 *
 * Redigitar a mesma senha não conta como troca: a data da troca é o que o
 * Painel usa para cobrar senha antiga, e salvar de novo não a renova.
 */
function aplicarSegredos(
  atuais: Segredos,
  pedido: PedidoSegredos,
  tipo: string,
  acessoId: number,
  chave: Buffer | null
): { segredos: Segredos; trocados: SegredoId[]; removidos: SegredoId[] } {
  const doTipo = new Set(tipoAcesso(tipo).segredos);
  const segredos: Segredos = {};
  const removidos: SegredoId[] = [];
  for (const [id, s] of Object.entries(atuais) as [SegredoId, SegredoGuardado][]) {
    if (doTipo.has(id)) segredos[id] = s;
    else removidos.push(id);
  }
  const trocados: SegredoId[] = [];
  const agora = new Date().toISOString();
  for (const [id, valor] of Object.entries(pedido) as [SegredoId, string | null][]) {
    if (!doTipo.has(id)) continue;
    if (valor == null) {
      if (segredos[id]) {
        delete segredos[id];
        removidos.push(id);
      }
      continue;
    }
    const ctx = contextoSegredo(acessoId, id);
    const atual = segredos[id];
    if (atual && chave) {
      try {
        if (decifrar(atual.c, chave, ctx) === valor) continue;
      } catch {
        // Guardado com outra chave ou corrompido: o valor novo substitui.
      }
    }
    segredos[id] = { c: cifrar(valor, chave!, ctx), em: agora };
    trocados.push(id);
  }
  return { segredos, trocados, removidos };
}

const precisaChave = (pedido: PedidoSegredos) => Object.values(pedido).some((v) => v != null && v !== "");

export async function criarAcesso(dados: DadosAcesso, pedido: PedidoSegredos): Promise<number> {
  const chave = precisaChave(pedido) ? chaveObrigatoria() : null;
  const sessao = await getSessaoOpcional();
  const id = await comTransacao(async (c) => {
    await conferirEquipamento(c, dados.equipamentoId);
    const { rows } = await c.query(
      `insert into ti_acesso (tipo, nome, grupo, campos, equipamento_id, observacoes, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [dados.tipo, dados.nome, dados.grupo, JSON.stringify(dados.campos), dados.equipamentoId, dados.observacoes, sessao?.usuario.id ?? null]
    );
    const novo = rows[0].id as number;
    // A cifra leva o id do acesso no contexto, então só nasce depois do insert.
    const { segredos } = aplicarSegredos({}, pedido, dados.tipo, novo, chave);
    if (Object.keys(segredos).length)
      await c.query(`update ti_acesso set segredos = $2 where id = $1`, [novo, JSON.stringify(segredos)]);
    await registrarEvento(c, { id: novo, nome: dados.nome, tipo: dados.tipo }, "criado", null);
    return novo;
  });
  await registrarAuditoria({ acao: "ti.acesso.criar", modulo: "ti", alvo: dados.nome });
  return id;
}

/** Os campos de cadastro que mudaram, pelo nome que o registro usa. */
function camposEditados(
  antes: { tipo: string; nome: string; grupo: string | null; campos: Record<string, string>; equipamento_id: number | null; observacoes: string | null },
  depois: DadosAcesso
): string[] {
  const mudou: string[] = [];
  if (antes.tipo !== depois.tipo) mudou.push("tipo");
  if (antes.nome !== depois.nome) mudou.push("nome");
  if ((antes.grupo ?? null) !== depois.grupo) mudou.push("grupo");
  const chaves = new Set([...Object.keys(antes.campos ?? {}), ...Object.keys(depois.campos)]);
  for (const k of chaves) if ((antes.campos?.[k] ?? null) !== ((depois.campos as Record<string, string>)[k] ?? null)) mudou.push(k);
  if ((antes.equipamento_id ?? null) !== depois.equipamentoId) mudou.push("equipamento");
  if ((antes.observacoes ?? null) !== depois.observacoes) mudou.push("observacoes");
  return mudou;
}

export async function salvarAcesso(id: number, dados: DadosAcesso, pedido: PedidoSegredos): Promise<void> {
  const chave = precisaChave(pedido) ? chaveObrigatoria() : null;
  const resumo = await comTransacao(async (c) => {
    const { rows } = await c.query(
      `select tipo, nome, grupo, campos, segredos, equipamento_id, observacoes from ti_acesso where id = $1 for update`,
      [id]
    );
    if (!rows.length) throw new FilterError("Esse acesso não existe mais. Alguém pode ter apagado.");
    const antes = rows[0];
    await conferirEquipamento(c, dados.equipamentoId);
    const { segredos, trocados, removidos } = aplicarSegredos(antes.segredos ?? {}, pedido, dados.tipo, id, chave);
    const editados = camposEditados(antes, dados);
    await c.query(
      `update ti_acesso
          set tipo = $2, nome = $3, grupo = $4, campos = $5, segredos = $6, equipamento_id = $7,
              observacoes = $8, atualizado_em = now()
        where id = $1`,
      [id, dados.tipo, dados.nome, dados.grupo, JSON.stringify(dados.campos), JSON.stringify(segredos), dados.equipamentoId, dados.observacoes]
    );
    const alvo = { id, nome: dados.nome, tipo: dados.tipo };
    if (editados.length) await registrarEvento(c, alvo, "editado", editados);
    if (trocados.length) await registrarEvento(c, alvo, "segredo", trocados);
    if (removidos.length) await registrarEvento(c, alvo, "removido", removidos);
    return { editados, trocados, removidos };
  });
  await registrarAuditoria({
    acao: resumo.trocados.length ? "ti.acesso.trocar-segredo" : "ti.acesso.salvar",
    modulo: "ti",
    alvo: dados.nome,
    detalhe: { editados: resumo.editados, trocados: resumo.trocados, removidos: resumo.removidos },
  });
}

/** Apaga o acesso. O registro fica: quem viu a senha dele continua dito. */
export async function excluirAcesso(id: number): Promise<void> {
  const alvo = await comTransacao(async (c) => {
    const { rows } = await c.query(`select nome, tipo from ti_acesso where id = $1 for update`, [id]);
    if (!rows.length) throw new FilterError("Esse acesso não existe mais");
    const a = { id, nome: rows[0].nome as string, tipo: rows[0].tipo as string };
    await registrarEvento(c, a, "apagado", null);
    await c.query(`delete from ti_acesso where id = $1`, [id]);
    return a;
  });
  await registrarAuditoria({ acao: "ti.acesso.excluir", modulo: "ti", alvo: alvo.nome });
}

/**
 * Abre um segredo. O registro é gravado ANTES de devolver o valor, e não em
 * paralelo nem como melhor esforço: senha que aparece sem registro é o furo
 * que o cofre existe para fechar.
 */
export async function revelarSegredo(id: number, campo: SegredoId, modo: ModoRevelar): Promise<{ valor: string }> {
  const chave = chaveObrigatoria();
  const [l] = await appQuery<{ nome: string; tipo: string; s: SegredoGuardado | null }>(
    `select nome, tipo, segredos->$2 as s from ti_acesso where id = $1`,
    [id, campo]
  );
  if (!l) throw new FilterError("Esse acesso não existe mais. Alguém pode ter apagado.");
  if (!l.s) throw new FilterError(`Esse acesso não tem ${rotuloSegredo(campo).toLowerCase()} guardada`);
  if (chaveDaCifra(l.s.c) !== idDaChave(chave))
    throw new FilterError(
      `A ${rotuloSegredo(campo).toLowerCase()} foi guardada com outra chave do cofre e não abre com a de agora. Volte a chave antiga ao .env ou guarde de novo.`
    );
  let valor: string;
  try {
    valor = decifrar(l.s.c, chave, contextoSegredo(id, campo));
  } catch (err) {
    if (err instanceof ErroCofre) throw new FilterError(err.message);
    throw err;
  }
  await registrarEvento(null, { id, nome: l.nome, tipo: l.tipo }, modo === "copiar" ? "copiado" : "revelado", [campo]);
  await registrarAuditoria({
    acao: modo === "copiar" ? "ti.acesso.copiar" : "ti.acesso.revelar",
    modulo: "ti",
    alvo: `${l.nome} · ${rotuloSegredo(campo)}`,
  });
  return { valor };
}
