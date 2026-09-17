import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bytesWindows1252 } from "./csv";
import { casarBalancete } from "./implantacao-casamento";
import type { ContaAlvo } from "./implantacao-tipos";
import { avisoDoBem, conferirPatrimonial } from "./patrimonial-conferencia";
import { CABECALHO_PATRIMONIAL, gerarArquivoPatrimonial } from "./patrimonial-gerar";
import { LEITORES_PATRIMONIAL, sciCorrecaoDepreciacao } from "./patrimonial-pdf";

/**
 * Fixture: `pdftotext -raw` de um relatório "Correção e depreciação" real do SCI,
 * com empresa, CNPJ, cidade, escritório e placa trocados. Os valores são os
 * reais, e os totais por conta conferem com o que a implantação feita à mão
 * gravou no Questor para essa empresa.
 */
const TEXTO = readFileSync(
  join(process.cwd(), "src", "lib", "__fixtures__", "patrimonial-sci-raw.txt"),
  "utf8"
);

const bem = (leitura: ReturnType<typeof sciCorrecaoDepreciacao.ler>, codigo: string) => {
  const b = leitura.bens.find((x) => x.codigo === codigo);
  if (!b) throw new Error(`bem ${codigo} não lido`);
  return b;
};

describe("leitor SCI · Correção e depreciação", () => {
  const leitura = sciCorrecaoDepreciacao.ler(TEXTO);

  it("reconhece o layout, e é o leitor que o registro escolhe", () => {
    expect(sciCorrecaoDepreciacao.reconhece(TEXTO)).toBe(true);
    expect(LEITORES_PATRIMONIAL.find((l) => l.reconhece(TEXTO))?.sistema).toBe("SCI");
    expect(sciCorrecaoDepreciacao.reconhece("Extrato de conta corrente\n01/02 PIX 10,00")).toBe(false);
  });

  it("lê as quatro contas e os 34 bens, com a posição do relatório", () => {
    expect(leitura.posicao).toBe("2026-04-30");
    expect(leitura.contas.map((c) => [c.chave, c.classif, c.descricao])).toEqual([
      ["98", "01.2.3.01.001", "Maquinas e Equipamentos"],
      ["99", "01.2.3.01.002", "Móveis e Utensílios"],
      ["102", "01.2.3.01.005", "Veículos"],
      ["103", "01.2.3.01.006", "Computadores e periféricos"],
    ]);
    expect(leitura.bens).toHaveLength(34);
    expect(leitura.bens.filter((b) => b.conta === "102")).toHaveLength(30);
  });

  it("pega a depreciação ACUMULADA, não o residual (o erro de quem colou no ChatGPT)", () => {
    const b = bem(leitura, "5");
    expect(b).toMatchObject({
      conta: "102",
      descricao: "NF 285667 FACHINI SA",
      aquisicao: "2023-01-19",
      valor: 190000,
      depreciacao: 123500.13,
      residual: 66499.87,
      taxa: 20,
      quantidade: 1,
    });
  });

  it("bem de outra conta lido depois do primeiro da conta, e o valor de 'Valor moeda' fica de fora", () => {
    expect(bem(leitura, "13")).toMatchObject({
      conta: "99",
      descricao: "COMIN COMERCIO DE MOVEIS",
      aquisicao: "2024-10-21",
      valor: 2011,
      depreciacao: 301.68,
      taxa: 10,
    });
  });

  it("taxa 0% e depreciação zero continuam zero", () => {
    expect(bem(leitura, "15")).toMatchObject({ valor: 1548901.3, depreciacao: 0, taxa: 0 });
    expect(bem(leitura, "20")).toMatchObject({ valor: 78000, depreciacao: 0, taxa: 0 });
  });

  it("totalmente depreciado: depreciação igual ao valor", () => {
    expect(bem(leitura, "4")).toMatchObject({ valor: 2260437.6, depreciacao: 2260437.6, taxa: 20 });
  });

  it("descrição sem o hífen que sobra no fim, e com o que vem no meio", () => {
    expect(bem(leitura, "19").descricao).toBe("SEMIRREBOQUE PORTA CONTAINER 3 EIXOS MEC JUNTOS 4 PINOS 40 PES");
    expect(bem(leitura, "10").descricao).toBe("101963 - DICAVE GARTNER DISTRIBUIDORA CATARINENSE DE VEICULOS");
  });

  it("lê o total de cada conta e o total geral desenhado antes do rótulo", () => {
    expect(leitura.contas.find((c) => c.chave === "102")?.total).toEqual({
      valor: 8647654.71,
      depreciacao: 3858393.78,
    });
    expect(leitura.totalGeral).toEqual({ valor: 8970743.88, depreciacao: 4044848.31 });
  });

  it("confere inteiro contra os totais impressos, sem aviso em bem nenhum", () => {
    const conf = conferirPatrimonial(leitura);
    expect(conf.confere).toBe(true);
    expect(conf.contas.every((c) => c.confere)).toBe(true);
    expect(leitura.bens.map(avisoDoBem).filter(Boolean)).toEqual([]);
  });

  it("não depende de como a ferramenta quebra as linhas de valores", () => {
    const soNumeros = /^[\d.,%\s]+$/;
    const linhas = TEXTO.split("\n");
    // Valores da mesma área numa linha só…
    const juntas: string[] = [];
    for (const l of linhas) {
      const ult = juntas.length - 1;
      if (soNumeros.test(l) && ult >= 0 && soNumeros.test(juntas[ult])) juntas[ult] += ` ${l}`;
      else juntas.push(l);
    }
    // …e cada valor numa linha própria.
    const separadas = linhas.flatMap((l) => (soNumeros.test(l) ? l.trim().split(/\s+/) : [l]));

    const base = JSON.stringify(leitura);
    expect(JSON.stringify(sciCorrecaoDepreciacao.ler(juntas.join("\n")))).toBe(base);
    expect(JSON.stringify(sciCorrecaoDepreciacao.ler(separadas.join("\n")))).toBe(base);
  });
});

describe("conferência", () => {
  const leitura = sciCorrecaoDepreciacao.ler(TEXTO);

  it("residual no lugar da depreciação quebra a conta e aponta o bem", () => {
    const trocado = leitura.bens.map((b) =>
      b.codigo === "5" ? { ...b, depreciacao: b.residual ?? 0 } : b
    );
    const conf = conferirPatrimonial({ ...leitura, bens: trocado });
    expect(conf.confere).toBe(false);
    expect(conf.contas.find((c) => c.chave === "102")?.confere).toBe(false);
    expect(conf.contas.find((c) => c.chave === "98")?.confere).toBe(true);
    expect(avisoDoBem(trocado.find((b) => b.codigo === "5")!)).toMatch(/residual/);
  });

  it("sem total geral impresso, soma os totais das contas", () => {
    const conf = conferirPatrimonial({ ...leitura, totalGeral: null });
    expect(conf.relatorio?.valor).toBeCloseTo(8970743.88, 2);
    expect(conf.confere).toBe(true);
  });
});

describe("arquivo de importação do patrimonial", () => {
  const leitura = sciCorrecaoDepreciacao.ler(TEXTO);
  // Contas que a implantação feita à mão usou no Questor.
  const DEPARA: Record<string, number> = { "98": 1083, "99": 1087, "102": 1089, "103": 1094 };

  it("gera cabeçalho do modelo e uma linha por bem, no formato do Questor", () => {
    const r = gerarArquivoPatrimonial(leitura.bens, (c) => DEPARA[c] ?? null);
    const linhas = r.arquivo.split("\r\n");
    expect(linhas[0]).toBe(CABECALHO_PATRIMONIAL.join(";"));
    expect(linhas[0]).toBe(
      "ITEM;Conta Contábil;Descrição;Quantidade;Valor do Bem;Data Aquisição;Encargo Acumulado;Percentual de Encargo;Data Final"
    );
    expect(r.linhas).toBe(34);
    expect(linhas).toContain("1;1083;MAQUINAS SALDO ANTERIOR;1;306184,27;31/12/2021;178824,71;10;");
    expect(linhas).toContain("1;1089;NF 285667 FACHINI SA;1;190000,00;19/01/2023;123500,13;20;");
    expect(linhas).toContain("1;1089;VEICULOS SALDO ANTERIOR;1;1548901,30;02/01/2025;0,00;0;");
    expect(r.arquivo.endsWith(";\r\n")).toBe(true);
    expect(r.valor).toBeCloseTo(8970743.88, 2);
    expect(r.depreciacao).toBeCloseTo(4044848.31, 2);
  });

  it("recusa bem em conta sem correspondência em vez de pular", () => {
    expect(() => gerarArquivoPatrimonial(leitura.bens, (c) => (c === "103" ? null : DEPARA[c]))).toThrow(
      /sem correspondência/
    );
  });

  it("descrição sem separador e taxa quebrada com vírgula", () => {
    const [b] = leitura.bens;
    const r = gerarArquivoPatrimonial([{ ...b, descricao: 'BEM; "A"\nB', taxa: 12.5 }], () => 1);
    expect(r.arquivo.split("\r\n")[1]).toBe("1;1;BEM A B;1;306184,27;31/12/2021;178824,71;12,5;");
  });

  it("sai em Windows-1252, como o modelo que o Questor exporta", () => {
    const bytes = bytesWindows1252("Contábil;Descrição–€日");
    expect([...bytes.slice(0, 8)]).toEqual([0x43, 0x6f, 0x6e, 0x74, 0xe1, 0x62, 0x69, 0x6c]);
    expect([...bytes.slice(-5)]).toEqual([0xe3, 0x6f, 0x96, 0x80, 0x3f]);
  });
});

describe("de-para das contas de bens", () => {
  const alvo = (conta: number, classif: string, descricao: string, natureza: "D" | "C"): ContaAlvo => ({
    conta,
    classif,
    descricao,
    sintetica: false,
    natureza,
  });
  const PLANO = [
    alvo(1083, "1.2.05.003.009", "Maquinas e Equipamentos", "D"),
    alvo(6433, "1.2.05.003.001", "Máquinas e Equipamentos - CM", "D"),
    alvo(1089, "1.2.05.003.015", "Veículos", "D"),
    alvo(5610, "1.2.05.003.023", "Veiculos Nauticos", "D"),
    alvo(1153, "1.2.05.007.017", "(-) Deprec. Veículos", "C"),
    alvo(1094, "1.2.05.003.020", "Computadores e Periféricos", "D"),
    alvo(1141, "1.2.05.007.005", "(-) Deprec. Computadores e Periféricos", "C"),
  ];

  it("casa pela descrição mesmo com a classificação de origem começando em zero", () => {
    const casadas = casarBalancete(
      [
        { chave: "patrimonial:98", classif: "01.2.3.01.001", descricao: "Maquinas e Equipamentos", saldo: 0, natureza: "D" },
        { chave: "patrimonial:102", classif: "01.2.3.01.005", descricao: "Veículos", saldo: 0, natureza: "D" },
        { chave: "patrimonial:103", classif: "01.2.3.01.006", descricao: "Computadores e periféricos", saldo: 0, natureza: "D" },
      ],
      PLANO,
      new Map()
    );
    expect(casadas.map((c) => [c.conta, c.status])).toEqual([
      [1083, "casada"],
      [1089, "casada"],
      [1094, "casada"],
    ]);
  });
});
