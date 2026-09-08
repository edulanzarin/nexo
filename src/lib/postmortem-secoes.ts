import { Calculator, ClipboardList, LayoutGrid, Receipt, Scale, Users } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";
import { SETORES_PM } from "./postmortem-setores";

/**
 * Seções do módulo Post Mortem — uma por SETOR, mais a Geral.
 *
 * O recorte é o mesmo das Obrigações e pelo mesmo motivo: o trabalho do
 * escritório se divide por setor, e uma seção por área é o que deixa a permissão
 * significar alguma coisa (o Fiscal preenche o do Fiscal e não lê o do
 * Societário). Dentro da seção do setor, cada pessoa vê os SEUS relatórios — a
 * posse por linha é do autor.
 *
 * A **Geral** é a leitura de coordenação: todos os relatórios, de todos os
 * setores. Seção separada porque a doutrina de permissão é binária — restringir
 * o que se enxerga numa tela é separar em outra seção e não concedê-la.
 *
 * As seções de setor saem de `SETORES_PM`: setor novo aparece na sidebar, no
 * cadastro de cargo e na matriz de permissão sozinho.
 */
const ICONE: Record<string, SecaoFiscal["icone"]> = {
  dp: Users,
  fiscal: Receipt,
  contabil: Calculator,
  societario: Scale,
};

export const SECOES_POSTMORTEM: SecaoFiscal[] = [
  // A Geral vem primeiro: é a home de quem coordena, e `primeiraSecaoPath`
  // entrega a 1ª visível — quem só tem o próprio setor cai nele do mesmo jeito.
  {
    id: "geral",
    icone: LayoutGrid,
    rotulo: "Visão geral",
    path: "/post-mortem/geral",
    metrica: false,
    descricao: "Todos os relatórios do escritório, de todos os setores",
  },
  ...SETORES_PM.map(
    (s): SecaoFiscal => ({
      id: s.id,
      icone: ICONE[s.id] ?? ClipboardList,
      rotulo: s.rotulo,
      path: `/post-mortem/${s.id}`,
      metrica: false,
      descricao: `Relatórios do ${s.rotulo}: preencha e acompanhe os seus`,
    })
  ),
];

export function secaoPostMortemAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_POSTMORTEM.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
