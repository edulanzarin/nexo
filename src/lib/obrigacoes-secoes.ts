import { Calculator, LayoutGrid, Receipt, Settings, Users } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";

/**
 * Seções do módulo Obrigações — a fila de entregas do Acessórias.
 *
 * O recorte das seções é o SETOR, e não por acaso: no Acessórias toda entrega
 * nasce dentro de um departamento, e é assim que o escritório divide o trabalho.
 * Uma seção por área também é o que deixa a permissão fazer sentido — o time do
 * Contábil recebe a seção Contábil e não vê a fila do Fiscal.
 *
 * A varredura traz TODOS os setores de uma vez (filtrar na API não economiza
 * chamada, ver `acessorias.ts`), então abrir uma área nova aqui é só listar os
 * ids dela — nenhum custo de sincronização a mais.
 */
export interface SecaoObrigacoes extends SecaoFiscal {
  /**
   * Ids de departamento do Acessórias que a seção mostra. Vazio = todos (a
   * visão de escritório). Os ids são os do Acessórias, não do Nexo.
   */
  setores: number[];
}

export const SECOES_OBRIGACOES: SecaoObrigacoes[] = [
  // Visão geral primeiro: é a home do módulo e a única sem recorte de setor.
  {
    id: "geral",
    icone: LayoutGrid,
    rotulo: "Visão geral",
    path: "/obrigacoes/geral",
    metrica: false,
    descricao: "Fila de entregas do escritório inteiro, por setor e responsável",
    setores: [],
  },
  // 1 Contábil - Balanço Balancetes, 50 Célula Contábil, 27 Lançamentos.
  {
    id: "contabil",
    icone: Calculator,
    rotulo: "Contábil",
    path: "/obrigacoes/contabil",
    metrica: false,
    descricao: "Balancetes, movimentação financeira e escriturações pendentes",
    setores: [1, 50, 27],
  },
  // 2 Fiscal - Faturamento - Notas.
  {
    id: "fiscal",
    icone: Receipt,
    rotulo: "Fiscal",
    path: "/obrigacoes/fiscal",
    metrica: false,
    descricao: "Guias, apurações e declarações fiscais pendentes",
    setores: [2],
  },
  // 3 Pessoal - Empregados - Folha.
  {
    id: "dp",
    icone: Users,
    rotulo: "DP",
    path: "/obrigacoes/dp",
    metrica: false,
    descricao: "Folha, encargos e obrigações de pessoal pendentes",
    setores: [3],
  },
  // Última, e de propósito à parte das áreas: aqui não se lê fila, se OPERA a
  // varredura. Seção própria porque a doutrina de permissão é binária —
  // restringir o que se faz numa tela é separar em outra seção e não concedê-la
  // (ver [[Posse numa permissão binária é duas seções e recorte por linha]]).
  // Nenhum cargo a recebe por padrão: quem opera a varredura é quem administra.
  {
    id: "configuracoes",
    icone: Settings,
    rotulo: "Configurações",
    path: "/obrigacoes/configuracoes",
    metrica: false,
    descricao: "Varredura do Acessórias: estado, progresso e disparo manual",
    setores: [],
  },
];

export function secaoObrigacoesAtual(pathname: string): SecaoObrigacoes | undefined {
  return SECOES_OBRIGACOES.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}

/** Setores da seção, pelo id. `undefined` quando a seção não existe. */
export function setoresDaSecao(id: string): number[] | undefined {
  return SECOES_OBRIGACOES.find((s) => s.id === id)?.setores;
}
