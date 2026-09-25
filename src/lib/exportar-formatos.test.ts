import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { letraColuna, montarXlsx, nomeAba } from "./planilha-xlsx";
import { montarPdf, paraLatin1 } from "./relatorio-pdf";
import { colunaNumerica, lerCelula, textoCelula, type Tabela } from "./tabela-exportar";

describe("lerCelula", () => {
  it("reconhece os formatos que as telas escrevem", () => {
    expect(lerCelula(1402)).toEqual({ tipo: "numero", valor: 1402 });
    expect(lerCelula(12.5)).toEqual({ tipo: "decimal", valor: 12.5 });
    expect(lerCelula("1234,56")).toEqual({ tipo: "decimal", valor: 1234.56 });
    expect(lerCelula("-1.234,56")).toEqual({ tipo: "decimal", valor: -1234.56 });
    const d = lerCelula("19/03/2025");
    expect(d.tipo === "data" && d.valor.toISOString()).toBe("2025-03-19T00:00:00.000Z");
    const h = lerCelula("19/03/2025 14:05");
    expect(h.tipo === "data" && h.comHora).toBe(true);
    expect(lerCelula("2026-09-25").tipo).toBe("data");
  });

  it("deixa como texto o que só parece número", () => {
    for (const s of ["0012", "09/2026", "12.345.678/0001-90", "12345678000190", "1.1.01.001", "31/02/2026", "Diretor"]) {
      expect(lerCelula(s).tipo, s).toBe("texto");
    }
    expect(lerCelula("").tipo).toBe("vazio");
    expect(lerCelula(null).tipo).toBe("vazio");
    expect(lerCelula(Number.NaN).tipo).toBe("vazio");
  });

  it("escreve para leitura sem agrupar inteiro (código de empresa)", () => {
    expect(textoCelula(1402)).toBe("1402");
    expect(textoCelula("1234,5")).toBe("1.234,50");
    expect(textoCelula("2026-09-25")).toBe("25/09/2026");
  });

  it("só alinha como número a coluna inteira de números", () => {
    const linhas = [[1, "a"], [null, "b"], ["2,50", "c"]];
    expect(colunaNumerica(linhas, 0)).toBe(true);
    expect(colunaNumerica(linhas, 1)).toBe(false);
    expect(colunaNumerica([[1], ["—"]], 0)).toBe(false);
  });
});

describe("montarXlsx", () => {
  const tabela: Tabela = {
    cabecalhos: ["Nome", "Admissão", "Valor", "Código"],
    linhas: [
      ["MARIA & JOSÉ <LTDA>", "19/03/2025", "1234,56", 1402],
      ["  espaço", null, 10, "0012"],
    ],
  };
  const partes = unzipSync(montarXlsx(tabela, "Diretório: RH/DP"));
  const folha = strFromU8(partes["xl/worksheets/sheet1.xml"]);
  const livro = strFromU8(partes["xl/workbook.xml"]);

  it("tem as partes que o Excel exige", () => {
    expect(Object.keys(partes).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("escreve número como número, data como serial e texto escapado", () => {
    expect(folha).toContain('<c r="B2" s="2"><v>45735</v></c>');
    expect(folha).toContain('<c r="C2" s="4"><v>1234.56</v></c>');
    expect(folha).toContain('<c r="D2"><v>1402</v></c>');
    expect(folha).toContain("MARIA &amp; JOSÉ &lt;LTDA&gt;");
    expect(folha).toContain('<t xml:space="preserve">  espaço</t>');
    // Zero à esquerda continua texto.
    expect(folha).toContain('<c r="D3" t="inlineStr"><is><t>0012</t></is></c>');
    // Célula vazia não vira elemento.
    expect(folha).not.toContain('r="B3"');
  });

  it("congela o cabeçalho e liga o filtro no intervalo certo", () => {
    expect(folha).toContain('state="frozen"');
    expect(folha).toContain('<autoFilter ref="A1:D3"/>');
    expect(livro).toContain('name="Diretório RH DP"');
    expect(livro).toContain("'Diretório RH DP'!$A$1:$D$3");
  });

  it("tira caractere que o XML não aceita", () => {
    const x = strFromU8(unzipSync(montarXlsx({ cabecalhos: ["a"], linhas: [["x\u0001y"]] }, "t"))["xl/worksheets/sheet1.xml"]);
    expect(x).toContain("<t>xy</t>");
  });
});

describe("nomes", () => {
  it("nomeia coluna e aba como o Excel aceita", () => {
    expect([0, 25, 26, 701, 702].map(letraColuna)).toEqual(["A", "Z", "AA", "ZZ", "AAA"]);
    expect(nomeAba("x".repeat(40))).toHaveLength(31);
    expect(nomeAba("[]")).toBe("Planilha");
  });
});

describe("montarPdf", () => {
  it("gera um PDF com uma página por lote de linhas", () => {
    const linhas = Array.from({ length: 120 }, (_, i) => [`Pessoa ${i} — ação`, "19/03/2025", "1234,56"]);
    const bytes = montarPdf(
      { cabecalhos: ["Nome", "Admissão", "Valor"], linhas },
      { titulo: "Diretório", contexto: "RH", autoria: "Gerado por Teste em 25/09/2026 às 10:00" }
    );
    const texto = new TextDecoder("latin1").decode(bytes);
    expect(texto.startsWith("%PDF-")).toBe(true);
    expect(Number(/\/Count (\d+)/.exec(texto)?.[1])).toBeGreaterThan(1);
  });

  it("troca tipografia fora do Latin-1 em vez de sair lixo", () => {
    expect(paraLatin1("Ação — “ok” … →")).toBe('Ação - "ok" ... ->');
    expect(paraLatin1("😀")).toBe("?");
  });
});
