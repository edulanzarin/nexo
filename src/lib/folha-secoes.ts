import {
  ClipboardList,
  Gauge,
  HandCoins,
  LayoutDashboard,
  LayoutGrid,
  Plane,
  Repeat,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";

/**
 * Seções do módulo Folha. Mesmo recorte `SecaoFiscal` do Fiscal (uma seção =
 * um item de sidebar). Seção nova é uma entrada aqui.
 *
 * `metrica` (toggle Valor|Quantidade) não existe na Folha, mas o campo é do tipo
 * compartilhado — fica `false`.
 */
export const SECOES_FOLHA: SecaoFiscal[] = [
  // Painel é a HOME do módulo: as primeiras seções (o índice /folha cai na 1ª
  // visível) e carregam sozinhas, sem barra de filtro/Executar (ver shell). São
  // DOIS, liberados por cargo: o colaborador vê a fila de trabalho (pendências);
  // o gestor vê também a atividade/produtividade. Quem tiver só um cai nele; o
  // recorte por cargo é permissão binária (uma seção por perfil).
  //
  // Gestão vem PRIMEIRO de propósito: admin enxerga as duas (podeSecao libera
  // tudo pra ele) e `primeiraSecaoPath` entrega a 1ª visível — enquanto o Painel
  // simples vinha antes, o adm caía no painel do colaborador.
  {
    id: "painel-gestao",
    icone: LayoutDashboard,
    rotulo: "Painel · Gestão",
    path: "/folha/painel-gestao",
    metrica: false,
    descricao: "Visão do gestor: pendências + atividade do DP no mês e ranking",
  },
  {
    id: "painel",
    icone: LayoutGrid,
    rotulo: "Painel",
    path: "/folha/painel",
    metrica: false,
    descricao: "Fila do DP: rescisões a pagar, férias vencidas e eSocial a resolver",
  },
  {
    id: "rotatividade",
    icone: Repeat,
    rotulo: "Rotatividade",
    path: "/folha/rotatividade",
    metrica: false,
    descricao: "Turnover: admissões e desligamentos sobre o efetivo",
  },
  {
    id: "produtividade",
    icone: Gauge,
    rotulo: "Produtividade",
    path: "/folha/produtividade",
    metrica: false,
    descricao: "O que o DP fez no período, por colaborador",
  },
  // Seção nova entra por último (ver memória de ordem da sidebar).
  {
    id: "custo",
    icone: Wallet,
    rotulo: "Custo de Folha",
    path: "/folha/custo",
    metrica: false,
    descricao: "Quanto a folha custa: proventos por rubrica, tipo e setor",
  },
  {
    id: "esocial",
    icone: ShieldCheck,
    rotulo: "eSocial",
    path: "/folha/esocial",
    metrica: false,
    descricao: "Conformidade: eventos aceitos, pendentes e rejeitados",
  },
  {
    id: "ferias",
    icone: Plane,
    rotulo: "Férias",
    path: "/folha/ferias",
    metrica: false,
    descricao: "Férias vencidas e a vencer — risco de dobro",
  },
  {
    id: "rescisoes",
    icone: HandCoins,
    rotulo: "Rescisões a pagar",
    path: "/folha/rescisoes",
    metrica: false,
    descricao: "Prazo de pagamento (CLT 477): vencidas, a vencer e avisos por e-mail",
  },
  // Relatório Post Mortem do DP. Duas seções pela doutrina de permissão binária
  // (restringir o que se faz = separar em outra seção): o analista preenche e vê
  // os SEUS; o gestor tem também a de Gestão, que vê TODOS.
  {
    id: "post-mortem",
    icone: ClipboardList,
    rotulo: "Relatório Post Mortem",
    path: "/folha/post-mortem",
    metrica: false,
    descricao: "Análise de incidente do DP: preencha e acompanhe os seus",
  },
  {
    id: "post-mortem-gestao",
    icone: LayoutDashboard,
    rotulo: "Post Mortem · Gestão",
    path: "/folha/post-mortem-gestao",
    metrica: false,
    descricao: "Todos os relatórios do DP: consulta, extração e indicadores",
  },
];

export function secaoFolhaAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_FOLHA.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
