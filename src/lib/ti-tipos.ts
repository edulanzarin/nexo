/**
 * O vocabulário dos Equipamentos da TI, sem banco: vale no servidor e na tela.
 *
 * O catálogo de tipos é DADO: cada tipo diz o ícone e quais especificações
 * pede, e o formulário se monta a partir dele. Tipo novo é uma linha aqui, sem
 * migration e sem tela nova.
 */

export type CampoSpec =
  | "processador"
  | "memoria"
  | "armazenamento"
  | "sistema"
  | "hostname"
  | "tela"
  | "resolucao"
  | "conexao"
  | "conexoes"
  | "layout"
  | "imei"
  | "linha";

export const CAMPOS_SPEC: Record<CampoSpec, { rotulo: string; exemplo: string }> = {
  processador: { rotulo: "Processador", exemplo: "Intel Core i5-1235U" },
  memoria: { rotulo: "Memória", exemplo: "16 GB" },
  armazenamento: { rotulo: "Armazenamento", exemplo: "SSD 512 GB" },
  sistema: { rotulo: "Sistema", exemplo: "Windows 11 Pro" },
  hostname: { rotulo: "Nome na rede", exemplo: "NVC-NB-012" },
  tela: { rotulo: "Tela", exemplo: '24" Full HD' },
  resolucao: { rotulo: "Resolução", exemplo: "1920 x 1080" },
  conexao: { rotulo: "Conexão", exemplo: "USB, sem fio ou Bluetooth" },
  conexoes: { rotulo: "Entradas", exemplo: "HDMI, DisplayPort, USB-C" },
  layout: { rotulo: "Layout", exemplo: "ABNT2" },
  imei: { rotulo: "IMEI", exemplo: "35 209900 176148 1" },
  linha: { rotulo: "Linha", exemplo: "(47) 99999-0000" },
};

export interface TipoEquipamento {
  id: string;
  rotulo: string;
  /** Nome no registro de ícones. */
  icone: string;
  specs: CampoSpec[];
}

export const TIPOS_EQUIPAMENTO: TipoEquipamento[] = [
  { id: "notebook", rotulo: "Notebook", icone: "notebook", specs: ["processador", "memoria", "armazenamento", "sistema", "hostname", "tela"] },
  { id: "desktop", rotulo: "Computador", icone: "desktop", specs: ["processador", "memoria", "armazenamento", "sistema", "hostname"] },
  { id: "monitor", rotulo: "Monitor", icone: "monitor", specs: ["tela", "resolucao", "conexoes"] },
  { id: "mouse", rotulo: "Mouse", icone: "mouse", specs: ["conexao"] },
  { id: "teclado", rotulo: "Teclado", icone: "teclado", specs: ["conexao", "layout"] },
  { id: "headset", rotulo: "Headset", icone: "headset", specs: ["conexao"] },
  { id: "webcam", rotulo: "Webcam", icone: "webcam", specs: ["resolucao", "conexao"] },
  { id: "dock", rotulo: "Dock ou adaptador", icone: "dock", specs: ["conexoes"] },
  { id: "celular", rotulo: "Celular", icone: "celular", specs: ["armazenamento", "sistema", "imei", "linha"] },
  { id: "tablet", rotulo: "Tablet", icone: "tablet", specs: ["armazenamento", "sistema"] },
  { id: "impressora", rotulo: "Impressora", icone: "impressora", specs: ["conexao", "hostname"] },
  { id: "rede", rotulo: "Rede", icone: "rede", specs: ["hostname"] },
  { id: "armazenamento", rotulo: "HD ou SSD externo", icone: "armazenamento", specs: ["armazenamento", "conexao"] },
  { id: "outro", rotulo: "Outro", icone: "equipamento", specs: [] },
];

const POR_ID = new Map(TIPOS_EQUIPAMENTO.map((t) => [t.id, t]));

/** O tipo do catálogo; tipo que saiu do catálogo cai em "Outro" em vez de quebrar a tela. */
export function tipoEquipamento(id: string): TipoEquipamento {
  return POR_ID.get(id) ?? { ...POR_ID.get("outro")!, id };
}

export function ehTipoEquipamento(id: unknown): id is string {
  return typeof id === "string" && POR_ID.has(id);
}

// ── Com quem está ─────────────────────────────────────────────────────────────

export type Destino = "pessoa" | "local" | "estoque" | "manutencao" | "baixa";

export type MotivoBaixa = "descarte" | "venda" | "doacao" | "perda" | "roubo";

export const MOTIVOS_BAIXA: { valor: MotivoBaixa; rotulo: string }[] = [
  { valor: "descarte", rotulo: "Descarte" },
  { valor: "venda", rotulo: "Venda" },
  { valor: "doacao", rotulo: "Doação" },
  { valor: "perda", rotulo: "Perda" },
  { valor: "roubo", rotulo: "Roubo ou furto" },
];

export const rotuloMotivo = (m: MotivoBaixa) => MOTIVOS_BAIXA.find((x) => x.valor === m)?.rotulo ?? m;

/** Onde o equipamento está depois de uma movimentação. */
export type Posse =
  | { destino: "pessoa"; empresa: number; contrato: number; nome: string; setor: string | null }
  | { destino: "local"; local: string }
  | { destino: "estoque" }
  | { destino: "manutencao"; local: string | null }
  | { destino: "baixa"; motivo: MotivoBaixa };

/** A situação que a lista filtra. Pessoa e local são os dois jeitos de estar em uso. */
export type Situacao = "uso" | "estoque" | "manutencao" | "baixado";

export function situacaoDaPosse(p: Posse): Situacao {
  if (p.destino === "pessoa" || p.destino === "local") return "uso";
  if (p.destino === "baixa") return "baixado";
  return p.destino;
}

/** Chave de uma pessoa do Diretório: a mesma do RH, empresa e contrato. */
export const chavePessoa = (empresa: number, contrato: number) => `${empresa}:${contrato}`;

export function mesmaPosse(a: Posse, b: Posse): boolean {
  if (a.destino !== b.destino) return false;
  if (a.destino === "pessoa" && b.destino === "pessoa") return a.empresa === b.empresa && a.contrato === b.contrato;
  if (a.destino === "local" && b.destino === "local") return a.local.trim().toLowerCase() === b.local.trim().toLowerCase();
  // Estoque é um lugar só; manutenção e baixa repetidas não mudam nada.
  return true;
}

/** Como a posse se lê numa linha: o nome, o lugar ou a situação. */
export function textoPosse(p: Posse): string {
  switch (p.destino) {
    case "pessoa":
      return p.nome;
    case "local":
      return p.local;
    case "estoque":
      return "Estoque da TI";
    case "manutencao":
      return p.local ? `Manutenção · ${p.local}` : "Manutenção";
    case "baixa":
      return `Baixa · ${rotuloMotivo(p.motivo)}`;
  }
}

// ── O que as rotas devolvem ───────────────────────────────────────────────────

export type Especificacoes = Partial<Record<CampoSpec, string>>;

/** O que o cadastro guarda, e o que o formulário manda. */
export interface DadosEquipamento {
  tipo: string;
  patrimonio: string | null;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  especificacoes: Especificacoes;
  dataCompra: string | null;
  valorCompra: number | null;
  fornecedor: string | null;
  notaFiscal: string | null;
  garantiaAte: string | null;
  observacoes: string | null;
}

/** Uma linha do inventário: o cadastro, com quem está e desde quando. */
export interface EquipamentoLista extends DadosEquipamento {
  id: number;
  posse: Posse;
  /** Data da última movimentação. */
  desde: string;
  /** Quantas movimentações tem. Uma só é o cadastro: dá para apagar sem perder histórico. */
  movimentacoes: number;
}

export interface Movimentacao {
  id: number;
  equipamentoId: number;
  posse: Posse;
  /** Onde estava antes; null na primeira, que é o cadastro. */
  anterior: Posse | null;
  data: string;
  observacao: string | null;
  registradoPor: string | null;
  /** "YYYY-MM-DDTHH:MM:SS", hora do escritório. */
  registradoEm: string;
}

/** Uma linha do registro de movimentações, com o equipamento para ler sozinha. */
export interface MovimentacaoLista extends Movimentacao {
  equipamento: Pick<EquipamentoLista, "tipo" | "patrimonio" | "marca" | "modelo" | "numeroSerie">;
}

export interface EquipamentoDetalhe extends EquipamentoLista {
  historico: Movimentacao[];
  criadoEm: string;
  atualizadoEm: string;
}

/** Quem pode receber equipamento: gente do Diretório do RH, só o que a TI precisa ler. */
export interface PessoaTi {
  empresa: number;
  contrato: number;
  nome: string;
  setor: string | null;
  cargo: string | null;
}

/** O pedido de movimentação: um ou mais equipamentos para o mesmo destino. */
export interface PedidoMovimentacao {
  equipamentos: number[];
  destino: Destino;
  pessoa?: { empresa: number; contrato: number } | null;
  local?: string | null;
  motivo?: MotivoBaixa | null;
  data: string;
  observacao?: string | null;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/** "Notebook Dell Latitude 3420"; sem marca nem modelo, só o tipo. */
export function nomeEquipamento(e: Pick<DadosEquipamento, "tipo" | "marca" | "modelo">): string {
  const partes = [tipoEquipamento(e.tipo).rotulo, e.marca, e.modelo].filter((p) => p && p.trim());
  return partes.join(" ");
}

/**
 * A frase de uma linha do histórico: o que aconteceu e de onde o equipamento
 * veio. O verbo depende do par (anterior, atual): pessoa para pessoa é
 * "passou", estoque para pessoa é "entregue", a primeira linha é o cadastro.
 */
export function frasePosse(m: Pick<Movimentacao, "posse" | "anterior">): { titulo: string; de: string | null } {
  const p = m.posse;
  const a = m.anterior;
  const de = a ? textoPosse(a) : null;
  switch (p.destino) {
    case "pessoa":
      return {
        titulo: !a ? `Cadastrado com ${p.nome}` : a.destino === "pessoa" ? `Passou para ${p.nome}` : `Entregue a ${p.nome}`,
        de,
      };
    case "local":
      return { titulo: !a ? `Cadastrado em ${p.local}` : `Instalado em ${p.local}`, de };
    case "estoque":
      return {
        titulo: !a
          ? "Cadastrado no estoque"
          : a.destino === "manutencao"
            ? "Voltou da manutenção"
            : a.destino === "baixa"
              ? "Voltou ao estoque depois da baixa"
              : "Devolvido ao estoque",
        de,
      };
    case "manutencao":
      return { titulo: p.local ? `Foi para manutenção em ${p.local}` : "Foi para manutenção", de };
    case "baixa":
      return { titulo: `Baixa por ${rotuloMotivo(p.motivo).toLowerCase()}`, de };
  }
}

/** As especificações que cabem numa linha, na ordem do catálogo: "i5-1235U · 16 GB · SSD 512 GB". */
export function resumoSpecs(e: Pick<DadosEquipamento, "tipo" | "especificacoes">, max = 3): string {
  const tipo = tipoEquipamento(e.tipo);
  return tipo.specs
    .filter((c) => c !== "hostname" && c !== "imei" && c !== "linha")
    .map((c) => e.especificacoes[c]?.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(" · ");
}
