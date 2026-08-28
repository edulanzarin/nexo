/**
 * Tipos dos PAINÉIS do Contábil — a home do módulo, em DUAS versões por cargo
 * (mesma doutrina do DP: [[Permissão se valida no servidor, não na interface]]).
 * Diferente do DP (que é fila de pendências), aqui o retrato é de ATIVIDADE: o
 * que se rodou no app (nada de disparar automação, só contar) + a BASE
 * configurada acumulada. Fonte: a trilha `auditoria` e as tabelas
 * `conf_*`/`implantacao_*` do banco do app.
 *
 * O recorte entre os dois é POR DONO, como no Post Mortem do DP: o colaborador
 * vê os SEUS números; a gestão vê os de TODOS, mais a série do time e o feed
 * com nome de quem fez.
 *
 * Cada bloco é independente e opcional (`| null`): se uma consulta falha, o
 * painel ainda mostra os outros.
 */

/** O que se rodou no período (contadores da trilha de auditoria). */
export interface ContabilAtividade {
  conciliacoes: number;
  /** Lançamentos gerados nas conciliações (soma de detalhe.linhas). */
  conciliacaoLinhas: number;
  implantacoes: number;
  laudos: number;
  pendenciasTriadas: number;
  pendenciasResolvidas: number;
  pendenciasIgnoradas: number;
  exportacoes: number;
}

/** Tamanho da base configurada no app (o conhecimento acumulado). */
export interface ContabilBase {
  plano: number; // conf_cfop_contabiliza (CFOPs com regra de contabilização)
  regras: number; // conf_regra (regras de contabilização detalhadas)
  regrasExtrato: number; // conf_regra_extrato ativas
  contasBanco: number; // conf_conta_banco
  depara: number; // implantacao_depara
}

/** Um ponto da série mensal de trabalhos rodados. */
export interface ContabilSeriePonto {
  bucket: string; // "YYYY-MM"
  conciliacoes: number;
  implantacoes: number;
  laudos: number;
}

/** Um evento recente da trilha (feed de atividade). */
export interface ContabilEvento {
  id: number;
  usuario: string;
  acao: string;
  alvo: string | null;
  quando: string; // "YYYY-MM-DDTHH:MM:SS"
}

/**
 * Painel do COLABORADOR: os MEUS números do mês + a base configurada. Sem série
 * do time e sem atividade alheia — quem não é gestor não busca o dado dos
 * outros (a rota é outra, e o gate é por seção).
 */
export interface PainelContabilColaborador {
  periodo: { inicio: string; fim: string };
  /** Recortada pelo dono: só o que ESTA pessoa rodou. */
  atividade: ContabilAtividade | null;
  base: ContabilBase | null;
  /** Feed só dos meus eventos. */
  recentes: ContabilEvento[] | null;
}

/** Painel de GESTÃO: o time inteiro — atividade, base, série e feed com autor. */
export interface PainelContabilGestao {
  periodo: { inicio: string; fim: string };
  atividade: ContabilAtividade | null;
  base: ContabilBase | null;
  serie: ContabilSeriePonto[] | null;
  recentes: ContabilEvento[] | null;
}
