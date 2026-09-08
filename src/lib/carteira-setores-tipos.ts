/**
 * Tipos da carteira do Acessórias com responsável por setor.
 *
 * Separados do módulo que os produz porque `carteira-setores.ts` é `server-only`
 * (fala com o banco do app e com a API externa) e a tela precisa do formato —
 * tipo em arquivo próprio é o que deixa as duas pontas compartilharem o contrato
 * sem o cliente importar o servidor.
 */

export interface ItemCarteira {
  cnpj: string;
  razao: string;
  fantasia: string | null;
  /** Par no Questor; null = cliente que só existe no Acessórias. */
  codigoempresa: number | null;
  /** Responsável pelo setor, como o Acessórias escreve. Null = setor sem dono. */
  respNome: string | null;
  respEmail: string | null;
}

export interface EstadoCarteira {
  empresas: number;
  casadas: number;
  /** Empresas ativas que já têm responsável gravado no setor Contábil. */
  comResponsavel: number;
  /** Fim da última varredura bem-sucedida. Null = nunca sincronizou. */
  atualizadoEm: string | null;
  erro: string | null;
  rodando: { id: number; paginas: number; empresas: number; desde: string } | null;
}
