/**
 * Tipos do GRUPO DE EMPRESA do Acessórias. Separados do módulo que os produz
 * porque `carteira-grupos.ts` é `server-only` e a tela precisa do formato.
 *
 * Não confundir com `grupos-empresa.ts`: aquele é o cadastro de grupo do PRÓPRIO
 * Nexo, mantido em Configurações e usado como filtro de escopo na barra. Os dois
 * existem, e é por isso que a tela nomeia cada um.
 */

export interface GrupoCarteira {
  id: number;
  nome: string;
  ativo: boolean;
  /** Empresas do grupo que estão na carteira e no escopo de quem pergunta. */
  empresas: number;
}

export interface EstadoGrupos {
  /** Grupos gravados (ativos e inativos). */
  grupos: number;
  /** Vínculos empresa↔grupo gravados. */
  vinculos: number;
  /** Empresas listadas em algum grupo e ausentes da carteira. */
  foraDaCarteira: number;
  /** Fim da última varredura bem-sucedida. Null = nunca sincronizou. */
  atualizadoEm: string | null;
  erro: string | null;
  rodando: { id: number; grupos: number; desde: string } | null;
}
