import { describe, expect, it } from "vitest";
import {
  apurarFormulario,
  camposDeSegmento,
  filtrarRespostas,
  indicadoresGerais,
  type ApuracaoEscala,
  type ApuracaoNumero,
  type ApuracaoOpcoes,
  type ApuracaoTexto,
} from "./formularios-apuracao";
import type { CampoConfig, FormularioCampo, TipoCampo } from "./formularios-tipos";

let seq = 0;
function campo(tipo: TipoCampo, config: CampoConfig = {}, over: Partial<FormularioCampo> = {}): FormularioCampo {
  seq += 1;
  return {
    id: over.id ?? seq,
    ordem: seq,
    tipo,
    rotulo: over.rotulo ?? `Pergunta ${seq}`,
    ajuda: null,
    obrigatorio: false,
    config,
    ...over,
  };
}

describe("marcação de uma opção", () => {
  const setor = campo("selecao_unica", { opcoes: ["Contábil", "Fiscal", "DP"] }, { id: 10 });

  it("conta por opção e mantém a opção zerada na lista", () => {
    const a = apurarFormulario(
      [setor],
      [{ "10": "Contábil" }, { "10": "Contábil" }, { "10": "Fiscal" }]
    )[0] as ApuracaoOpcoes;

    expect(a.forma).toBe("opcoes");
    expect(a.respondentes).toBe(3);
    expect(a.fatias.map((f) => [f.rotulo, f.n])).toEqual([
      ["Contábil", 2],
      ["Fiscal", 1],
      ["DP", 0],
    ]);
    expect(a.fatias[0].pct).toBeCloseTo(66.67, 1);
  });

  it("percentual é sobre quem respondeu, não sobre o total da rodada", () => {
    const a = apurarFormulario([setor], [{ "10": "Fiscal" }, {}, {}])[0] as ApuracaoOpcoes;
    expect(a.respondentes).toBe(1);
    expect(a.emBranco).toBe(2);
    expect(a.fatias.find((f) => f.rotulo === "Fiscal")?.pct).toBe(100);
  });

  it("opção que saiu do formulário depois da resposta não some da contagem", () => {
    const a = apurarFormulario([setor], [{ "10": "Setor extinto" }])[0] as ApuracaoOpcoes;
    expect(a.respondentes).toBe(1);
    expect(a.fatias.find((f) => f.rotulo === "Setor extinto")?.n).toBe(1);
  });
});

describe("marcação de várias opções", () => {
  it("soma marcações, então passa de 100%", () => {
    const c = campo("selecao_multipla", { opcoes: ["A", "B", "C"] }, { id: 20 });
    const a = apurarFormulario([c], [{ "20": ["A", "B"] }, { "20": ["A"] }])[0] as ApuracaoOpcoes;

    expect(a.multipla).toBe(true);
    expect(a.respondentes).toBe(2);
    expect(a.fatias.map((f) => f.n)).toEqual([2, 1, 0]);
    expect(a.fatias[0].pct).toBe(100);
  });
});

describe("escala", () => {
  const nota = campo(
    "nota",
    { escala: ["Ruim", "Regular", "Bom", "Ótimo"] },
    { id: 30 }
  );

  it("o valor guardado é índice, e a média sai na escala que a pessoa vê (1..n)", () => {
    // índices 0 e 3 = níveis 1 e 4 → média 2,5
    const a = apurarFormulario([nota], [{ "30": 0 }, { "30": 3 }])[0] as ApuracaoEscala;
    expect(a.media).toBe(2.5);
    expect(a.fatias.map((f) => f.n)).toEqual([1, 0, 0, 1]);
    expect(a.fatias[0].rotulo).toBe("1 · Ruim");
  });

  it("favorável é o percentual nos dois níveis mais altos", () => {
    const a = apurarFormulario(
      [nota],
      [{ "30": 3 }, { "30": 2 }, { "30": 0 }, { "30": 1 }]
    )[0] as ApuracaoEscala;
    expect(a.favoravel).toBe(50);
  });

  it("escala curta não tem top-2-box", () => {
    const curta = campo("nota", { escala: ["Não", "Mais ou menos", "Sim"] }, { id: 31 });
    const a = apurarFormulario([curta], [{ "31": 2 }])[0] as ApuracaoEscala;
    expect(a.favoravel).toBeNull();
  });

  it("índice fora da escala (pergunta editada depois) é descartado, não quebra a média", () => {
    const a = apurarFormulario([nota], [{ "30": 3 }, { "30": 9 }])[0] as ApuracaoEscala;
    expect(a.respondentes).toBe(1);
    expect(a.media).toBe(4);
  });
});

describe("pontuação", () => {
  it("média, mediana, extremos e faixas dentro do intervalo configurado", () => {
    const c = campo("pontuacao", { min: 0, max: 10 }, { id: 40 });
    const a = apurarFormulario(
      [c],
      [{ "40": 10 }, { "40": 8 }, { "40": 6 }, { "40": 0 }]
    )[0] as ApuracaoNumero;

    expect(a.media).toBe(6);
    expect(a.mediana).toBe(7);
    expect(a.minimo).toBe(0);
    expect(a.maximo).toBe(10);
    expect(a.fatias).toHaveLength(5);
    expect(a.fatias.reduce((s, f) => s + f.n, 0)).toBe(4);
    // faixas de largura 2 no intervalo 0..10; a última é fechada nos dois lados
    expect(a.fatias.map((f) => f.rotulo)).toEqual(["0 a 2", "2 a 4", "4 a 6", "6 a 8", "8 a 10"]);
    expect(a.fatias.map((f) => f.n)).toEqual([1, 0, 0, 1, 2]);
  });
});

describe("texto", () => {
  it("não resume: devolve os textos, ignorando vazio", () => {
    const c = campo("texto_longo", {}, { id: 50 });
    const a = apurarFormulario(
      [c],
      [{ "50": "  gostei  " }, { "50": "   " }, {}]
    )[0] as ApuracaoTexto;
    expect(a.textos).toEqual(["gostei"]);
    expect(a.emBranco).toBe(2);
  });
});

describe("segmento", () => {
  const setor = campo("selecao_unica", { opcoes: ["Contábil", "Fiscal"] }, { id: 60 });
  const aberta = campo("texto_curto", {}, { id: 61 });
  const muitas = campo(
    "selecao_unica",
    { opcoes: Array.from({ length: 20 }, (_, i) => `Op ${i}`) },
    { id: 62 }
  );

  it("candidato é marcação de uma opção com poucas opções", () => {
    expect(camposDeSegmento([setor, aberta, muitas]).map((c) => c.id)).toEqual([60]);
  });

  it("filtrar mantém só quem marcou aquele valor", () => {
    const respostas = [{ "60": "Contábil" }, { "60": "Fiscal" }, {}];
    expect(filtrarRespostas(respostas, { campoId: 60, valor: "Contábil" })).toHaveLength(1);
    expect(filtrarRespostas(respostas, null)).toHaveLength(3);
  });
});

describe("indicadores gerais", () => {
  it("normaliza escalas de tamanhos diferentes antes de somar", () => {
    const quatro = campo("nota", { escala: ["a", "b", "c", "d"] }, { id: 70 });
    const cinco = campo("nota", { escala: ["a", "b", "c", "d", "e"] }, { id: 71 });
    // topo das duas escalas: índice 3 (nível 4 de 4) e índice 4 (nível 5 de 5)
    const ap = apurarFormulario([quatro, cinco], [{ "70": 3, "71": 4 }]);
    expect(indicadoresGerais(ap).indice).toBe(100);

    // fundo das duas
    const fundo = apurarFormulario([quatro, cinco], [{ "70": 0, "71": 0 }]);
    expect(indicadoresGerais(fundo).indice).toBe(0);
  });

  it("sem pergunta de escala não há índice", () => {
    const texto = campo("texto_curto", {}, { id: 72 });
    expect(indicadoresGerais(apurarFormulario([texto], [{ "72": "oi" }])).indice).toBeNull();
  });
});
