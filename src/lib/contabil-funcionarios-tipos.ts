/** Tipos da seção Funcionários do Contábil — compartilhados cliente/servidor. */

/**
 * Uma linha do quadro de funcionários visto pelo Contábil. Deliberadamente SEM
 * remuneração: aqui a pergunta é "esta pessoa é funcionário?", não quanto ela
 * ganha — quem precisa de salário tem o módulo DP e a permissão dele.
 */
export interface FuncionarioContabil {
  contrato: number;
  nome: string;
  /** Mascarado na origem: só o miolo, que é o que o PIX expõe no extrato. */
  cpf: string | null;
  cargo: string | null;
  setor: string | null;
  estabelecimento: string | null;
  dataadm: string | null;
  datadem: string | null;
  /** Dias entre admissão e hoje (ou o desligamento). */
  tempoCasaDias: number | null;
}

export interface FuncionariosContabilResp {
  empresa: number;
  ativos: number;
  desligados: number;
  linhas: FuncionarioContabil[];
}
