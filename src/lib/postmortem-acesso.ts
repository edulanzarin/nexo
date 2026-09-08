import "server-only";
import { FilterError } from "./fiscal-filters";
import { getSessaoOpcional, podeSecao, type Sessao } from "./sessao";

/**
 * As três regras de acesso do Post Mortem, num lugar só — rotas e páginas leem
 * daqui. Fronteira de permissão espalhada é fronteira que uma tela nova esquece.
 *
 * - **Preencher** é da seção do PRÓPRIO setor. Coordenar não é preencher: quem
 *   só tem a Geral lê tudo e não abre relatório em nome de setor nenhum.
 * - **Ler o setor** é a seção dele ou a Geral.
 * - **Ler relatório alheio** é só da Geral; o dono sempre lê o seu.
 */
const MOD = "postmortem";

export function ehCoordenacao(sessao: Sessao): boolean {
  return podeSecao(sessao, MOD, "geral");
}

export function podePreencher(sessao: Sessao, setor: string): boolean {
  return podeSecao(sessao, MOD, setor);
}

export function podeLerSetor(sessao: Sessao, setor: string): boolean {
  return podePreencher(sessao, setor) || ehCoordenacao(sessao);
}

/** Sessão obrigatória (rotas de API). O gate do apiRoute já exigiu login. */
export async function sessaoPM(): Promise<Sessao> {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Não autenticado");
  return sessao;
}
