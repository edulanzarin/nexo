import "server-only";
import { FilterError } from "./fiscal-filters";
import { SECAO_PM, SECAO_PM_GESTAO } from "./postmortem-secoes";
import { setorDoModulo, setorPM, type SetorPM } from "./postmortem-setores";
import { getSessaoOpcional, podeSecao, type Sessao } from "./sessao";

/**
 * As regras de acesso do Post Mortem, num lugar só — rotas e páginas leem daqui.
 * Fronteira de permissão espalhada é fronteira que uma tela nova esquece.
 *
 * O relatório mora no módulo do SETOR, então a permissão já vem recortada por
 * área: não existe leitura de escritório inteiro, e o gestor do Fiscal não
 * alcança o do Societário nem por caminho digitado à mão.
 *
 * - **Preencher** é a seção `post-mortem` do módulo do setor.
 * - **Ler o setor inteiro** é a seção `post-mortem-gestao` do mesmo módulo.
 * - **Ler relatório alheio** é da gestão DAQUELE setor; o dono sempre lê o seu.
 */

/** O setor do módulo, ou erro — rota de post mortem em módulo sem setor não existe. */
export function setorDaRota(modulo: string): SetorPM {
  const setor = setorDoModulo(modulo);
  if (!setor) throw new FilterError("Este módulo não tem relatório post mortem");
  return setor;
}

export function podePreencher(sessao: Sessao, setor: SetorPM): boolean {
  return podeSecao(sessao, setor.modulo, SECAO_PM);
}

export function podeLerSetor(sessao: Sessao, setor: SetorPM): boolean {
  return podeSecao(sessao, setor.modulo, SECAO_PM_GESTAO);
}

/** Alcança a seção do setor de alguma forma (preenche ou coordena)? */
export function podeEntrar(sessao: Sessao, setor: SetorPM): boolean {
  return podePreencher(sessao, setor) || podeLerSetor(sessao, setor);
}

/**
 * Pode ler ESTE relatório? O dono sempre; alheio só a gestão do setor DELE (o
 * setor gravado no relatório, não o do caminho — quem digita o caminho é o
 * cliente).
 */
export function podeLerRelatorio(
  sessao: Sessao,
  relatorio: { autorId: string; setor: string }
): boolean {
  if (relatorio.autorId === sessao.usuario.id) return true;
  const setor = setorPM(relatorio.setor);
  return !!setor && podeLerSetor(sessao, setor);
}

/** Sessão obrigatória (rotas de API). O gate do apiRoute já exigiu login. */
export async function sessaoPM(): Promise<Sessao> {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  return sessao;
}
