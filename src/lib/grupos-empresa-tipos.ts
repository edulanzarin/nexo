import type { ModoGrupo } from "./grupo-modo";

/**
 * Os tipos do cadastro de grupos de empresa de negócio (Configurações), fora
 * da lib para a tela importar sem arrastar o servidor.
 */

export interface GrupoEmpresaResumo {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** Quantas empresas o grupo tem hoje. */
  empresas: number;
  /** Quantas estão marcadas: no modo `exceto`, as que ficam de fora. */
  marcadas: number;
}

/** A linha da tela de cadastro. */
export interface GrupoEmpresaCadastro extends GrupoEmpresaResumo {
  /**
   * Relatórios do Post Mortem que apontam para o grupo. Enquanto houver, o
   * grupo não sai: a chave estrangeira segura, e apagar deixaria o relatório
   * sem o grupo que o analista escolheu.
   */
  relatorios: number;
  atualizadoEm: string;
}

export interface GrupoEmpresaDetalhe {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** As marcadas, como estão gravadas (dentro ou fora, conforme o modo). */
  empresas: number[];
}

/** O que a tela manda para criar ou salvar um grupo. */
export interface DadosGrupoEmpresa {
  nome: string;
  modo: ModoGrupo;
  empresas: number[];
}

/** Empresa do cadastro do Questor, para marcar num grupo. */
export interface EmpresaMarcavel {
  codigo: number;
  nome: string;
}

export const NOME_GRUPO_MAX = 80;
