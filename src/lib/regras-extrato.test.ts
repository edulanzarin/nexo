import { describe, expect, it } from "vitest";
import { casar, gerarLancamentos, normalizar, type RegraExtrato } from "./regras-extrato";

let proximo = 1;
function regra(termo: string, conta: number, tipo: RegraExtrato["tipo"] = "parcial"): RegraExtrato {
  return {
    id: proximo++,
    termo: normalizar(termo),
    termoOriginal: termo,
    tipo,
    contaPagamento: conta,
    contaRecebimento: conta,
    historico: null,
    ativo: true,
  };
}

const HISTORICO = "DÉB.TRANSF.CONTAS DIF.TITULARIDADE";

describe("casamento com o complemento", () => {
  const generica = regra(HISTORICO, 100);
  const jose = regra("JOSE AUGUSTO", 201);
  const marta = regra("MARTA", 202);
  const regras = [generica, jose, marta];

  it("o favorecido separa as contas que o histórico junta", () => {
    expect(casar(HISTORICO, "pagamento", regras, "FAV.: JOSE AUGUSTO MOREIRA")?.conta).toBe(201);
    expect(casar(HISTORICO, "pagamento", regras, "FAV.: MARTA ROSA MOREIRA")?.conta).toBe(202);
  });

  it("termo curto no complemento ganha do termo longo no histórico", () => {
    const m = casar(HISTORICO, "pagamento", regras, "FAV.: MARTA ROSA MOREIRA");
    expect(m?.regra.id).toBe(marta.id);
    expect(m?.ambiguo).toBe(false);
  });

  it("sem regra para o favorecido, a do histórico continua valendo", () => {
    expect(casar(HISTORICO, "pagamento", regras, "FAV.: OUTRA PESSOA")?.conta).toBe(100);
  });

  it("regra exata antiga, feita pelo histórico, não deixa de casar", () => {
    const exata = regra(HISTORICO, 300, "exato");
    expect(casar(HISTORICO, "pagamento", [exata], "FAV.: OUTRA PESSOA")?.conta).toBe(300);
  });

  it("regra exata pode pegar a linha inteira", () => {
    const exata = regra(`${HISTORICO} FAV.: OUTRA PESSOA`, 301, "exato");
    expect(casar(HISTORICO, "pagamento", [exata], "FAV.: OUTRA PESSOA")?.conta).toBe(301);
  });

  it("sem regra, o histórico do lançamento leva a linha inteira", () => {
    const [l] = gerarLancamentos(
      [{ data: "2026-08-31", descricao: HISTORICO, complemento: "FAV.: OUTRA PESSOA", valor: -10 }],
      16,
      []
    );
    expect(l.historico).toBe(`${HISTORICO} FAV.: OUTRA PESSOA`);
    expect(l.complemento).toBe("FAV.: OUTRA PESSOA");
    expect(l.pendencia).toBe("sem_regra");
  });

  it("linha sem complemento não ganha o campo", () => {
    const [l] = gerarLancamentos([{ data: "2026-08-31", descricao: "TARIFA", valor: -1 }], 16, []);
    expect("complemento" in l).toBe(false);
  });
});
