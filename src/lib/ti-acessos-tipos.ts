/**
 * O vocabulário dos Acessos da TI, sem banco: vale no servidor e na tela.
 *
 * Mesmo desenho do catálogo de equipamentos: o tipo é DADO. Cada um diz o
 * ícone, os campos que pede e quais deles são segredo, e o formulário, a ficha
 * e a lista se montam a partir dele. Tipo novo é uma linha aqui, sem migration.
 *
 * Segredo é o que vai cifrado e só aparece com registro de quem viu (senha,
 * chave compartilhada da VPN, chave de licença). O resto (servidor, porta,
 * usuário) é cadastro comum: aparece na lista e entra na busca.
 */

export type TipoCampoAcesso = "texto" | "url" | "host" | "porta" | "opcao" | "data" | "email";

export type CampoAcessoId =
  | "ssid"
  | "seguranca"
  | "url"
  | "sgbd"
  | "ferramenta"
  | "protocolo"
  | "host"
  | "porta"
  | "base"
  | "dominio"
  | "usuario"
  | "email"
  | "validade";

export interface DefCampoAcesso {
  rotulo: string;
  tipo: TipoCampoAcesso;
  exemplo?: string;
  opcoes?: string[];
}

export const CAMPOS_ACESSO: Record<CampoAcessoId, DefCampoAcesso> = {
  ssid: { rotulo: "Nome da rede", tipo: "texto", exemplo: "NAVECON" },
  seguranca: { rotulo: "Segurança", tipo: "opcao", opcoes: ["WPA2", "WPA3", "WPA2/WPA3", "WEP", "Aberta"] },
  url: { rotulo: "Endereço", tipo: "url", exemplo: "https://portal.exemplo.com.br" },
  sgbd: { rotulo: "Banco", tipo: "opcao", opcoes: ["PostgreSQL", "SQL Server", "MySQL ou MariaDB", "Firebird", "Oracle", "Outro"] },
  ferramenta: {
    rotulo: "Ferramenta",
    tipo: "opcao",
    opcoes: ["Área de Trabalho Remota (RDP)", "AnyDesk", "TeamViewer", "RustDesk", "VNC", "Outra"],
  },
  protocolo: { rotulo: "Protocolo", tipo: "opcao", opcoes: ["WireGuard", "OpenVPN", "IPsec", "L2TP", "SSTP", "Outro"] },
  host: { rotulo: "Servidor", tipo: "host", exemplo: "192.168.0.10" },
  porta: { rotulo: "Porta", tipo: "porta" },
  base: { rotulo: "Base", tipo: "texto", exemplo: "navex" },
  dominio: { rotulo: "Domínio", tipo: "texto", exemplo: "NAVECON" },
  usuario: { rotulo: "Usuário", tipo: "texto", exemplo: "admin" },
  email: { rotulo: "E-mail", tipo: "email", exemplo: "ti@navecon.com.br" },
  validade: { rotulo: "Validade", tipo: "data" },
};

export type SegredoId = "senha" | "psk" | "chave";

/** Os três são femininos, e a frase do registro conta com isso ("vista", "copiada"). */
export const SEGREDOS_ACESSO: Record<SegredoId, { rotulo: string }> = {
  senha: { rotulo: "Senha" },
  psk: { rotulo: "Chave compartilhada" },
  chave: { rotulo: "Chave da licença" },
};

export const ehSegredo = (id: string): id is SegredoId => id in SEGREDOS_ACESSO;

/** Um campo como o tipo pede: o do catálogo, com o rótulo e o exemplo que o tipo trocar. */
export interface CampoDoTipo {
  id: CampoAcessoId;
  rotulo?: string;
  exemplo?: string;
}

export interface TipoAcesso {
  id: string;
  rotulo: string;
  /** Nome no registro de ícones. */
  icone: string;
  campos: CampoDoTipo[];
  segredos: SegredoId[];
}

export const TIPOS_ACESSO: TipoAcesso[] = [
  { id: "wifi", rotulo: "Wi-Fi", icone: "wifi", campos: [{ id: "ssid" }, { id: "seguranca" }], segredos: ["senha"] },
  { id: "site", rotulo: "Site ou portal", icone: "site", campos: [{ id: "url" }, { id: "usuario" }], segredos: ["senha"] },
  {
    id: "sistema",
    rotulo: "Sistema",
    icone: "aplicativo",
    campos: [{ id: "url", exemplo: "http://192.168.0.10:8080" }, { id: "usuario" }],
    segredos: ["senha"],
  },
  {
    id: "banco",
    rotulo: "Banco de dados",
    icone: "banco_de_dados",
    campos: [{ id: "sgbd" }, { id: "host" }, { id: "porta" }, { id: "base" }, { id: "usuario" }],
    segredos: ["senha"],
  },
  {
    id: "remoto",
    rotulo: "Área de trabalho remota",
    icone: "remoto",
    campos: [
      { id: "ferramenta" },
      { id: "host", rotulo: "Computador", exemplo: "192.168.0.20 ou o ID do AnyDesk" },
      { id: "porta" },
      { id: "dominio" },
      { id: "usuario" },
    ],
    segredos: ["senha"],
  },
  {
    id: "servidor",
    rotulo: "Servidor (SSH)",
    icone: "servidor",
    campos: [{ id: "host" }, { id: "porta" }, { id: "usuario" }],
    segredos: ["senha"],
  },
  {
    id: "rede",
    rotulo: "Equipamento de rede",
    icone: "rede",
    campos: [{ id: "url", rotulo: "Painel", exemplo: "http://192.168.0.1" }, { id: "usuario" }],
    segredos: ["senha"],
  },
  {
    id: "vpn",
    rotulo: "VPN",
    icone: "vpn",
    campos: [{ id: "protocolo" }, { id: "host" }, { id: "porta" }, { id: "usuario" }],
    segredos: ["senha", "psk"],
  },
  {
    id: "email",
    rotulo: "E-mail",
    icone: "email",
    campos: [{ id: "email" }, { id: "host", rotulo: "Servidor de envio", exemplo: "smtp.office365.com" }, { id: "porta" }],
    segredos: ["senha"],
  },
  {
    id: "licenca",
    rotulo: "Licença de software",
    icone: "licenca",
    campos: [{ id: "email", rotulo: "Conta" }, { id: "validade" }],
    segredos: ["chave"],
  },
  { id: "outro", rotulo: "Outro", icone: "chave", campos: [{ id: "url" }, { id: "usuario" }], segredos: ["senha"] },
];

const POR_ID = new Map(TIPOS_ACESSO.map((t) => [t.id, t]));

/** O tipo do catálogo; tipo que saiu do catálogo cai em "Outro" em vez de quebrar a tela. */
export function tipoAcesso(id: string): TipoAcesso {
  return POR_ID.get(id) ?? { ...POR_ID.get("outro")!, id };
}

export function ehTipoAcesso(id: unknown): id is string {
  return typeof id === "string" && POR_ID.has(id);
}

/** Os campos do tipo, cada um com o rótulo e o exemplo que valem nele. */
export function camposDoTipo(tipo: TipoAcesso): (DefCampoAcesso & { id: CampoAcessoId })[] {
  return tipo.campos.map((c) => ({
    ...CAMPOS_ACESSO[c.id],
    id: c.id,
    rotulo: c.rotulo ?? CAMPOS_ACESSO[c.id].rotulo,
    exemplo: c.exemplo ?? CAMPOS_ACESSO[c.id].exemplo,
  }));
}

const PORTAS: Record<string, number> = {
  PostgreSQL: 5432,
  "SQL Server": 1433,
  "MySQL ou MariaDB": 3306,
  Firebird: 3050,
  Oracle: 1521,
  "Área de Trabalho Remota (RDP)": 3389,
  VNC: 5900,
  WireGuard: 51820,
  OpenVPN: 1194,
  IPsec: 500,
  L2TP: 1701,
  SSTP: 443,
};

/**
 * A porta de costume do que foi escolhido (5432 para PostgreSQL, 3389 para RDP).
 * Vai de sugestão no campo, não de valor gravado: porta que ninguém digitou não
 * é informação do cadastro.
 */
export function portaPadrao(tipo: string, campos: Partial<Record<CampoAcessoId, string>>): number | null {
  if (tipo === "servidor") return 22;
  if (tipo === "email") return 587;
  const escolha = campos.sgbd ?? campos.ferramenta ?? campos.protocolo;
  return (escolha && PORTAS[escolha]) || null;
}

// ── O que a tela lê ──────────────────────────────────────────────────────────

/** O equipamento a que o acesso pertence (o roteador, a impressora). */
export interface EquipamentoDoAcesso {
  id: number;
  tipo: string;
  nome: string;
  patrimonio: string | null;
}

export interface AcessoLista {
  id: number;
  tipo: string;
  nome: string;
  grupo: string | null;
  campos: Partial<Record<CampoAcessoId, string>>;
  /** Os segredos guardados, cada um com o dia da última troca. A cifra nunca vem. */
  segredos: Partial<Record<SegredoId, string>>;
  /** Segredos guardados com outra chave do cofre, que não abrem com a de agora. */
  outraChave: SegredoId[];
  observacoes: string | null;
  equipamento: EquipamentoDoAcesso | null;
  atualizadoEm: string;
}

export type AcaoEvento = "criado" | "editado" | "segredo" | "removido" | "revelado" | "copiado" | "apagado";

export interface EventoAcesso {
  id: number;
  acao: AcaoEvento;
  /** O segredo visto, copiado, trocado ou removido, ou os campos editados. */
  campos: string[];
  usuario: string | null;
  em: string;
}

export interface AcessoDetalhe extends AcessoLista {
  criadoEm: string;
  eventos: EventoAcesso[];
}

/** Uma linha do registro do cofre inteiro, com o acesso como estava. */
export interface RegistroAcesso extends EventoAcesso {
  acesso: { id: number | null; nome: string; tipo: string };
}

export interface ListaAcessos {
  acessos: AcessoLista[];
  /** O que dá para vincular: o inventário sem os baixados. */
  equipamentos: EquipamentoDoAcesso[];
  /** O cofre tem chave: sem ela, dá para ver o cadastro mas não guardar nem abrir segredo. */
  chave: boolean;
}

/** O cadastro que a tela manda, sem os segredos. */
export interface DadosAcesso {
  tipo: string;
  nome: string;
  grupo: string | null;
  campos: Partial<Record<CampoAcessoId, string>>;
  observacoes: string | null;
  equipamentoId: number | null;
}

/**
 * Os segredos que o pedido mexe: texto guarda (ou troca), `null` remove, e o
 * segredo que não vem no pedido fica como está. É o que deixa editar a porta
 * sem redigitar a senha.
 */
export type PedidoSegredos = Partial<Record<SegredoId, string | null>>;

// ── Leitura ──────────────────────────────────────────────────────────────────

/** O endereço que a lista mostra: a rede, o link, o servidor com a porta ou o e-mail. */
export function enderecoAcesso(a: Pick<AcessoLista, "campos">): string | null {
  const c = a.campos;
  if (c.ssid) return c.ssid;
  if (c.url) return c.url;
  if (c.host) return c.porta ? `${c.host}:${c.porta}` : c.host;
  return c.email ?? null;
}

/** O login da lista: o usuário, ou o e-mail quando ele não já é o endereço (a conta da licença). */
export function usuarioAcesso(a: Pick<AcessoLista, "campos">): string | null {
  if (a.campos.usuario) return a.campos.usuario;
  return a.campos.email && enderecoAcesso(a) !== a.campos.email ? a.campos.email : null;
}

/** O endereço que abre no navegador. Só http e https: o resto não é link. */
export function linkAcesso(a: Pick<AcessoLista, "campos">): string | null {
  const u = a.campos.url;
  return u && /^https?:\/\/\S+$/i.test(u) ? u : null;
}

const escaparWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

/**
 * O texto do QR que o celular lê para entrar no Wi-Fi sem digitar a senha
 * (o formato WIFI: que Android e iPhone entendem pela câmera).
 */
export function textoQrWifi(ssid: string, seguranca: string | undefined, senha: string | null): string {
  const t = !senha || seguranca === "Aberta" ? "nopass" : seguranca === "WEP" ? "WEP" : "WPA";
  return `WIFI:T:${t};S:${escaparWifi(ssid)};${t === "nopass" ? "" : `P:${escaparWifi(senha ?? "")};`};`;
}

/** Dias corridos de `desde` (data ou data e hora) até `hoje`. */
export function diasEntre(desde: string, hoje: string): number {
  const dia = (s: string) => {
    const [a, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((dia(hoje) - dia(desde)) / 86_400_000);
}

/** Senha que ninguém troca há um ano pede troca: saiu gente, passou prestador. */
export const DIAS_SENHA_ANTIGA = 365;

/** A troca mais antiga entre os segredos guardados, quando passa de um ano. */
export function segredoAntigo(a: Pick<AcessoLista, "segredos">, hoje: string): string | null {
  const datas = Object.values(a.segredos).filter((d): d is string => !!d).sort();
  return datas.length && diasEntre(datas[0], hoje) > DIAS_SENHA_ANTIGA ? datas[0] : null;
}

/** Licença com validade vence em 30 dias ou já venceu. */
export const DIAS_LICENCA = 30;

export function rotuloSegredo(id: string): string {
  return ehSegredo(id) ? SEGREDOS_ACESSO[id].rotulo : id;
}

const GERAIS: Record<string, string> = {
  nome: "nome",
  grupo: "grupo",
  tipo: "tipo",
  observacoes: "observações",
  equipamento: "equipamento",
};

/** O nome de um campo no registro, em minúscula para entrar no meio da frase. */
export function rotuloCampoEvento(tipo: string, campo: string): string {
  if (ehSegredo(campo)) return SEGREDOS_ACESSO[campo].rotulo.toLowerCase();
  if (GERAIS[campo]) return GERAIS[campo];
  const doTipo = camposDoTipo(tipoAcesso(tipo)).find((c) => c.id === campo);
  return (doTipo?.rotulo ?? CAMPOS_ACESSO[campo as CampoAcessoId]?.rotulo ?? campo).toLowerCase();
}

function listaHumana(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A frase de uma linha do registro: "Senha vista", "Editou porta e usuário". */
export function fraseEvento(e: Pick<EventoAcesso, "acao" | "campos">, tipo: string): { titulo: string; icone: string } {
  const nomes = listaHumana(e.campos.map((c) => rotuloCampoEvento(tipo, c)));
  const varios = e.campos.length > 1;
  switch (e.acao) {
    case "criado":
      return { titulo: "Cadastrado no cofre", icone: "mais" };
    case "editado":
      return { titulo: `Editou ${nomes}`, icone: "editar" };
    case "segredo":
      return { titulo: `${maiuscula(nomes)} ${varios ? "trocadas" : "trocada"}`, icone: "chave" };
    case "removido":
      return { titulo: `${maiuscula(nomes)} ${varios ? "removidas" : "removida"}`, icone: "menos" };
    case "revelado":
      return { titulo: `${maiuscula(nomes)} vista`, icone: "ver" };
    case "copiado":
      return { titulo: `${maiuscula(nomes)} copiada`, icone: "copiar" };
    case "apagado":
      return { titulo: "Apagado do cofre", icone: "apagar" };
  }
}

// ── Gerar senha ──────────────────────────────────────────────────────────────

// Sem os que se confundem lidos em voz alta ou na tela (0 e O, 1, l e I).
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*-_=+?";

/**
 * Senha forte, com pelo menos um de cada grupo. `crypto.getRandomValues` existe
 * também fora do HTTPS, ao contrário do `crypto.subtle`.
 */
export function gerarSenha(tamanho = 20): string {
  const grupos = [MINUSCULAS, MAIUSCULAS, DIGITOS, SIMBOLOS];
  const todos = grupos.join("");
  // Uma faixa do sorteio para cada uso: as letras, o embaralhar e o de cada grupo.
  const sorteio = new Uint32Array(tamanho * 2 + grupos.length);
  crypto.getRandomValues(sorteio);
  const letras = Array.from({ length: tamanho }, (_, i) => todos[sorteio[i] % todos.length]);
  // Garante um de cada grupo em posições sorteadas distintas.
  const posicoes = Array.from({ length: tamanho }, (_, i) => i);
  for (let i = posicoes.length - 1; i > 0; i--) {
    const j = sorteio[tamanho + i] % (i + 1);
    [posicoes[i], posicoes[j]] = [posicoes[j], posicoes[i]];
  }
  grupos.forEach((g, k) => {
    letras[posicoes[k]] = g[sorteio[tamanho * 2 + k] % g.length];
  });
  return letras.join("");
}
