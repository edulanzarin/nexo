import { ClipboardCheck, FileSpreadsheet, Import, Landmark, LayoutGrid, ListChecks, Scale, ScanSearch, Table2 } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";

/**
 * Uma aba dentro de uma seção. Vira aba, e não item de sidebar, quando as telas
 * são ângulos do mesmo trabalho e compartilham o filtro.
 */
export interface AbaContabil {
  id: string;
  rotulo: string;
  path: string;
  descricao: string;
  /** Cadastro fixo por empresa: sem recorte de tempo. */
  semPeriodo?: boolean;
  /** Período por MÊS em vez de por dia (o balancete é mensal). */
  periodoMensal?: boolean;
  /**
   * Como a tela dispara sua consulta ([[executar-com-botao]]):
   * - ausente → botão "Executar" (consulta que computa algo);
   * - string  → botão com esse rótulo ("Carregar" quando só traz cadastro);
   * - null    → aplicação imediata, sem botão — a tela tem gatilho próprio
   *   (na Conciliação, quem executa é o envio do extrato, não a barra).
   */
  execucao?: string | null;
}

export interface SecaoContabil extends SecaoFiscal {
  abas: AbaContabil[];
}

/**
 * Seções do módulo Contábil. Cada seção é um assunto próprio — a aba pertence à
 * seção pelo `abas`, não por prefixo de caminho, porque nem toda aba mora sob o
 * caminho da seção (a Configuração do plano de contabilização, por exemplo).
 */
export const SECOES_CONTABIL: SecaoContabil[] = [
  // Painel é a HOME do módulo: primeira seção (o índice /contabil cai na 1ª
  // visível) e a única self-contained — carrega sozinha, sem barra de filtro nem
  // Executar (ver shell). É o placar da automação (o que o time rodou + a base
  // configurada), não a automação: conciliação e cia continuam se rodando.
  {
    id: "painel",
    rotulo: "Painel",
    icone: LayoutGrid,
    path: "/contabil/painel",
    metrica: false,
    descricao: "Retrato do Contábil: o que o time rodou e a base configurada",
    abas: [
      {
        id: "painel",
        rotulo: "Painel",
        path: "/contabil/painel",
        descricao: "Contadores de atividade (conciliações, laudos…) e a base configurada",
        semPeriodo: true,
        execucao: null,
      },
    ],
  },
  // Conciliação: o trabalho do dia a dia (era a home antes do Painel).
  {
    id: "conciliacao",
    rotulo: "Conciliação Bancária",
    icone: Landmark,
    path: "/contabil/conciliacao",
    metrica: false,
    descricao: "Extrato bancário → lançamentos",
    // Importar primeiro: é o que se faz no dia a dia. As regras são cadastro,
    // mexidas de vez em quando — por isso a raiz da seção é a importação.
    abas: [
      {
        id: "importar",
        rotulo: "Importar",
        path: "/contabil/conciliacao",
        descricao: "Ler OFX ou PDF e gerar os lançamentos",
        semPeriodo: true,
        // Quem executa aqui é o envio do extrato; a empresa é só contexto.
        execucao: null,
      },
      {
        id: "regras",
        rotulo: "Regras",
        path: "/contabil/conciliacao/regras",
        descricao: "Contrapartida de cada descrição do extrato",
        semPeriodo: true,
        // Cadastro leve: escolher a conta já é o gesto, sem botão.
        execucao: null,
      },
    ],
  },
  {
    id: "conferencia",
    rotulo: "Conferência Fiscal",
    icone: ClipboardCheck,
    path: "/contabil/conferencia",
    metrica: false,
    descricao: "Notas fiscais × contabilidade",
    abas: [
      {
        id: "conferencia",
        rotulo: "Conferência",
        path: "/contabil/conferencia",
        descricao: "Notas não contabilizadas e notas na conta errada",
      },
      {
        id: "configuracao",
        rotulo: "Configuração",
        path: "/contabil/configuracao",
        descricao: "Plano de contabilização por CFOP — vale para a empresa toda",
        semPeriodo: true,
        // Só traz o plano pronto do Questor, não computa nada: "Carregar".
        execucao: "Carregar",
      },
    ],
  },
  {
    id: "notas",
    rotulo: "Notas Fiscais",
    icone: Table2,
    path: "/contabil/notas",
    metrica: false,
    descricao: "Explorador de notas fiscais",
    // Uma tela só: seção própria na sidebar (como o Dados do Fiscal), sem abas.
    abas: [
      {
        id: "notas",
        rotulo: "Notas",
        path: "/contabil/notas",
        descricao: "Todas as notas do período, com itens e produtos",
      },
    ],
  },
  {
    id: "balancete",
    rotulo: "Balancete Fiscal",
    icone: Scale,
    path: "/contabil/balancete-fiscal",
    metrica: false,
    descricao: "Movimento esperado pelas regras × o real do contábil",
    // Uma tela só: o balancete tem o filtro "Só diferenças" embutido (que era a
    // aba Diferenças). A coluna Diferença já é o próprio drill — não faz sentido
    // duas telas pro mesmo dado.
    abas: [
      {
        id: "balancete",
        rotulo: "Balancete Fiscal",
        path: "/contabil/balancete-fiscal",
        descricao: "Balancete esperado pelas regras, comparado ao contábil real",
      },
    ],
  },
  {
    // id "analise" mantido: é a chave de permissão da seção (não renomear sem
    // migrar o gate). As duas abas moram sob /contabil/balancete-contabil, pra a
    // sidebar (que casa por prefixo do path da seção) manter o item ativo nas duas.
    id: "analise",
    rotulo: "Balancete Contábil",
    icone: FileSpreadsheet,
    path: "/contabil/balancete-contabil",
    metrica: false,
    descricao: "Balancete de verificação e análise",
    // Duas abas do mesmo trabalho, mesmo filtro (empresa + mês): montar o
    // balancete e, sobre ele, o laudo. Trocar de aba mantém o balancete
    // carregado (cache por empresa+período).
    abas: [
      {
        id: "balancete",
        rotulo: "Balancete",
        path: "/contabil/balancete-contabil",
        descricao: "Saldo anterior, movimento do período e saldo atual, por conta",
        periodoMensal: true,
        execucao: "Gerar",
      },
      {
        id: "analise",
        rotulo: "Análise",
        path: "/contabil/balancete-contabil/analise",
        descricao: "Pontos fortes, fracos, alertas e recomendações sobre o balancete",
        periodoMensal: true,
        execucao: "Analisar",
      },
    ],
  },
  // Implantação de Saldos: trabalho pontual de quando uma empresa entra no
  // escritório. Foi o último item enquanto só existiam as seções acima — mas a
  // ordem da sidebar é a desta lista, e a regra é "seção NOVA entra no fim"
  // (abaixo desta), não empurrar a Implantação pra baixo a cada adição.
  {
    id: "implantacao",
    rotulo: "Implantação de Saldos",
    icone: Import,
    path: "/contabil/implantacao",
    metrica: false,
    descricao: "Balancete de abertura (PDF) → arquivo de importação do Questor",
    // Uma tela só: subir o PDF do balancete, conferir o de-para e baixar o
    // arquivo. A empresa é o contexto; quem "executa" é o envio do PDF.
    abas: [
      {
        id: "implantar",
        rotulo: "Implantar",
        path: "/contabil/implantacao",
        descricao: "Subir o balancete anterior em PDF e gerar o arquivo de saldos",
        semPeriodo: true,
        execucao: null,
      },
    ],
  },
  // ── Seções acrescentadas depois entram daqui pra baixo, na ordem em que nascem ──
  {
    id: "auditoria",
    rotulo: "Auditoria de Lançamentos",
    icone: ScanSearch,
    path: "/contabil/auditoria",
    metrica: false,
    descricao: "Lançamentos com anomalia no período",
    // Uma tela só: varre o lctoctb e agrupa os achados por tipo. Período por DIA
    // (não mensal como o balancete) — dá para auditar um mês inteiro ou um
    // intervalo. Computa sobre a base, então roda no botão "Executar".
    abas: [
      {
        id: "auditoria",
        rotulo: "Auditoria",
        path: "/contabil/auditoria",
        descricao:
          "Conta sintética, conta fora do plano, sem histórico, ajuste de período anterior, manual em conta de controle e partida repetida",
        execucao: "Executar",
      },
    ],
  },
  {
    id: "pendencias",
    rotulo: "Central de Pendências",
    icone: ListChecks,
    path: "/contabil/pendencias",
    metrica: false,
    descricao: "Fila única de exceções — Conferência + Auditoria — com triagem",
    // Uma tela só: junta as pendências da Conferência (notas) e os achados da
    // Auditoria (lançamentos) numa fila com estado de triagem. Roda uma empresa
    // por vez sobre o período, como as duas telas de origem — botão "Executar".
    abas: [
      {
        id: "pendencias",
        rotulo: "Pendências",
        path: "/contabil/pendencias",
        descricao:
          "Notas não contabilizadas ou na conta errada + lançamentos anômalos, para resolver ou ignorar",
        execucao: "Executar",
      },
    ],
  },
  //
  // PARKED (fora do ar de propósito): Contas de Controle, Provisões e Fechamento
  // saíram da sidebar do Contábil. O código continua todo no repo, dormente —
  // páginas (src/app/contabil/{contas-controle,provisoes,fechamento}), rotas
  // (src/app/api/contabil/{contas-controle,provisoes,fechamento}), libs
  // (contas-controle.ts, provisoes.ts, fechamento.ts) e hooks. Para religar,
  // reponha aqui a seção correspondente (ver git em contabil-secoes.ts) e o ícone
  // (Layers / Umbrella / ListChecks) no import. Provisões, em especial, precisa
  // antes rever a conferência: a provisão NÃO é folha 70/71, mora em
  // provisaoferias(emdias)/provisao13 e o contábil mistura accrual com baixa
  // (ver nota do Módulo de folha do Questor no Brain).
];

const TODAS_ABAS: { aba: AbaContabil; secao: SecaoContabil }[] = SECOES_CONTABIL.flatMap((secao) =>
  secao.abas.map((aba) => ({ aba, secao }))
)
  // Mais específica primeiro: /conciliacao/regras antes de /conciliacao.
  .sort((a, b) => b.aba.path.length - a.aba.path.length);

function casar(pathname: string) {
  return TODAS_ABAS.find(
    ({ aba }) => pathname === aba.path || pathname.startsWith(aba.path + "/")
  );
}

export function abaContabilAtual(pathname: string): AbaContabil | undefined {
  return casar(pathname)?.aba;
}

export function secaoContabilAtual(pathname: string): SecaoContabil | undefined {
  return casar(pathname)?.secao;
}

/** Abas da seção a que o caminho pertence — vazio quando não pertence a nenhuma. */
export function abasDaSecao(pathname: string): AbaContabil[] {
  return casar(pathname)?.secao.abas ?? [];
}

/**
 * Mostrar seletor de período numa tela de cadastro sugeriria que a regra vale
 * só naquele mês, o que não é verdade.
 */
export function abaUsaPeriodo(pathname: string): boolean {
  return !casar(pathname)?.aba.semPeriodo;
}

/** A aba escolhe período por mês (balancete), não por dia? */
export function abaUsaPeriodoMensal(pathname: string): boolean {
  return !!casar(pathname)?.aba.periodoMensal;
}

/** Como a aba executa: com botão (e qual rótulo) ou aplicação imediata. */
export function execucaoDaAba(pathname: string): { imediata: boolean; rotulo: string } {
  const execucao = casar(pathname)?.aba.execucao;
  if (execucao === null) return { imediata: true, rotulo: "" };
  return { imediata: false, rotulo: execucao ?? "Executar" };
}
