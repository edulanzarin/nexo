import type { ModoGrupo } from "./grupo-modo";

/**
 * Os tipos da Administração, fora da lib para a tela importar sem arrastar o
 * servidor.
 *
 * O modelo (o mesmo do nexo2): o CARGO concentra toda a permissão, com as
 * seções que libera, os grupos de permissão que trazem as empresas e as duas
 * chaves "acesso total" e "vê todas as empresas". A pessoa recebe um ou mais
 * cargos e o acesso é a união deles; não há ajuste por usuário.
 */

export const SENHA_MIN = 8;
export const NOME_MAX = 120;
/** Foto de perfil: até 2 MB e só formato de foto (SVG fica fora: é código). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ── Usuários ─────────────────────────────────────────────────────────────────

export interface CargoDoUsuario {
  id: number;
  nome: string;
  admin: boolean;
}

/** A linha da lista de usuários. Traz tudo o que o formulário precisa. */
export interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  cargos: CargoDoUsuario[];
  /** Algum cargo dá acesso total. */
  admin: boolean;
  /** Vê todas as empresas (acesso total já implica). */
  todasEmpresas: boolean;
  ultimoAcesso: string | null;
  /** Momento da foto em ms, para renovar o cache da imagem. Null = sem foto. */
  avatarVersao: number | null;
  /**
   * Registros que apontam para a pessoa sem apagar junto (relatórios do Post
   * Mortem, rescisões marcadas como pagas). Com algum, ela não sai: desativa.
   */
  registros: number;
}

/** O que a tela manda para criar ou salvar um usuário. A foto vai à parte. */
export interface DadosUsuario {
  nome: string;
  email: string;
  telefone: string | null;
  /** Obrigatória ao criar; vazia ao salvar mantém a atual. */
  senha: string;
  ativo: boolean;
  cargos: number[];
}

// ── Cargos ───────────────────────────────────────────────────────────────────

export interface CargoResumo {
  id: number;
  nome: string;
  setorId: number | null;
  setorNome: string | null;
  descricao: string | null;
  admin: boolean;
  todasEmpresas: boolean;
  secoes: number;
  grupos: number;
  usuarios: number;
}

export interface CargoDetalhe {
  id: number;
  nome: string;
  setorId: number | null;
  descricao: string | null;
  admin: boolean;
  todasEmpresas: boolean;
  /** Seções que o cargo libera, como chaves "modulo/secao". */
  secoes: string[];
  /** Grupos de permissão (ids de `empresa_grupo`). */
  grupos: number[];
  usuarios: number;
}

export interface DadosCargo {
  nome: string;
  /** Setor existente. Com `setorNovo`, o setor é criado na hora e este fica null. */
  setorId: number | null;
  setorNovo: string | null;
  descricao: string | null;
  admin: boolean;
  todasEmpresas: boolean;
  secoes: string[];
  grupos: number[];
}

// ── Setores ──────────────────────────────────────────────────────────────────

export interface SetorResumo {
  id: number;
  nome: string;
  /** Cargos do setor. Ao remover o setor, eles ficam sem setor. */
  cargos: number;
}

// ── Grupos de permissão ──────────────────────────────────────────────────────

export interface GrupoPermissaoResumo {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** Quantas empresas o grupo tem hoje. */
  empresas: number;
  /** Quantas estão marcadas: no modo `exceto`, as que ficam de fora. */
  marcadas: number;
  cargos: number;
  /** Pessoas que enxergam o grupo por algum cargo. */
  usuarios: number;
  atualizadoEm: string;
}

// ── Auditoria ────────────────────────────────────────────────────────────────

export interface EventoTrilha {
  id: number;
  usuarioNome: string;
  acao: string;
  modulo: string | null;
  alvo: string | null;
  codigoempresa: number | null;
  criadoEm: string;
}

export interface PaginaTrilha {
  linhas: EventoTrilha[];
  total: number;
  pagina: number;
  porPagina: number;
}

// ── Perfil ───────────────────────────────────────────────────────────────────

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  avatarVersao: number | null;
  /** Sessões abertas, contando esta. */
  sessoes: number;
}
