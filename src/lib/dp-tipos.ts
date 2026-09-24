/**
 * Tipos da Produtividade do DP — compartilhados entre a lib server-only
 * (`dp-produtividade`) e o cliente (hooks/telas). Vivem fora da lib de queries
 * porque a lib importa `db`/`server-only`; o tipo é apagado no build, mas manter
 * o contrato num arquivo neutro evita puxar código de servidor pro bundle.
 *
 * Tudo aqui é "trabalho do DP no período", medido pela auditoria embutida do
 * Questor (`codigousuario` + `datahoralcto`) — ver [[Logs e auditoria no Questor]].
 */

/**
 * Os trabalhos rastreados. Nasceu com quatro e virou doze em ago/2026, quando
 * uma varredura do banco atrás de carimbo de gente mostrou que a seção media o
 * que acontece EM VOLTA da folha (admitir, demitir, dar férias) e não media a
 * folha: `funcpercalculo` sozinha tem ~7 mil cálculos por mês, feitos por 24
 * pessoas, e não aparecia em lugar nenhum.
 *
 * Com doze, a contagem deixou de ser quatro colunas fixas e virou `Record` sobre
 * este catálogo — acrescentar fonte passou a ser uma linha aqui, em vez de uma
 * coluna em seis arquivos.
 */
export type DpTipo =
  // Movimentação — o ciclo de vida do contrato
  | "avisos"
  | "rescisoes"
  | "admissoes"
  // Férias
  | "ferias"
  // Folha — o cálculo mensal e o fechamento
  | "folha"
  | "encargos"
  | "esocialcalc"
  | "provisoes"
  // Cadastro — a manutenção do contrato vivo
  | "afastamentos"
  | "salarios"
  | "cargos"
  // Transmissão
  | "esocial";

/**
 * Famílias de trabalho. Existem porque doze abas no topo da tela seriam uma
 * lista, não uma navegação: a aba é por FAMÍLIA e a composição por tipo mora
 * dentro dela. Também é o agrupamento que o DP usa para falar do próprio mês
 * ("fechei a folha", "fiz a movimentação").
 */
export type DpFamilia = "movimentacao" | "ferias" | "folha" | "cadastro" | "esocial";

export const DP_FAMILIAS: { id: DpFamilia; rotulo: string; descricao: string }[] = [
  {
    id: "movimentacao",
    rotulo: "Movimentação",
    descricao: "Entrada e saída de gente: admissão, aviso prévio e rescisão",
  },
  { id: "ferias", rotulo: "Férias", descricao: "Recibos de férias calculados" },
  {
    id: "folha",
    rotulo: "Folha",
    descricao: "O cálculo do mês e o que fecha em cima dele: encargos, eSocial e provisões",
  },
  {
    id: "cadastro",
    rotulo: "Cadastro",
    descricao: "Manutenção do contrato vivo: afastamento, reajuste e mudança de cargo",
  },
  { id: "esocial", rotulo: "eSocial", descricao: "Eventos transmitidos ao eSocial no período" },
];

/** Um trabalho do catálogo: de onde sai, como se chama e a que família pertence. */
export interface DpTipoInfo {
  id: DpTipo;
  rotulo: string;
  descricao: string;
  familia: DpFamilia;
  /** Tabela do Questor onde o trabalho deixa rastro (a fonte de auditoria). */
  tabela: string;
  /**
   * A fonte tem `codigofunccontr` (o contrato) e por isso a lista de detalhe
   * consegue nomear o funcionário. `esocialtransacao` não tem: é evento de
   * empresa, e a lista dela mostra o evento no lugar da pessoa.
   */
  porContrato: boolean;
  /**
   * A rotina cai muito no usuário 0 (sistema). Marca a tela para não vender
   * rotina automática como trabalho de gente — o eSocial transmitido é ~30%
   * sistema nesta base.
   */
  temAutomacao?: boolean;
  /**
   * Colunas que identificam UM GESTO, quando a linha não é o gesto.
   *
   * Calcular a folha de uma empresa grava uma linha POR FUNCIONÁRIO, e a
   * distorção é brutal: em ago/2026 `calculoencargos` teve 18.504 linhas para
   * **137 gestos** (135×), `calculoesocial` 8.201 para 145 (57×) e
   * `funcpercalculo` 7.187 para 611 (12×). Contando linha, fechar encargos
   * viraria o maior trabalho do DP — quando são 137 atos em 101 empresas — e
   * afogaria os 332 cálculos de rescisão, que custam muito mais por unidade.
   *
   * Ausente = a linha É o gesto (uma rescisão, um afastamento, um evento
   * transmitido). Mesma doutrina da aba Apuração do Fiscal.
   */
  gesto?: string;
  /** Como se chama uma unidade deste trabalho na tela ("cálculo", "fechamento"). */
  unidade: string;
}

export const DP_TIPOS: DpTipoInfo[] = [
  {
    id: "avisos",
    rotulo: "Avisos prévios",
    descricao: "Aviso prévio cadastrado",
    familia: "movimentacao",
    tabela: "funcavisoprevio",
    porContrato: true,
    unidade: "aviso",
  },
  {
    id: "rescisoes",
    rotulo: "Rescisões",
    descricao: "Rescisão calculada",
    familia: "movimentacao",
    tabela: "rescisao",
    porContrato: true,
    unidade: "rescisão",
  },
  {
    id: "admissoes",
    rotulo: "Admissões",
    descricao: "Contrato de trabalho aberto",
    familia: "movimentacao",
    tabela: "funccontrato",
    porContrato: true,
    unidade: "admissão",
  },
  {
    id: "ferias",
    rotulo: "Férias",
    descricao: "Recibo de férias calculado",
    familia: "ferias",
    tabela: "reciboferias",
    porContrato: true,
    unidade: "recibo",
  },
  {
    id: "folha",
    rotulo: "Folha calculada",
    descricao: "Cálculo da folha de um funcionário num período — o trabalho central do mês",
    familia: "folha",
    tabela: "funcpercalculo",
    porContrato: true,
    gesto: "codigoempresa, codigopercalculo",
    unidade: "folha",
  },
  {
    id: "encargos",
    rotulo: "Encargos",
    descricao: "Encargos calculados sobre a folha (INSS, FGTS, terceiros)",
    familia: "folha",
    tabela: "calculoencargos",
    porContrato: true,
    gesto: "codigoempresa, codigopercalculo",
    unidade: "fechamento",
  },
  {
    id: "esocialcalc",
    rotulo: "eSocial calculado",
    descricao: "Base do eSocial apurada a partir da folha, antes de transmitir",
    familia: "folha",
    tabela: "calculoesocial",
    porContrato: true,
    gesto: "codigoempresa, codigopercalculo",
    unidade: "apuração",
  },
  {
    id: "provisoes",
    rotulo: "Provisão de 13º",
    descricao: "Provisão de décimo terceiro calculada",
    familia: "folha",
    tabela: "provisao13",
    porContrato: true,
    gesto: "codigoempresa, compet",
    unidade: "provisão",
  },
  {
    id: "afastamentos",
    rotulo: "Afastamentos",
    descricao: "Afastamento registrado (doença, acidente, licença)",
    familia: "cadastro",
    tabela: "afastamento",
    porContrato: true,
    unidade: "afastamento",
  },
  {
    id: "salarios",
    rotulo: "Reajustes",
    descricao: "Alteração de salário do contrato",
    familia: "cadastro",
    tabela: "funcsalario",
    porContrato: true,
    unidade: "reajuste",
  },
  {
    id: "cargos",
    rotulo: "Mudanças de cargo",
    descricao: "Alteração de cargo do contrato",
    familia: "cadastro",
    tabela: "funccargo",
    porContrato: true,
    unidade: "mudança",
  },
  {
    id: "esocial",
    rotulo: "eSocial transmitido",
    descricao: "Evento enviado ao eSocial — parte é rotina automática, parte é gente",
    familia: "esocial",
    tabela: "esocialtransacao",
    porContrato: false,
    temAutomacao: true,
    // A transmissão também é lote, só que sem coluna de lote: são 34.732 linhas
    // em ago/2026 — uma por funcionário — para 7.972 rodadas (empresa × evento ×
    // dia). Medi as alternativas: por minuto dá 14.562, o que conta retentativa
    // como gesto novo; só empresa × evento dá 4.826, o que funde o mês inteiro
    // num ato. O dia é o corte que corresponde a "mandei o S-1200 da empresa X
    // hoje". Sem isto o eSocial sozinho era 83% do total do DP.
    gesto: "codigoempresa, evento, datahoralcto::date",
    unidade: "rodada",
  },
];

const POR_ID = new Map(DP_TIPOS.map((t) => [t.id, t]));

export const infoDoTipo = (t: DpTipo): DpTipoInfo => POR_ID.get(t)!;

export const ehDpTipo = (v: string): v is DpTipo => POR_ID.has(v as DpTipo);

export const tiposDaFamilia = (f: DpFamilia): DpTipoInfo[] =>
  DP_TIPOS.filter((t) => t.familia === f);

/** Contagem por trabalho. Chave fechada: quem manda é o catálogo acima. */
export type DpPorTipo = Record<DpTipo, number>;

export const zeroPorTipo = (): DpPorTipo =>
  Object.fromEntries(DP_TIPOS.map((t) => [t.id, 0])) as DpPorTipo;

/** Uma linha do ranking: um usuário do Questor e quanto ele fez de cada tipo. */
export interface DpColaborador {
  codigo: number; // codigousuario
  nome: string;
  /** É o usuário 0 (ADMINISTRADOR / rotinas automáticas). */
  auto: boolean;
  /** Conta baixada no Questor (databaixausuario preenchida). */
  inativo: boolean;
  porTipo: DpPorTipo;
  total: number;
}

/**
 * Contagem de um período — por tipo (em GESTOS), mais o total e, à parte, as
 * LINHAS de cada tipo. Os dois números coexistem porque respondem a perguntas
 * diferentes: quantas vezes o trabalho foi feito, e sobre quantos funcionários.
 */
export interface DpContagem {
  porTipo: DpPorTipo;
  total: number;
  linhas: DpPorTipo;
}

/** Cabeçalho do dashboard: ranking + totais do período (e do anterior, p/ delta). */
export interface DpResumo {
  ranking: DpColaborador[];
  totais: DpContagem;
  anterior: DpContagem;
  /** Colaboradores humanos (codigousuario ≠ 0) com ao menos um trabalho no período. */
  colaboradores: number;
}

/** Item de uma quebra (por empresa, por colaborador): um rótulo e sua contagem. */
export interface DpQuebraItem {
  codigo: number;
  nome: string;
  qtd: number;
}

/** Um ponto da série temporal de um tipo: o bucket (dia ou mês) e a contagem. */
export interface DpSeriePonto {
  bucket: string; // "YYYY-MM-DD" (dia) ou "YYYY-MM" (mês)
  qtd: number;
}

/**
 * Recorte de UM trabalho no período — o que alimenta a aba completa daquele
 * tipo: quebra por empresa e evolução no tempo. A quebra por colaborador sai do
 * ranking (já carregado), então não repete aqui. Respeita o usuário selecionado.
 */
export interface DpQuebra {
  porEmpresa: DpQuebraItem[];
  granularidade: "dia" | "mes";
  serie: DpSeriePonto[];
}

/** Status do S-2200 (admissão) no eSocial, derivado da última transação do contrato. */
export type EsocialStatus = "ok" | "pendente" | "nao_enviado";

/**
 * Uma linha de detalhe. Campos comuns sempre vêm; os específicos do tipo são
 * opcionais e só a aba correspondente os exibe — evita doze tipos quase iguais.
 */
export interface DpLinha {
  codigoempresa: number;
  empresa: string;
  contrato: number;
  funcionario: string;
  usuario: string;
  codigousuario: number;
  /** Quando o trabalho foi lançado/calculado (datahoralcto), "YYYY-MM-DDTHH:MM:SS". */
  quando: string;
  // avisos / rescisões
  causa?: string | null;
  dataAviso?: string | null;
  dataResc?: string | null;
  // admissões
  dataAdm?: string | null;
  origem?: string | null;
  esocial?: EsocialStatus;
  // férias
  inicioFerias?: string | null;
  fimFerias?: string | null;
  periodoAquisitivo?: string | null;
  dataPgto?: string | null;
  // eSocial transmitido — sem contrato, o alvo é o próprio evento
  evento?: string | null;
}
