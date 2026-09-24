import { SECAO_PM, SECAO_PM_GESTAO } from "../postmortem-secoes";
import { setorDoModulo } from "../postmortem-setores";
import { abaAutonoma, type Secao } from "./tipos";

/**
 * As seções de Post Mortem do módulo, ou vazio se o módulo não tem setor que
 * preencha relatório (RH, Obrigações, Configurações).
 */
export function secoesPostMortem(modulo: string, grupo: string): Secao[] {
  const setor = setorDoModulo(modulo);
  if (!setor) return [];
  const pm = `/${modulo}/${SECAO_PM}`;
  const gestao = `/${modulo}/${SECAO_PM_GESTAO}`;
  return [
    {
      id: SECAO_PM,
      rotulo: "Post mortem",
      icone: "relatorio",
      grupo,
      path: pm,
      descricao: "Análise de incidente: preencha e acompanhe os seus relatórios",
      abas: [abaAutonoma(SECAO_PM, "Post mortem", pm, "Os seus relatórios de incidente")],
    },
    {
      id: SECAO_PM_GESTAO,
      rotulo: "Post mortem da equipe",
      icone: "relatorio-conferido",
      grupo,
      path: gestao,
      descricao: `Todos os relatórios do ${setor.rotulo}, de qualquer analista`,
      abas: [abaAutonoma(SECAO_PM_GESTAO, "Post mortem da equipe", gestao, `Relatórios do ${setor.rotulo}`)],
    },
  ];
}
