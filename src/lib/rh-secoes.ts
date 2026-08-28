import { CalendarClock, FileText, Gauge, LayoutGrid, Repeat, ShieldAlert, Target, UserCog, Users } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";

/**
 * Seções do módulo RH (interno da Navecon — só NAVECON e FOUR). Mesmo recorte
 * `SecaoFiscal` dos outros módulos (uma seção = um item de sidebar). O toggle
 * Valor|Quantidade não existe aqui, então `metrica` fica `false`.
 *
 * Gestores é a seção de cadastro (quem recebe o formulário de experiência);
 * fica por último, como configuração.
 */
export const SECOES_RH: SecaoFiscal[] = [
  // Painel é a HOME do módulo: primeira seção (o índice /rh cai na 1ª visível).
  // A casca do RH já é self-contained (sem barra de filtro), então o painel só
  // carrega — nenhum tratamento especial no shell.
  {
    id: "painel",
    icone: LayoutGrid,
    rotulo: "Painel",
    path: "/rh/painel",
    metrica: false,
    descricao: "Retrato do RH: pendências (experiências, denúncias, clima) e panorama do mês",
  },
  {
    id: "diretorio",
    icone: Users,
    rotulo: "Diretório",
    path: "/rh/diretorio",
    metrica: false,
    descricao: "Funcionários das empresas do RH, com filtro e ficha",
  },
  {
    id: "experiencia",
    icone: CalendarClock,
    rotulo: "Experiência",
    path: "/rh/experiencia",
    metrica: false,
    descricao: "Contratos em experiência: avaliação de 45 e 90 dias",
  },
  {
    id: "desempenho",
    icone: Target,
    rotulo: "Desempenho",
    path: "/rh/desempenho",
    metrica: false,
    descricao: "Avaliação de desempenho do colaborador, respondida pelos gestores do setor",
  },
  {
    id: "formularios",
    icone: FileText,
    rotulo: "Formulários",
    path: "/rh/formularios",
    metrica: false,
    descricao: "Monte formulários e envie aos gestores (manual ou automático)",
  },
  {
    id: "rotatividade",
    icone: Repeat,
    rotulo: "Rotatividade",
    path: "/rh/rotatividade",
    metrica: false,
    descricao: "Turnover das empresas do RH",
  },
  {
    id: "denuncias",
    icone: ShieldAlert,
    rotulo: "Denúncias",
    path: "/rh/denuncias",
    metrica: false,
    descricao: "Canal anônimo de denúncia: fila, tratativa e status",
  },
  {
    id: "clima",
    icone: Gauge,
    rotulo: "Avaliações",
    path: "/rh/clima",
    metrica: false,
    descricao: "Avaliação anônima da empresa: eNPS, temas e comentários",
  },
  {
    id: "gestores",
    icone: UserCog,
    rotulo: "Gestores",
    path: "/rh/gestores",
    metrica: false,
    descricao: "Supervisores e coordenadores por setor",
  },
];

export function secaoRhAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_RH.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
