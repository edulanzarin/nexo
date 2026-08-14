import { describe, expect, it } from "vitest";
import {
  addDias,
  diffDias,
  montarItem,
  ordenarItens,
  slotDeAviso,
  type RescisaoRaw,
} from "./rescisoes-calculo";
import type { RescisoesConfig } from "./rescisoes-tipos";

const CFG: RescisoesConfig = { prazoDias: 10, diasAntes: 3 };

function raw(over: Partial<RescisaoRaw> = {}): RescisaoRaw {
  return {
    codigoempresa: 1,
    empresa: "Empresa X",
    contrato: 100,
    funcionario: "Fulano",
    data_dem: "2026-08-01",
    causa: null,
    data_aviso: null,
    calculada: false,
    data_pgto: null,
    ...over,
  };
}

describe("datas", () => {
  it("addDias soma e subtrai atravessando o mês", () => {
    expect(addDias("2026-08-14", 10)).toBe("2026-08-24");
    expect(addDias("2026-08-28", 5)).toBe("2026-09-02");
    expect(addDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDias("2026-08-14", -180)).toBe("2026-02-15");
  });

  it("diffDias é a − b, com sinal", () => {
    expect(diffDias("2026-08-14", "2026-08-04")).toBe(10);
    expect(diffDias("2026-08-04", "2026-08-14")).toBe(-10);
    expect(diffDias("2026-08-14", "2026-08-14")).toBe(0);
  });
});

describe("montarItem — situação derivada do prazo", () => {
  it("prazo = desligamento + prazoDias", () => {
    const item = montarItem(raw({ data_dem: "2026-08-01" }), "2026-08-05", CFG, undefined);
    expect(item.prazo).toBe("2026-08-11"); // 01 + 10 dias
  });

  it("override => resolvida, sem contagem de prazo", () => {
    const item = montarItem(raw(), "2026-08-05", CFG, { resolvidaEm: "2026-08-03", observacao: "paga" });
    expect(item.situacao).toBe("resolvida");
    expect(item.diasParaPrazo).toBeNull();
    expect(item.resolvidaEm).toBe("2026-08-03");
    expect(item.resolvidaFonte).toBe("manual");
    expect(item.observacao).toBe("paga");
  });

  it("prazo folgado (além da antecedência) => no_prazo", () => {
    // prazo 2026-08-11; ref 2026-08-05 => faltam 6 dias (> diasAntes=3)
    const item = montarItem(raw(), "2026-08-05", CFG, undefined);
    expect(item.diasParaPrazo).toBe(6);
    expect(item.situacao).toBe("no_prazo");
  });

  it("dentro da antecedência => vence_breve", () => {
    // prazo 2026-08-11; ref 2026-08-08 => faltam 3 dias (== diasAntes)
    const item = montarItem(raw(), "2026-08-08", CFG, undefined);
    expect(item.diasParaPrazo).toBe(3);
    expect(item.situacao).toBe("vence_breve");
  });

  it("no dia do prazo (0 dias) ainda é vence_breve, não vencida", () => {
    const item = montarItem(raw(), "2026-08-11", CFG, undefined);
    expect(item.diasParaPrazo).toBe(0);
    expect(item.situacao).toBe("vence_breve");
  });

  it("prazo passado => vencida", () => {
    const item = montarItem(raw(), "2026-08-20", CFG, undefined);
    expect(item.diasParaPrazo).toBe(-9);
    expect(item.situacao).toBe("vencida");
  });

  it("fronteira antecedência+1 volta a no_prazo", () => {
    // prazo 2026-08-11; ref 2026-08-07 => faltam 4 dias (diasAntes+1)
    const item = montarItem(raw(), "2026-08-07", CFG, undefined);
    expect(item.diasParaPrazo).toBe(4);
    expect(item.situacao).toBe("no_prazo");
  });

  it("repassa os campos crus (empresa, previsto, aviso, calculada)", () => {
    const item = montarItem(
      raw({ empresa: "ACME", data_pgto: "2026-08-09", data_aviso: "2026-07-25", calculada: true, causa: "Sem justa causa" }),
      "2026-08-05",
      CFG,
      undefined
    );
    expect(item.empresa).toBe("ACME");
    expect(item.pgtoPrevisto).toBe("2026-08-09");
    expect(item.dataAviso).toBe("2026-07-25");
    expect(item.calculada).toBe(true);
    expect(item.causa).toBe("Sem justa causa");
  });
});

describe("ordenarItens — criticidade", () => {
  it("vencida < vence_breve < no_prazo < resolvida; empate por prazo, depois nome", () => {
    const itens = [
      montarItem(raw({ contrato: 1, funcionario: "Ana" }), "2026-08-05", CFG, { resolvidaEm: "2026-08-04", observacao: null }), // resolvida
      montarItem(raw({ contrato: 2, funcionario: "Bruno", data_dem: "2026-08-01" }), "2026-08-20", CFG, undefined), // vencida -9
      montarItem(raw({ contrato: 3, funcionario: "Carla", data_dem: "2026-08-10" }), "2026-08-05", CFG, undefined), // no_prazo
      montarItem(raw({ contrato: 4, funcionario: "Diego", data_dem: "2026-08-01" }), "2026-08-09", CFG, undefined), // vence_breve 2
    ];
    const ordem = ordenarItens(itens).map((i) => i.situacao);
    expect(ordem).toEqual(["vencida", "vence_breve", "no_prazo", "resolvida"]);
  });

  it("mesma situação: prazo mais próximo primeiro, depois nome", () => {
    const itens = [
      montarItem(raw({ contrato: 1, funcionario: "Zeca", data_dem: "2026-08-01" }), "2026-08-15", CFG, undefined), // vencida -4
      montarItem(raw({ contrato: 2, funcionario: "Ada", data_dem: "2026-08-01" }), "2026-08-20", CFG, undefined), // vencida -9
      montarItem(raw({ contrato: 3, funcionario: "Bia", data_dem: "2026-08-01" }), "2026-08-20", CFG, undefined), // vencida -9
    ];
    const nomes = ordenarItens(itens).map((i) => i.funcionario);
    // -9 (Ada, Bia por nome) antes de -4 (Zeca)
    expect(nomes).toEqual(["Ada", "Bia", "Zeca"]);
  });
});

describe("slotDeAviso — chave de idempotência do cron", () => {
  it("vencida: slot é o dia negativo (um aviso por dia)", () => {
    expect(slotDeAviso(-1, 3)).toBe(-1);
    expect(slotDeAviso(-9, 3)).toBe(-9);
  });

  it("dentro da antecedência (0..diasAntes): slot fixo = diasAntes (aviso único)", () => {
    expect(slotDeAviso(0, 3)).toBe(3);
    expect(slotDeAviso(3, 3)).toBe(3);
  });

  it("folgada (> diasAntes): não avisa", () => {
    expect(slotDeAviso(4, 3)).toBeNull();
    expect(slotDeAviso(30, 3)).toBeNull();
  });

  it("null (resolvida) cai no ramo defensivo do dia 0 => slot fixo", () => {
    expect(slotDeAviso(null, 3)).toBe(3);
  });
});
