import "server-only";
import type { PoolClient } from "pg";
import { appPool, appQuery, erroAppDb } from "./app-db";
import { registrarAuditoria } from "./auditoria";
import { FilterError } from "./fiscal-filters";
import { listarDiretorio } from "./rh-diretorio";
import { getSessaoOpcional } from "./sessao";
import {
  conferirMovimentacao,
  hojeEscritorio,
  posseDoPedido,
  RecusaTi,
} from "./ti-regras";
import {
  chavePessoa,
  nomeEquipamento,
  textoPosse,
  type DadosEquipamento,
  type DadosPessoaExterna,
  type EquipamentoDetalhe,
  type EquipamentoLista,
  type Movimentacao,
  type MovimentacaoLista,
  type PedidoMovimentacao,
  type PessoaExterna,
  type PessoaTi,
  type Posse,
} from "./ti-tipos";

/**
 * Equipamentos da TI: o cadastro (`ti_equipamento`) e o histórico de posse
 * (`ti_movimentacao`). Com quem o equipamento está é SEMPRE a última
 * movimentação, lida na hora; ver a migration 040.
 */

// ── Linhas do banco ──────────────────────────────────────────────────────────

interface LinhaPosse {
  destino: Posse["destino"];
  pessoa_empresa: number | null;
  pessoa_contrato: number | null;
  pessoa_nome: string | null;
  pessoa_setor: string | null;
  externo_id: number | null;
  externo_vinculo: string | null;
  local: string | null;
  motivo: string | null;
}

function posseDe(l: LinhaPosse): Posse {
  switch (l.destino) {
    case "pessoa":
      return {
        destino: "pessoa",
        empresa: l.pessoa_empresa!,
        contrato: l.pessoa_contrato!,
        nome: l.pessoa_nome!,
        setor: l.pessoa_setor,
      };
    case "externo":
      return { destino: "externo", id: l.externo_id!, nome: l.pessoa_nome!, vinculo: l.externo_vinculo };
    case "local":
      return { destino: "local", local: l.local! };
    case "estoque":
      return { destino: "estoque" };
    case "manutencao":
      return { destino: "manutencao", local: l.local };
    case "baixa":
      return { destino: "baixa", motivo: l.motivo as Extract<Posse, { destino: "baixa" }>["motivo"] };
  }
}

/** A posse anterior vem por `lag`, com o prefixo `ant_`. */
function anteriorDe(l: Record<string, unknown>): Posse | null {
  if (!l.ant_destino) return null;
  return posseDe({
    destino: l.ant_destino as Posse["destino"],
    pessoa_empresa: l.ant_pessoa_empresa as number | null,
    pessoa_contrato: l.ant_pessoa_contrato as number | null,
    pessoa_nome: l.ant_pessoa_nome as string | null,
    pessoa_setor: l.ant_pessoa_setor as string | null,
    externo_id: l.ant_externo_id as number | null,
    externo_vinculo: l.ant_externo_vinculo as string | null,
    local: l.ant_local as string | null,
    motivo: l.ant_motivo as string | null,
  });
}

const COLUNAS_EQUIPAMENTO = `
  e.id, e.tipo, e.patrimonio, e.marca, e.modelo, e.numero_serie, e.especificacoes,
  to_char(e.data_compra, 'YYYY-MM-DD') as data_compra, e.valor_compra, e.fornecedor,
  e.nota_fiscal, to_char(e.garantia_ate, 'YYYY-MM-DD') as garantia_ate, e.observacoes`;

/** A última movimentação de cada equipamento e quantas ele tem. */
const JUNCAO_POSSE = `
  join lateral (
    select m.destino, m.pessoa_empresa, m.pessoa_contrato, m.pessoa_nome, m.pessoa_setor,
           m.externo_id, m.externo_vinculo, m.local, m.motivo, to_char(m.data, 'YYYY-MM-DD') as desde
      from ti_movimentacao m
     where m.equipamento_id = e.id
     order by m.data desc, m.id desc
     limit 1
  ) u on true
  cross join lateral (select count(*)::int as movimentacoes from ti_movimentacao m where m.equipamento_id = e.id) c`;

interface LinhaEquipamento extends LinhaPosse {
  id: number;
  tipo: string;
  patrimonio: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  especificacoes: Record<string, string>;
  data_compra: string | null;
  valor_compra: number | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
  garantia_ate: string | null;
  observacoes: string | null;
  desde: string;
  movimentacoes: number;
}

function equipamentoDe(l: LinhaEquipamento): EquipamentoLista {
  return {
    id: l.id,
    tipo: l.tipo,
    patrimonio: l.patrimonio,
    marca: l.marca,
    modelo: l.modelo,
    numeroSerie: l.numero_serie,
    especificacoes: l.especificacoes ?? {},
    dataCompra: l.data_compra,
    valorCompra: l.valor_compra,
    fornecedor: l.fornecedor,
    notaFiscal: l.nota_fiscal,
    garantiaAte: l.garantia_ate,
    observacoes: l.observacoes,
    posse: posseDe(l),
    desde: l.desde,
    movimentacoes: l.movimentacoes,
  };
}

const COLUNAS_MOVIMENTACAO = `
  m.id, m.equipamento_id, m.destino, m.pessoa_empresa, m.pessoa_contrato, m.pessoa_nome,
  m.pessoa_setor, m.externo_id, m.externo_vinculo, m.local, m.motivo,
  to_char(m.data, 'YYYY-MM-DD') as data, m.observacao,
  m.registrado_por_nome, to_char(m.registrado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as registrado_em,
  lag(m.destino) over w as ant_destino,
  lag(m.pessoa_empresa) over w as ant_pessoa_empresa,
  lag(m.pessoa_contrato) over w as ant_pessoa_contrato,
  lag(m.pessoa_nome) over w as ant_pessoa_nome,
  lag(m.pessoa_setor) over w as ant_pessoa_setor,
  lag(m.externo_id) over w as ant_externo_id,
  lag(m.externo_vinculo) over w as ant_externo_vinculo,
  lag(m.local) over w as ant_local,
  lag(m.motivo) over w as ant_motivo`;

const JANELA = `window w as (partition by m.equipamento_id order by m.data, m.id)`;

function movimentacaoDe(l: LinhaPosse & Record<string, unknown>): Movimentacao {
  return {
    id: l.id as number,
    equipamentoId: l.equipamento_id as number,
    posse: posseDe(l),
    anterior: anteriorDe(l),
    data: l.data as string,
    observacao: (l.observacao as string | null) ?? null,
    registradoPor: (l.registrado_por_nome as string | null) ?? null,
    registradoEm: l.registrado_em as string,
  };
}

// ── Leitura ──────────────────────────────────────────────────────────────────

export async function listarEquipamentos(): Promise<EquipamentoLista[]> {
  const linhas = await appQuery<LinhaEquipamento>(
    `select ${COLUNAS_EQUIPAMENTO}, u.*, c.movimentacoes
       from ti_equipamento e ${JUNCAO_POSSE}
      order by e.patrimonio nulls last, e.id`
  );
  return linhas.map(equipamentoDe);
}

export async function carregarEquipamento(id: number): Promise<EquipamentoDetalhe | null> {
  const [l] = await appQuery<
    LinhaEquipamento & { criado_em: string; atualizado_em: string }
  >(
    `select ${COLUNAS_EQUIPAMENTO}, u.*, c.movimentacoes,
            to_char(e.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as criado_em,
            to_char(e.atualizado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as atualizado_em
       from ti_equipamento e ${JUNCAO_POSSE}
      where e.id = $1`,
    [id]
  );
  if (!l) return null;
  const historico = await appQuery<LinhaPosse & Record<string, unknown>>(
    `select ${COLUNAS_MOVIMENTACAO}
       from ti_movimentacao m
      where m.equipamento_id = $1
     ${JANELA}
      order by m.data desc, m.id desc`,
    [id]
  );
  return {
    ...equipamentoDe(l),
    historico: historico.map(movimentacaoDe),
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

/** Todas as movimentações, a mais recente primeiro, cada uma com o equipamento. */
export async function listarMovimentacoes(): Promise<MovimentacaoLista[]> {
  const linhas = await appQuery<LinhaPosse & Record<string, unknown>>(
    `select ${COLUNAS_MOVIMENTACAO},
            e.tipo as e_tipo, e.patrimonio as e_patrimonio, e.marca as e_marca,
            e.modelo as e_modelo, e.numero_serie as e_numero_serie
       from ti_movimentacao m
       join ti_equipamento e on e.id = m.equipamento_id
     ${JANELA}
      order by m.data desc, m.id desc`
  );
  return linhas.map((l) => ({
    ...movimentacaoDe(l),
    equipamento: {
      tipo: l.e_tipo as string,
      patrimonio: l.e_patrimonio as string | null,
      marca: l.e_marca as string | null,
      modelo: l.e_modelo as string | null,
      numeroSerie: l.e_numero_serie as string | null,
    },
  }));
}

/**
 * Quem pode receber equipamento: o Diretório do RH de hoje, só com o que a TI
 * precisa ler. Rota própria em vez da do RH porque quem é da TI não tem, e não
 * deveria ter, a ficha do RH.
 */
export async function pessoasTi(): Promise<PessoaTi[]> {
  const diretorio = await listarDiretorio();
  return diretorio.map((f) => ({
    empresa: f.codigoempresa,
    contrato: f.contrato,
    nome: f.nome,
    setor: f.setor,
    cargo: f.cargo,
  }));
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/** Lê o corpo pelas regras; a recusa delas vira o 400 com o recado como está. */
export function conferido<T>(ler: () => T): T {
  try {
    return ler();
  } catch (err) {
    if (err instanceof RecusaTi) throw new FilterError(err.message);
    throw err;
  }
}

async function comTransacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await appPool.connect();
  } catch (err) {
    throw erroAppDb(err);
  }
  try {
    await client.query("begin");
    const r = await fn(client);
    await client.query("commit");
    return r;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    if (err instanceof RecusaTi) throw new FilterError(err.message);
    if (err instanceof FilterError) throw err;
    // Chave duplicada passa crua: quem chamou sabe qual recado dar.
    if (duplicado(err)) throw err;
    throw erroAppDb(err);
  } finally {
    client.release();
  }
}

const duplicado = (err: unknown) => (err as { code?: string })?.code === "23505";

const patrimonioEmUso = (p: string | null) => new FilterError(`Já existe um equipamento com o patrimônio ${p}`);

function valoresCadastro(d: DadosEquipamento) {
  return [
    d.tipo,
    d.patrimonio,
    d.marca,
    d.modelo,
    d.numeroSerie,
    JSON.stringify(d.especificacoes),
    d.dataCompra,
    d.valorCompra,
    d.fornecedor,
    d.notaFiscal,
    d.garantiaAte,
    d.observacoes,
  ];
}

/** A pessoa do pedido, procurada no Diretório de hoje. */
async function pessoaDoPedido(pedido: Omit<PedidoMovimentacao, "equipamentos">): Promise<PessoaTi | null> {
  if (pedido.destino !== "pessoa" || !pedido.pessoa) return null;
  const alvo = chavePessoa(pedido.pessoa.empresa, pedido.pessoa.contrato);
  return (await pessoasTi()).find((p) => chavePessoa(p.empresa, p.contrato) === alvo) ?? null;
}

/** Quem é de fora, no cadastro da TI. */
async function externoDoPedido(pedido: Omit<PedidoMovimentacao, "equipamentos">): Promise<PessoaExterna | null> {
  if (pedido.destino !== "externo" || !pedido.externo) return null;
  const [x] = await appQuery<PessoaExterna>(`${SELECT_EXTERNO} where id = $1`, [pedido.externo.id]);
  return x ?? null;
}

/** Para onde o pedido leva, com a pessoa procurada no cadastro dela. */
async function posseDoPedidoNoCadastro(pedido: Omit<PedidoMovimentacao, "equipamentos">): Promise<Posse> {
  const [pessoa, externo] = await Promise.all([pessoaDoPedido(pedido), externoDoPedido(pedido)]);
  return conferido(() => posseDoPedido({ ...pedido, equipamentos: [] }, pessoa, externo));
}

async function inserirMovimentacao(c: PoolClient, equipamentoId: number, posse: Posse, data: string, observacao: string | null) {
  const sessao = await getSessaoOpcional();
  const p = posse.destino === "pessoa" ? posse : null;
  const x = posse.destino === "externo" ? posse : null;
  await c.query(
    `insert into ti_movimentacao
       (equipamento_id, destino, pessoa_empresa, pessoa_contrato, pessoa_nome, pessoa_setor,
        externo_id, externo_vinculo, local, motivo, data, observacao, registrado_por, registrado_por_nome)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      equipamentoId,
      posse.destino,
      p?.empresa ?? null,
      p?.contrato ?? null,
      p?.nome ?? x?.nome ?? null,
      p?.setor ?? null,
      x?.id ?? null,
      x?.vinculo ?? null,
      posse.destino === "local" || posse.destino === "manutencao" ? posse.local : null,
      posse.destino === "baixa" ? posse.motivo : null,
      data,
      observacao,
      sessao?.usuario.id ?? null,
      sessao?.usuario.nome ?? null,
    ]
  );
}

/**
 * Cadastra o equipamento e a primeira movimentação: onde ele está no dia do
 * cadastro. Quem registra o inventário que já existe cadastra o notebook com
 * quem ele está; sem isso, o histórico começaria com uma entrega que não houve.
 */
export async function criarEquipamento(
  dados: DadosEquipamento,
  inicio: Omit<PedidoMovimentacao, "equipamentos">
): Promise<number> {
  const posse = await posseDoPedidoNoCadastro(inicio);
  const hoje = hojeEscritorio();
  try {
    const id = await comTransacao(async (c) => {
      if (posse.destino === "baixa") throw new RecusaTi("Equipamento novo não nasce baixado");
      if (inicio.data > hoje) throw new RecusaTi("A data não pode ser depois de hoje");
      const sessao = await getSessaoOpcional();
      const { rows } = await c.query(
        `insert into ti_equipamento
           (tipo, patrimonio, marca, modelo, numero_serie, especificacoes, data_compra, valor_compra,
            fornecedor, nota_fiscal, garantia_ate, observacoes, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         returning id`,
        [...valoresCadastro(dados), sessao?.usuario.id ?? null]
      );
      const novo = rows[0].id as number;
      await inserirMovimentacao(c, novo, posse, inicio.data, inicio.observacao ?? null);
      return novo;
    });
    await registrarAuditoria({ acao: "ti.equipamento.criar", modulo: "ti", alvo: rotuloAuditoria(dados) });
    return id;
  } catch (err) {
    // Duas pessoas cadastrando a mesma etiqueta ao mesmo tempo: quem decide é o índice único.
    if (duplicado(err)) throw patrimonioEmUso(dados.patrimonio);
    throw err;
  }
}

const rotuloAuditoria = (d: Pick<DadosEquipamento, "tipo" | "marca" | "modelo" | "patrimonio">) =>
  d.patrimonio ? `${d.patrimonio} · ${nomeEquipamento(d)}` : nomeEquipamento(d);

export async function salvarEquipamento(id: number, dados: DadosEquipamento): Promise<void> {
  try {
    await comTransacao(async (c) => {
      const { rowCount } = await c.query(
        `update ti_equipamento
            set tipo = $2, patrimonio = $3, marca = $4, modelo = $5, numero_serie = $6,
                especificacoes = $7, data_compra = $8, valor_compra = $9, fornecedor = $10,
                nota_fiscal = $11, garantia_ate = $12, observacoes = $13, atualizado_em = now()
          where id = $1`,
        [id, ...valoresCadastro(dados)]
      );
      if (!rowCount) throw new FilterError("O equipamento não existe mais. Alguém pode ter apagado.");
    });
  } catch (err) {
    if (duplicado(err)) throw patrimonioEmUso(dados.patrimonio);
    throw err;
  }
  await registrarAuditoria({ acao: "ti.equipamento.salvar", modulo: "ti", alvo: rotuloAuditoria(dados) });
}

/**
 * Apaga o cadastro feito por engano. Só enquanto o equipamento tem apenas a
 * movimentação do cadastro: depois disso ele já passou por alguém, e o que
 * encerra a vida dele é a baixa, que guarda o histórico.
 */
export async function excluirEquipamento(id: number): Promise<void> {
  const alvo = await comTransacao(async (c) => {
    const { rows } = await c.query(
      `select e.tipo, e.marca, e.modelo, e.patrimonio,
              (select count(*)::int from ti_movimentacao m where m.equipamento_id = e.id) as n
         from ti_equipamento e where e.id = $1 for update`,
      [id]
    );
    if (!rows.length) throw new FilterError("O equipamento não existe mais");
    if (rows[0].n > 1)
      throw new FilterError("Este equipamento já passou por alguém e não pode ser apagado. Para tirá-lo do inventário, dê baixa.");
    await c.query(`delete from ti_equipamento where id = $1`, [id]);
    return rows[0] as Pick<DadosEquipamento, "tipo" | "marca" | "modelo" | "patrimonio">;
  });
  await registrarAuditoria({ acao: "ti.equipamento.excluir", modulo: "ti", alvo: rotuloAuditoria(alvo) });
}

/**
 * Move um ou mais equipamentos para o mesmo destino, numa transação: todos ou
 * nenhum. As linhas dos equipamentos ficam travadas até o fim, então duas
 * pessoas entregando o mesmo notebook ao mesmo tempo não criam duas "últimas"
 * movimentações.
 */
export async function movimentar(pedido: PedidoMovimentacao): Promise<{ movidos: number }> {
  const destino = await posseDoPedidoNoCadastro(pedido);

  const nomes = await comTransacao(async (c) => {
    await c.query(`select id from ti_equipamento where id = any($1::int[]) for update`, [pedido.equipamentos]);
    const { rows } = await c.query<LinhaEquipamento>(
      `select ${COLUNAS_EQUIPAMENTO}, u.*, c.movimentacoes
         from ti_equipamento e ${JUNCAO_POSSE}
        where e.id = any($1::int[])`,
      [pedido.equipamentos]
    );
    const atuais = rows.map(equipamentoDe);
    conferirMovimentacao(pedido, destino, atuais, hojeEscritorio());
    for (const e of atuais) await inserirMovimentacao(c, e.id, destino, pedido.data, pedido.observacao ?? null);
    return atuais.map(rotuloAuditoria);
  });

  await registrarAuditoria({
    acao: "ti.equipamento.movimentar",
    modulo: "ti",
    alvo: `${nomes.length === 1 ? nomes[0] : `${nomes.length} equipamentos`} → ${textoPosse(destino)}`,
    detalhe: nomes.length > 1 ? { equipamentos: nomes } : undefined,
  });
  return { movidos: nomes.length };
}

// ── De fora do Diretório ─────────────────────────────────────────────────────

const SELECT_EXTERNO = `select id, nome, vinculo, documento, contato, observacao, ativo from ti_pessoa_externa`;

/** Todo o cadastro de fora do Diretório, os ativos primeiro. */
export async function listarExternos(): Promise<PessoaExterna[]> {
  return appQuery<PessoaExterna>(`${SELECT_EXTERNO} order by ativo desc, nome`);
}

export async function criarExterno(dados: DadosPessoaExterna): Promise<PessoaExterna> {
  const sessao = await getSessaoOpcional();
  const [x] = await appQuery<PessoaExterna>(
    `insert into ti_pessoa_externa (nome, vinculo, documento, contato, observacao, criado_por)
     values ($1, $2, $3, $4, $5, $6)
     returning id, nome, vinculo, documento, contato, observacao, ativo`,
    [dados.nome, dados.vinculo, dados.documento, dados.contato, dados.observacao, sessao?.usuario.id ?? null]
  );
  await registrarAuditoria({ acao: "ti.externo.criar", modulo: "ti", alvo: rotuloExterno(dados) });
  return x;
}

const rotuloExterno = (d: Pick<DadosPessoaExterna, "nome" | "vinculo">) => (d.vinculo ? `${d.nome} · ${d.vinculo}` : d.nome);

/**
 * Corrige o cadastro ou encerra o vínculo. Encerrar não mexe no que está com a
 * pessoa: o equipamento continua com ela até alguém registrar a devolução, e
 * aparece como a recolher.
 */
export async function salvarExterno(id: number, dados: DadosPessoaExterna, ativo: boolean): Promise<void> {
  const r = await appQuery<{ id: number }>(
    `update ti_pessoa_externa
        set nome = $2, vinculo = $3, documento = $4, contato = $5, observacao = $6, ativo = $7, atualizado_em = now()
      where id = $1
      returning id`,
    [id, dados.nome, dados.vinculo, dados.documento, dados.contato, dados.observacao, ativo]
  );
  if (!r.length) throw new FilterError("Esse cadastro não existe mais");
  await registrarAuditoria({
    acao: ativo ? "ti.externo.salvar" : "ti.externo.encerrar",
    modulo: "ti",
    alvo: rotuloExterno(dados),
  });
}

/** Apaga o cadastro que nunca recebeu nada. Depois de receber, ele fica no histórico e se encerra. */
export async function excluirExterno(id: number): Promise<void> {
  const [uso] = await appQuery<{ n: number; nome: string | null; vinculo: string | null }>(
    `select (select count(*)::int from ti_movimentacao where externo_id = $1) as n, x.nome, x.vinculo
       from ti_pessoa_externa x where x.id = $1`,
    [id]
  );
  if (!uso) throw new FilterError("Esse cadastro não existe mais");
  if (uso.n > 0)
    throw new FilterError("Essa pessoa já recebeu equipamento e fica no histórico. Para tirá-la da lista, encerre o cadastro.");
  await appQuery(`delete from ti_pessoa_externa where id = $1`, [id]);
  await registrarAuditoria({ acao: "ti.externo.excluir", modulo: "ti", alvo: rotuloExterno({ nome: uso.nome ?? "", vinculo: uso.vinculo }) });
}
