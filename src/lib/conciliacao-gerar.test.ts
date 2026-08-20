import { describe, expect, it } from "vitest";
import { gerarArquivoConciliacao, type LancamentoCsv } from "./conciliacao-gerar";

const base: LancamentoCsv = {
  data: "2021-01-01",
  contaDebito: 4537,
  contaCredito: 1496,
  complemento: "- 202019 APTA REPRESENTACOES COMERCIAIS LTDA",
  valor: 516.15,
};

const linhas = (arquivo: string) => arquivo.split("\r\n").filter(Boolean);

describe("gerarArquivoConciliacao", () => {
  it("emite a linha no layout do Questor", () => {
    const { arquivo, linhas: n, total } = gerarArquivoConciliacao([base], { estab: 1 });
    expect(arquivo).toBe(
      '1,01012021,4537,1496,516.15,0,"- 202019 APTA REPRESENTACOES COMERCIAIS LTDA"\r\n'
    );
    expect(n).toBe(1);
    expect(total).toBeCloseTo(516.15);
  });

  it("usa ponto decimal com 2 casas e a filial informada", () => {
    const { arquivo } = gerarArquivoConciliacao([{ ...base, valor: 1725.4 }], { estab: 7 });
    expect(linhas(arquivo)[0].startsWith("7,01012021,4537,1496,1725.40,0,")).toBe(true);
  });

  it("protege a vírgula e a aspa do complemento", () => {
    const { arquivo } = gerarArquivoConciliacao(
      [{ ...base, complemento: 'PAGTO SILVA, LTDA "ME"' }],
      { estab: 1 }
    );
    expect(linhas(arquivo)[0]).toContain('"PAGTO SILVA, LTDA ""ME"""');
  });

  it("não deixa quebra de linha do extrato partir o registro", () => {
    const { arquivo } = gerarArquivoConciliacao(
      [{ ...base, complemento: "TED RECEBIDA\nMAGALHAES" }],
      { estab: 1 }
    );
    expect(linhas(arquivo)).toHaveLength(1);
    expect(linhas(arquivo)[0]).toContain('"TED RECEBIDA MAGALHAES"');
  });

  it("corta o complemento no tamanho do campo", () => {
    const { arquivo } = gerarArquivoConciliacao([{ ...base, complemento: "A".repeat(400) }], {
      estab: 1,
    });
    expect(linhas(arquivo)[0]).toContain(`"${"A".repeat(300)}"`);
  });

  it("ignora lançamento zerado e devolve arquivo vazio quando não sobra nada", () => {
    const res = gerarArquivoConciliacao([{ ...base, valor: 0 }], { estab: 1 });
    expect(res).toEqual({ arquivo: "", linhas: 0, total: 0 });
  });
});
