import type {
  ClasseInfo,
  PorClasseGen,
  ProdCalendario,
  ProdDia,
  ProdItem,
  SeriePontoGen,
} from "./prod-tipos";

/**
 * Tipos e catálogo da aba NO NEXO das Produtividades — o trabalho que o time
 * fez DENTRO deste app, não dentro do Questor.
 *
 * As outras abas contam o que o time deixou no ERP (lançamentos, notas, horas
 * de `tempouso`). Nenhuma delas enxerga o que o Nexo automatizou: uma
 * conciliação que gerou 300 lançamentos aparece lá como 300 linhas de origem
 * "CC", sem nome de quem apertou o botão nem quantas vezes. Aqui o fato é a
 * própria trilha de auditoria (`auditoria`, no banco do APP), que carrega autor,
 * carimbo, empresa e o detalhe de cada gesto.
 *
 * Três consequências, e as três são de propósito:
 *
 * 1. **É a única aba da seção que responde com o Questor fora do ar.** O fato
 *    mora no banco do app. O Questor só é tocado para dar NOME às empresas, e
 *    isso é best-effort: sem ele a tela abre com "Empresa 1200" no lugar da
 *    razão social, em vez de não abrir.
 * 2. **A pessoa é um uuid, não um código numérico.** Quem opera o Questor tem
 *    `codigousuario` inteiro; quem opera o Nexo tem `usuario.id` uuid. Em vez de
 *    o payload inventar um número, o ranking e o filtro de pessoa passaram a ser
 *    genéricos na chave.
 * 3. **A trilha só sabe o que foi instrumentado.** Gesto sem
 *    `registrarAuditoria` não existe aqui — a aba mede a instrumentação tanto
 *    quanto o trabalho. Por isso o catálogo abaixo é a lista fechada do que o
 *    app registra hoje, e ação fora dele cai em "outros" com o verbo cru à
 *    mostra, para denunciar a falta em vez de escondê-la.
 */

/**
 * Um tipo de trabalho no app. `tipo` separa o que DEIXOU alguma coisa pronta do
 * que só puxou dado para olhar — sem essa separação, "quem mais exportou" sobe
 * no ranking como se tivesse produzido mais que quem conciliou.
 */
export interface TrabalhoApp extends ClasseInfo {
  tipo: "producao" | "leitura";
  /** Verbos da trilha (`auditoria.acao`) que caem nesta classe. */
  acoes: string[];
}

/**
 * Catálogo do CONTÁBIL. O módulo é bancada: quase tudo aqui produziu alguma
 * coisa, e por isso as cinco classes de produção ficam com a paleta categórica
 * inteira (`--esp-1..5`) e a leitura inteira — consulta, nota aberta e
 * exportação — divide o cinza. Ao lado do que a conciliação gera, distinguir
 * "exportou" de "consultou" no gráfico empilhado seria ruído.
 */
export const TRABALHOS_CONTABIL: TrabalhoApp[] = [
  {
    id: "conciliacao",
    rotulo: "Conciliação",
    descricao: "Extrato bancário virou lançamento",
    cor: "var(--esp-1)",
    tipo: "producao",
    acoes: ["contabil.conciliacao.gerar"],
  },
  {
    id: "laudo",
    rotulo: "Laudo",
    descricao: "Análise do balancete gerada",
    cor: "var(--esp-2)",
    tipo: "producao",
    acoes: ["contabil.laudo.gerar"],
  },
  {
    id: "implantacao",
    rotulo: "Implantação",
    descricao: "Saldos de abertura gerados do PDF",
    cor: "var(--esp-3)",
    tipo: "producao",
    acoes: ["contabil.implantacao.gerar"],
  },
  {
    id: "triagem",
    rotulo: "Triagem",
    descricao: "Pendência resolvida ou ignorada",
    cor: "var(--esp-4)",
    tipo: "producao",
    acoes: ["contabil.pendencia.triar"],
  },
  {
    id: "base",
    rotulo: "Cadastro e regras",
    descricao: "Plano de contabilização e regras de extrato",
    cor: "var(--esp-5)",
    tipo: "producao",
    acoes: [
      "contabil.plano.salvar",
      "contabil.plano.reverter",
      "contabil.plano.replicar",
      "contabil.plano.aprender",
      "contabil.regra.salvar",
      "contabil.regra.remover",
      "contabil.regra.replicar",
    ],
  },
  {
    id: "leitura",
    rotulo: "Consulta e exportação",
    descricao: "Puxou dado para olhar ou levar embora",
    cor: "var(--esp-outras)",
    tipo: "leitura",
    acoes: ["contabil.consulta", "contabil.nota.ver", "contabil.export"],
  },
];

/**
 * Catálogo do FISCAL, e ele é assimétrico ao do Contábil de propósito: **o
 * Fiscal não produz nada dentro do Nexo**. O módulo é seis seções de painel
 * sobre uma base somente leitura — não há um botão ali que grave qualquer
 * coisa. O que o fiscal produz está nas outras quatro abas desta seção, que
 * leem o Questor.
 *
 * Então onde o Contábil junta a leitura num cinza só, aqui a leitura É o
 * assunto e ganha a paleta: consultar uma varredura de 40 s sobre o escritório
 * inteiro, abrir a nota para conferir e levar a planilha são gestos diferentes,
 * com custo diferente, e quem opera sabe a diferença. Ver [[Componente que
 * serve dois donos recebe o catálogo, não o campo renomeado]] — o catálogo é
 * de cada módulo justamente para caber a diferença.
 */
export const TRABALHOS_FISCAL: TrabalhoApp[] = [
  {
    id: "consulta",
    rotulo: "Consulta",
    descricao: "Uma varredura pedida no botão Executar",
    cor: "var(--esp-1)",
    tipo: "leitura",
    acoes: ["fiscal.consulta"],
  },
  {
    id: "nota",
    rotulo: "Nota aberta",
    descricao: "Abriu o detalhe de uma nota para conferir",
    cor: "var(--esp-2)",
    tipo: "leitura",
    acoes: ["fiscal.nota.ver"],
  },
  {
    id: "export",
    rotulo: "Exportação",
    descricao: "Levou o recorte embora em planilha",
    cor: "var(--esp-3)",
    tipo: "leitura",
    acoes: ["fiscal.export"],
  },
];

/** A classe que recolhe verbo fora do catálogo — existe para denunciar, não para esconder. */
export const TRABALHO_OUTROS: TrabalhoApp = {
  id: "outros",
  rotulo: "Outros",
  descricao: "Ação registrada que ainda não tem classe",
  cor: "var(--esp-outras)",
  tipo: "leitura",
  acoes: [],
};

/** Módulos que têm a aba No Nexo. Não é `ModuloId` inteiro: Folha e RH não têm. */
export type ModuloApp = "contabil" | "fiscal";

/**
 * Catálogo do módulo, já com o "Outros" no fim. O Contábil não repete o cinza
 * (a classe `leitura` dele já o usa) — lá o desconhecido cai na própria leitura
 * ao ser classificado, e o "Outros" só aparece quando de fato sobra algo.
 */
export function trabalhosDe(modulo: ModuloApp): TrabalhoApp[] {
  return modulo === "contabil"
    ? [...TRABALHOS_CONTABIL, TRABALHO_OUTROS]
    : [...TRABALHOS_FISCAL, TRABALHO_OUTROS];
}

/** Só a forma que os gráficos consomem — sem `tipo`/`acoes`, que são nossos. */
export const classesDe = (modulo: ModuloApp): ClasseInfo[] => trabalhosDe(modulo);

/** Índice ação -> classe, montado uma vez por módulo. */
const INDICE: Record<ModuloApp, Map<string, string>> = {
  contabil: new Map(TRABALHOS_CONTABIL.flatMap((t) => t.acoes.map((a) => [a, t.id]))),
  fiscal: new Map(TRABALHOS_FISCAL.flatMap((t) => t.acoes.map((a) => [a, t.id]))),
};

/** Verbo da trilha -> id do catálogo. O que não está mapeado vira "outros". */
export function classeDaAcao(modulo: ModuloApp, acao: string): string {
  return INDICE[modulo].get(acao) ?? TRABALHO_OUTROS.id;
}

/** Os ids de produção do módulo — o que conta como trabalho concluído. */
export function idsDeProducao(modulo: ModuloApp): string[] {
  return trabalhosDe(modulo)
    .filter((t) => t.tipo === "producao")
    .map((t) => t.id);
}

/** Uma ação da trilha vista de perto: o verbo cru, com quantas vezes aconteceu. */
export interface AcaoApp extends ProdItem {
  /** Classe do catálogo a que o verbo pertence. */
  classe: string;
  /** Quantas pessoas distintas fizeram isso no período. */
  pessoas: number;
}

/**
 * Uma pessoa do time no período. Carrega os próprios recortes (classes, ações,
 * empresas, horas, dias) para a tela isolar alguém sem nova ida ao banco — a
 * mesma doutrina das outras abas, e aqui é ainda mais barato porque a trilha é
 * pequena.
 */
export interface AppPessoa {
  /** `usuario.id` (uuid) — ou "removido" quando o usuário já foi apagado. */
  codigo: string;
  nome: string;
  /** Usuário desativado no Nexo (ou removido). */
  inativo: boolean;
  /** Tudo que a pessoa registrou no período. */
  eventos: number;
  /** Só o que produziu alguma coisa. */
  producao: number;
  /** Só o que foi puxar dado. */
  leitura: number;
  empresas: number;
  diasAtivos: number;
  ultimo: string | null;
  porClasse: PorClasseGen;
  acoes: { chave: string; qtd: number }[];
  topEmpresas: ProdItem[];
  porHora: number[];
  serie: ProdDia[];
}

export interface AppTotais {
  eventos: number;
  producao: number;
  leitura: number;
  pessoas: number;
  empresas: number;
  diasAtivos: number;
  porClasse: PorClasseGen;
}

export interface ProdAppResp {
  modulo: ModuloApp;
  periodo: { inicio: string; fim: string; granularidade: "dia" | "mes" };
  totais: AppTotais;
  /** Mesmo tamanho de período, imediatamente antes — para o delta dos KPIs. */
  anterior: { eventos: number; producao: number };
  ranking: AppPessoa[];
  acoes: AcaoApp[];
  empresas: ProdItem[];
  porHora: number[];
  serie: SeriePontoGen[];
  calendario: ProdCalendario;
  /**
   * Nomes de empresa vieram do Questor? Falso quando ele estava fora e a tela
   * está mostrando "Empresa 1200" — a tela avisa em vez de deixar o usuário
   * achar que o cadastro sumiu.
   */
  nomesResolvidos: boolean;
}
