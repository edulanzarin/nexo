import {
  Coins,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Table2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/** Seções do módulo Fiscal — dirigem a sidebar, o header e a visibilidade da métrica. */
export interface SecaoFiscal {
  id: string;
  rotulo: string;
  path: string;
  /** Se o toggle Valor|Quantidade faz sentido nessa seção. */
  metrica: boolean;
  descricao: string;
  /**
   * Abas da seção, quando ela tem mais de um ângulo do MESMO trabalho (só a
   * Produtividade tem, hoje). Uma aba não é uma seção: divide a tela, não a
   * permissão — quem alcança a seção alcança todas as suas abas, e todas
   * compartilham a mesma barra de filtro.
   */
  abas?: AbaFiscal[];
  /**
   * Ícone da sidebar. Fica aqui, e não num mapa à parte por id, para o
   * TypeScript cobrar um ícone de toda seção nova — num mapa, esquecer passa
   * despercebido e a seção aparece sem ícone no meio das outras.
   */
  icone: LucideIcon;
}

/** Uma aba dentro de uma seção do Fiscal. */
export interface AbaFiscal {
  id: string;
  rotulo: string;
  path: string;
  descricao: string;
}

export const SECOES_FISCAL: SecaoFiscal[] = [
  {
    id: "painel",
    icone: LayoutDashboard,
    rotulo: "Painel",
    path: "/fiscal/painel",
    metrica: true,
    descricao: "Resumo da movimentação",
  },
  {
    id: "analises",
    icone: TrendingUp,
    rotulo: "Análises",
    path: "/fiscal/analises",
    metrica: true,
    descricao: "Rankings e distribuições",
  },
  {
    id: "tributos",
    icone: Coins,
    rotulo: "Tributos",
    path: "/fiscal/tributos",
    metrica: false,
    descricao: "Carga, DIFAL e regime (CST)",
  },
  {
    id: "produtividade",
    icone: Gauge,
    rotulo: "Produtividade",
    path: "/fiscal/produtividade",
    metrica: false,
    descricao: "Notas, impostos, atraso, carteira, tempo e o uso do próprio app",
    // Cinco ÂNGULOS do mesmo trabalho, espelhando a Produtividade do Contábil,
    // cada um com sua própria varredura: o que o time ESCRITUROU (Lançamentos),
    // que PESO fiscal isso tinha (Impostos), com quanto ATRASO em relação à
    // competência, QUEM foi atendido (Carteira) e quanto TEMPO custou. Só os
    // dois primeiros saem das notas; os outros vêm da distância entre as duas
    // datas, do cadastro de estabelecimentos e do `tempouso`.
    abas: [
      {
        id: "lancamentos",
        rotulo: "Lançamentos",
        path: "/fiscal/produtividade",
        descricao:
          "Notas escrituradas por pessoa, espécie, empresa, dia e hora — quem alimentou o fiscal",
      },
      {
        id: "impostos",
        rotulo: "Impostos",
        path: "/fiscal/produtividade/impostos",
        descricao:
          "Quanto de ICMS, IPI, ST, ISS, PIS/COFINS e retenção passou pelas mãos de cada pessoa",
      },
      {
        id: "atraso",
        rotulo: "Atraso",
        path: "/fiscal/produtividade/atraso",
        descricao:
          "Distância entre a data do documento e o dia em que foi escriturado — que competência o time está fechando",
      },
      {
        id: "carteira",
        rotulo: "Carteira",
        path: "/fiscal/produtividade/carteira",
        descricao: "Cobertura da carteira fiscal: empresas com movimento, paradas e há quanto tempo",
      },
      {
        id: "tempo",
        rotulo: "Tempo",
        path: "/fiscal/produtividade/tempo",
        descricao: "Horas dentro do Questor por pessoa e por empresa, cruzadas com as notas do período",
      },
      // Sexto ângulo, e o único que não lê o Questor: o uso do próprio Nexo.
      // Diferente do Contábil, aqui ele NÃO mede produção — o módulo Fiscal é
      // painel sobre base somente leitura, não há botão que grave nada. Mede
      // quem puxou o quê: varredura executada, nota aberta, planilha levada. A
      // tela diz isso na cara, em vez de vender consulta como trabalho.
      {
        id: "app",
        rotulo: "No Nexo",
        path: "/fiscal/produtividade/app",
        descricao:
          "O uso do app no período: varreduras executadas, notas abertas e exportações, por pessoa e empresa",
      },
    ],
  },
  {
    id: "conformidade",
    icone: ShieldCheck,
    rotulo: "Conformidade",
    path: "/fiscal/conformidade",
    metrica: false,
    descricao: "Pendências e saúde fiscal",
  },
  {
    id: "dados",
    icone: Table2,
    rotulo: "Dados",
    path: "/fiscal/dados",
    metrica: false,
    descricao: "Todas as notas, com filtros",
  },
];

export function secaoAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_FISCAL.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}

/** Abas da seção a que o caminho pertence — vazio quando a seção não tem abas. */
export function abasFiscalDaSecao(pathname: string): AbaFiscal[] {
  return secaoAtual(pathname)?.abas ?? [];
}

/**
 * Aba atual. Casa a MAIS ESPECÍFICA primeiro: `/produtividade/impostos` antes de
 * `/produtividade`, que é prefixo de todas.
 */
export function abaFiscalAtual(pathname: string): AbaFiscal | undefined {
  return [...abasFiscalDaSecao(pathname)]
    .sort((a, b) => b.path.length - a.path.length)
    .find((a) => pathname === a.path || pathname.startsWith(a.path + "/"));
}
