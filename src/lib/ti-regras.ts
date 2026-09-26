import {
  CAMPOS_SPEC,
  ehTipoEquipamento,
  MOTIVOS_BAIXA,
  mesmaPosse,
  nomeEquipamento,
  textoPosse,
  tipoEquipamento,
  type CampoSpec,
  type DadosEquipamento,
  type Destino,
  type EquipamentoLista,
  type Especificacoes,
  type MotivoBaixa,
  type DadosPessoaExterna,
  type PedidoMovimentacao,
  type PessoaExterna,
  type PessoaTi,
  type Posse,
} from "./ti-tipos";

/**
 * As regras dos Equipamentos da TI, sem banco nem sessão: ler o que a tela
 * manda e conferir uma movimentação contra o estado de cada equipamento. Moram
 * fora da rota para caber num teste ([[ti-regras.test]]).
 */

/** Pedido recusado: a rota devolve a mensagem como está. */
export class RecusaTi extends Error {}

const recusar = (msg: string): never => {
  throw new RecusaTi(msg);
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TEXTO_MAX = 120;
const OBS_MAX = 1000;

/** Hoje no fuso do escritório: o container está em UTC, e depois das 21h o dia já seria amanhã. */
export function hojeEscritorio(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function dataValida(v: unknown): v is string {
  if (typeof v !== "string" || !DATA.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Texto opcional: aparado, espaço colapsado, vazio vira null. */
export function texto(v: unknown, rotulo: string, max = TEXTO_MAX): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return recusar(`${rotulo} inválido`);
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length > max) return recusar(`${rotulo} passa de ${max} letras`);
  return t || null;
}

const dataBRde = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ── Cadastro ─────────────────────────────────────────────────────────────────

/**
 * O cadastro que a tela manda, conferido. Especificação que o tipo não pede é
 * descartada: trocar notebook por mouse no formulário não pode deixar o
 * processador gravado num mouse.
 */
export function lerDadosEquipamento(corpo: unknown): DadosEquipamento {
  const b = (corpo ?? {}) as Record<string, unknown>;
  if (!ehTipoEquipamento(b.tipo)) recusar("Escolha o tipo do equipamento");
  const tipo = b.tipo as string;

  const especificacoes: Especificacoes = {};
  const specs = (b.especificacoes ?? {}) as Record<string, unknown>;
  if (typeof specs !== "object" || Array.isArray(specs)) recusar("Especificações inválidas");
  for (const campo of tipoEquipamento(tipo).specs) {
    const v = texto(specs[campo], CAMPOS_SPEC[campo as CampoSpec].rotulo);
    if (v) especificacoes[campo] = v;
  }

  const dataCompra = b.dataCompra == null || b.dataCompra === "" ? null : b.dataCompra;
  if (dataCompra !== null && !dataValida(dataCompra)) recusar("Data da compra inválida");
  const garantiaAte = b.garantiaAte == null || b.garantiaAte === "" ? null : b.garantiaAte;
  if (garantiaAte !== null && !dataValida(garantiaAte)) recusar("Data da garantia inválida");

  let valorCompra: number | null = null;
  if (b.valorCompra != null && b.valorCompra !== "") {
    const n = typeof b.valorCompra === "number" ? b.valorCompra : Number(b.valorCompra);
    if (!Number.isFinite(n) || n < 0 || n >= 1e10) recusar("Valor da compra inválido");
    valorCompra = Math.round(n * 100) / 100;
  }

  const patrimonio = texto(b.patrimonio, "Patrimônio", 40);

  return {
    tipo,
    patrimonio: patrimonio ? patrimonio.toUpperCase() : null,
    marca: texto(b.marca, "Marca"),
    modelo: texto(b.modelo, "Modelo"),
    numeroSerie: texto(b.numeroSerie, "Número de série"),
    especificacoes,
    dataCompra: dataCompra as string | null,
    valorCompra,
    fornecedor: texto(b.fornecedor, "Fornecedor"),
    notaFiscal: texto(b.notaFiscal, "Nota fiscal", 60),
    garantiaAte: garantiaAte as string | null,
    observacoes: texto(b.observacoes, "Observações", OBS_MAX),
  };
}

// ── De fora do Diretório ─────────────────────────────────────────────────────

/** O cadastro de alguém de fora do Diretório, conferido. Só o nome é obrigatório. */
export function lerDadosExterno(corpo: unknown): DadosPessoaExterna {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(b.nome, "Nome");
  if (!nome) return recusar("Informe o nome");
  return {
    nome,
    vinculo: texto(b.vinculo, "Empresa ou vínculo"),
    documento: texto(b.documento, "Documento", 30),
    contato: texto(b.contato, "Contato"),
    observacao: texto(b.observacao, "Observação", OBS_MAX),
  };
}

// ── Movimentação ─────────────────────────────────────────────────────────────

const DESTINOS: Destino[] = ["pessoa", "externo", "local", "estoque", "manutencao", "baixa"];

export function lerPedido(corpo: unknown): PedidoMovimentacao {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const ids = b.equipamentos;
  if (!Array.isArray(ids) || !ids.length || !ids.every((i) => Number.isInteger(i) && i > 0))
    recusar("Escolha ao menos um equipamento");
  if (!DESTINOS.includes(b.destino as Destino)) recusar("Diga para onde o equipamento vai");
  if (!dataValida(b.data)) recusar("Data inválida");

  const p = b.pessoa as Record<string, unknown> | null | undefined;
  const pessoa =
    p && Number.isInteger(p.empresa) && Number.isInteger(p.contrato)
      ? { empresa: p.empresa as number, contrato: p.contrato as number }
      : null;
  const x = b.externo as Record<string, unknown> | null | undefined;
  const externo = x && Number.isInteger(x.id) && (x.id as number) > 0 ? { id: x.id as number } : null;
  const motivo = b.motivo == null ? null : (b.motivo as MotivoBaixa);
  if (motivo !== null && !MOTIVOS_BAIXA.some((m) => m.valor === motivo)) recusar("Motivo da baixa inválido");

  return {
    equipamentos: [...new Set(ids as number[])],
    destino: b.destino as Destino,
    pessoa,
    externo,
    local: texto(b.local, b.destino === "manutencao" ? "Assistência" : "Local", 80),
    motivo,
    data: b.data as string,
    observacao: texto(b.observacao, "Observação", OBS_MAX),
  };
}

/** O destino inicial do cadastro: o mesmo pedido, sem equipamentos (ele ainda não existe). */
export function lerInicio(corpo: unknown): Omit<PedidoMovimentacao, "equipamentos"> {
  const p = lerPedido({ ...((corpo ?? {}) as object), equipamentos: [1] });
  return {
    destino: p.destino,
    pessoa: p.pessoa,
    externo: p.externo,
    local: p.local,
    motivo: p.motivo,
    data: p.data,
    observacao: p.observacao,
  };
}

/**
 * Para onde o pedido leva, com o que cada destino exige. A pessoa vem do
 * Diretório de hoje: quem saiu da empresa não recebe equipamento. Quem é de
 * fora vem do cadastro da TI, e o cadastro encerrado também não recebe.
 */
export function posseDoPedido(
  pedido: PedidoMovimentacao,
  pessoa: PessoaTi | null,
  externo: PessoaExterna | null = null
): Posse {
  switch (pedido.destino) {
    case "pessoa":
      if (!pedido.pessoa) return recusar("Escolha quem recebe");
      if (!pessoa) return recusar("Essa pessoa não está no Diretório do RH. Quem saiu da empresa não recebe equipamento.");
      return { destino: "pessoa", empresa: pessoa.empresa, contrato: pessoa.contrato, nome: pessoa.nome, setor: pessoa.setor };
    case "externo":
      if (!pedido.externo) return recusar("Escolha quem recebe");
      if (!externo) return recusar("Esse cadastro de fora do Diretório não existe mais. Recarregue a tela.");
      if (!externo.ativo) return recusar(`${externo.nome} está com o cadastro encerrado e não recebe equipamento`);
      return { destino: "externo", id: externo.id, nome: externo.nome, vinculo: externo.vinculo };
    case "local":
      if (!pedido.local) return recusar("Diga onde o equipamento fica");
      return { destino: "local", local: pedido.local };
    case "estoque":
      return { destino: "estoque" };
    case "manutencao":
      return { destino: "manutencao", local: pedido.local ?? null };
    case "baixa":
      if (!pedido.motivo) return recusar("Diga o motivo da baixa");
      return { destino: "baixa", motivo: pedido.motivo };
  }
}

type Atual = Pick<EquipamentoLista, "id" | "tipo" | "marca" | "modelo" | "patrimonio" | "posse" | "desde">;

const identificacao = (e: Atual) => (e.patrimonio ? `${e.patrimonio} (${nomeEquipamento(e)})` : nomeEquipamento(e));

/**
 * Confere a movimentação contra o estado de cada equipamento. Recusa o pedido
 * inteiro, dizendo quais, em vez de mover metade: numa entrega de kit, metade
 * entregue é pior que nenhuma.
 *
 * - A data não passa de hoje nem fica antes da última movimentação do
 *   equipamento: o "de quem" de cada linha é a linha anterior, e uma entrega
 *   datada no meio do histórico reescreveria com quem ele estava.
 * - Mandar para onde já está não é movimentação.
 * - Equipamento baixado só volta pelo estoque.
 */
export function conferirMovimentacao(pedido: PedidoMovimentacao, destino: Posse, atuais: Atual[], hoje: string): void {
  if (pedido.data > hoje) recusar("A data não pode ser depois de hoje");
  const faltam = pedido.equipamentos.filter((id) => !atuais.some((a) => a.id === id));
  if (faltam.length) recusar("Um dos equipamentos não existe mais. Recarregue a tela.");

  const problemas: string[] = [];
  for (const e of atuais) {
    if (pedido.data < e.desde) {
      problemas.push(`${identificacao(e)} tem movimentação em ${dataBRde(e.desde)}, e a nova precisa ser desse dia em diante`);
    } else if (mesmaPosse(e.posse, destino)) {
      problemas.push(`${identificacao(e)} já está em ${textoPosse(e.posse)}`);
    } else if (e.posse.destino === "baixa" && destino.destino !== "estoque") {
      problemas.push(`${identificacao(e)} teve baixa e só volta pelo estoque`);
    }
  }
  if (problemas.length === 1) recusar(problemas[0]);
  if (problemas.length > 1) recusar(`${problemas.length} equipamentos não podem ir: ${problemas.join("; ")}`);
}
