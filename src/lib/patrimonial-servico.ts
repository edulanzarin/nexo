import "server-only";
import { pool } from "./db";
import { FilterError } from "./fiscal-filters";
import { carregarAlvos } from "./implantacao-depara";
import { casarLinhas } from "./implantacao-servico";
import { textoDoPdf, type ModoTextoPdf } from "./pdf-texto";
import { LEITORES_PATRIMONIAL, RELATORIOS_PATRIMONIAL } from "./patrimonial-pdf";
import {
  PREFIXO_DEPARA_PATRIMONIAL,
  type ContaBens,
  type ContaBensCasada,
  type LeituraPatrimonialCasada,
} from "./patrimonial-tipos";

/**
 * Orquestração server-side da implantação do patrimonial: PDF → leitor que
 * reconhece o layout → contas casadas com o plano da empresa. Nada escreve no
 * Questor; o de-para confirmado vai para o banco do app (`implantacao_depara`).
 */

export async function lerPatrimonialPdf(
  empresa: number,
  bytes: Buffer,
  senha?: string
): Promise<LeituraPatrimonialCasada> {
  // Cada leitor pede um modo de extração; o mesmo modo não roda duas vezes.
  const textos = new Map<ModoTextoPdf, Promise<string>>();
  const texto = (modo: ModoTextoPdf) => {
    if (!textos.has(modo)) textos.set(modo, textoDoPdf(bytes, senha, modo));
    return textos.get(modo) as Promise<string>;
  };

  for (const leitor of LEITORES_PATRIMONIAL) {
    const t = await texto(leitor.modo);
    if (!leitor.reconhece(t)) continue;
    const leitura = leitor.ler(t);
    if (!leitura.bens.length) {
      throw new FilterError(`O relatório é do ${leitor.sistema}, mas não achei nenhum bem nele`);
    }
    return { ...leitura, contas: await casarContasBens(empresa, leitura.contas) };
  }

  throw new FilterError(
    `Não reconheci o layout deste relatório. Por enquanto leio: ${RELATORIOS_PATRIMONIAL.join(", ")}.`
  );
}

/** Casa as contas de origem com o plano da empresa, aplicando o de-para salvo. */
export async function casarContasBens(
  empresa: number,
  contas: ContaBens[]
): Promise<ContaBensCasada[]> {
  const casadas = await casarLinhas(
    empresa,
    contas.map((c) => ({
      chave: PREFIXO_DEPARA_PATRIMONIAL + c.chave,
      classif: c.classif,
      descricao: c.descricao,
      saldo: 0,
      // Conta de bem é devedora: tira do páreo as "(-) Depreciação de …", que
      // têm a mesma descrição e natureza credora.
      natureza: "D" as const,
    }))
  );
  return contas.map((c, i) => ({
    ...c,
    conta: casadas[i].conta,
    contaDescr: casadas[i].contaDescr,
    status: casadas[i].status,
    via: casadas[i].via,
    confianca: casadas[i].confianca,
  }));
}

/**
 * Confere que cada conta escolhida na tela existe no plano da empresa e é
 * analítica. A tela manda as contas que o usuário vê; gerar com elas (e não
 * recasar) evita perder a escolha que ainda está a caminho do banco.
 */
export async function validarContasBens(
  empresa: number,
  contas: { chave: string; conta: number | null }[]
): Promise<Map<string, number | null>> {
  const client = await pool.connect();
  try {
    const alvos = new Map((await carregarAlvos(client, empresa)).map((a) => [a.conta, a]));
    for (const c of contas) {
      if (c.conta == null) continue;
      const alvo = alvos.get(c.conta);
      if (!alvo) throw new FilterError(`A conta ${c.conta} não existe no plano da empresa`);
      if (alvo.sintetica) throw new FilterError(`A conta ${c.conta} é sintética e não recebe bem`);
    }
    return new Map(contas.map((c) => [c.chave, c.conta]));
  } finally {
    client.release();
  }
}
