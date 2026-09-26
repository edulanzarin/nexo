import {
  camposDoTipo,
  ehSegredo,
  ehTipoAcesso,
  SEGREDOS_ACESSO,
  tipoAcesso,
  type CampoAcessoId,
  type DadosAcesso,
  type DefCampoAcesso,
  type PedidoSegredos,
  type SegredoId,
  type TipoAcesso,
} from "./ti-acessos-tipos";
import { dataValida, RecusaTi, texto } from "./ti-regras";

/**
 * O que a tela manda ao cofre de Acessos, conferido contra o catálogo. Sem
 * banco nem sessão, para caber num teste ([[ti-acessos-regras.test]]).
 */

const recusar = (msg: string): never => {
  throw new RecusaTi(msg);
};

const SEGREDO_MAX = 2000;
const OBS_MAX = 2000;

/** Observação guarda as quebras de linha: é onde mora o passo a passo de como entrar. */
function observacao(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return recusar("Observações inválidas");
  const t = v
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (t.length > OBS_MAX) return recusar(`Observações passam de ${OBS_MAX} letras`);
  return t || null;
}

function valorDoCampo(def: DefCampoAcesso, v: unknown): string | null {
  if (v == null || v === "") return null;
  if (def.tipo === "porta") {
    const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 65535) return recusar("A porta vai de 1 a 65535");
    return String(n);
  }
  if (typeof v !== "string") return recusar(`Valor inválido em ${def.rotulo}`);
  const t = v.trim();
  if (!t) return null;
  switch (def.tipo) {
    case "opcao":
      return def.opcoes?.includes(t) ? t : recusar(`${def.rotulo}: escolha uma opção da lista`);
    case "data":
      return dataValida(t) ? t : recusar(`${def.rotulo}: data inválida`);
    case "host":
    case "url":
      if (/\s/.test(t)) return recusar(`${def.rotulo} não pode ter espaço`);
      if (t.length > 300) return recusar(`${def.rotulo} passa de 300 letras`);
      return t;
    case "email":
      if (!/^[^\s@]+@[^\s@]+$/.test(t)) return recusar(`${def.rotulo} não parece um e-mail`);
      if (t.length > 200) return recusar(`${def.rotulo} passa de 200 letras`);
      return t;
    default:
      return texto(t, def.rotulo);
  }
}

/**
 * O cadastro de um acesso. Campo que o tipo não pede é descartado: trocar
 * banco de dados por Wi-Fi no formulário não deixa a porta gravada no Wi-Fi.
 */
export function lerDadosAcesso(corpo: unknown): DadosAcesso {
  const b = (corpo ?? {}) as Record<string, unknown>;
  if (!ehTipoAcesso(b.tipo)) recusar("Escolha o tipo do acesso");
  const tipo = tipoAcesso(b.tipo as string);
  const nome = texto(b.nome, "Nome");
  if (!nome) recusar("Dê um nome ao acesso");

  const brutos = (b.campos ?? {}) as Record<string, unknown>;
  if (typeof brutos !== "object" || Array.isArray(brutos)) recusar("Campos inválidos");
  const campos: Partial<Record<CampoAcessoId, string>> = {};
  for (const def of camposDoTipo(tipo)) {
    const v = valorDoCampo(def, brutos[def.id]);
    if (v) campos[def.id] = v;
  }

  const eq = b.equipamentoId;
  let equipamentoId: number | null = null;
  if (eq != null && eq !== "") {
    if (!Number.isInteger(eq) || (eq as number) <= 0) recusar("Equipamento inválido");
    equipamentoId = eq as number;
  }

  return {
    tipo: tipo.id,
    nome: nome as string,
    grupo: texto(b.grupo, "Grupo", 60),
    campos,
    observacoes: observacao(b.observacoes),
    equipamentoId,
  };
}

/**
 * Os segredos que o pedido mexe, só os que o tipo tem. Texto guarda, vazio ou
 * `null` remove, ausente fica como está. O segredo NÃO é aparado: espaço no fim
 * de uma senha é parte dela.
 */
export function lerSegredos(corpo: unknown, tipo: TipoAcesso): PedidoSegredos {
  const s = (corpo as Record<string, unknown> | null)?.segredos;
  if (s == null) return {};
  if (typeof s !== "object" || Array.isArray(s)) return recusar("Segredos inválidos");
  const pedido: PedidoSegredos = {};
  for (const id of tipo.segredos) {
    if (!(id in s)) continue;
    const v = (s as Record<string, unknown>)[id];
    const rotulo = SEGREDOS_ACESSO[id].rotulo;
    if (v === null || v === "") {
      pedido[id] = null;
      continue;
    }
    if (typeof v !== "string") recusar(`${rotulo} inválida`);
    if ((v as string).length > SEGREDO_MAX) recusar(`${rotulo} passa de ${SEGREDO_MAX} letras`);
    if (!(v as string).trim()) recusar(`${rotulo} não pode ser só espaço`);
    pedido[id] = v as string;
  }
  return pedido;
}

/** O cadastro e os segredos de um pedido de criar ou salvar. */
export function lerPedidoAcesso(corpo: unknown): { dados: DadosAcesso; segredos: PedidoSegredos } {
  const dados = lerDadosAcesso(corpo);
  return { dados, segredos: lerSegredos(corpo, tipoAcesso(dados.tipo)) };
}

export type ModoRevelar = "ver" | "copiar";

/** Qual segredo abrir, e para quê: ver e copiar ficam separados no registro. */
export function lerRevelar(corpo: unknown): { campo: SegredoId; modo: ModoRevelar } {
  const b = (corpo ?? {}) as Record<string, unknown>;
  if (typeof b.campo !== "string" || !ehSegredo(b.campo)) return recusar("Segredo inválido");
  const modo = b.modo === "copiar" ? "copiar" : "ver";
  return { campo: b.campo, modo };
}
