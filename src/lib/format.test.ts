import { describe, expect, it } from "vitest";
import { brlCompact, dataHoraBR, numCompact } from "./format";

const esp = String.fromCharCode(160);

describe("forma compacta", () => {
  it("escreve sem casa decimal quando o valor é redondo", () => {
    expect(brlCompact(412000)).toBe(`R$${esp}412${esp}mil`);
    expect(numCompact(88000)).toBe(`88${esp}mil`);
  });

  it("uma casa com vírgula", () => {
    expect(brlCompact(84210)).toBe(`R$${esp}84,2${esp}mil`);
    expect(numCompact(6_900_000_000)).toBe(`6,9${esp}bi`);
  });

  it("sobe de unidade quando o arredondamento chega a mil", () => {
    expect(numCompact(999_960)).toBe(`1${esp}mi`);
  });

  it("abaixo de mil é o número inteiro, e negativo leva o sinal na frente", () => {
    expect(numCompact(950)).toBe("950");
    expect(brlCompact(-2_500_000)).toBe(`-R$${esp}2,5${esp}mi`);
  });
});

describe("data e hora", () => {
  // O servidor (container) roda em UTC e o navegador em São Paulo: o texto
  // tem que sair igual nos dois, senão a hidratação quebra.
  for (const tz of ["UTC", "America/Sao_Paulo"]) {
    it(`sai no fuso do escritório com o processo em ${tz}`, () => {
      const antes = process.env.TZ;
      process.env.TZ = tz;
      try {
        // Com fuso: o instante, formatado em São Paulo.
        expect(dataHoraBR("2026-09-10T13:02:00.000Z")).toBe("10/09/2026, 10:02");
        // Sem fuso: já é a hora do relógio, lida como está.
        expect(dataHoraBR("2026-09-24T15:42:00")).toBe("24/09/2026, 15:42");
        expect(dataHoraBR("2026-09-24 07:05:31.25")).toBe("24/09/2026, 07:05");
      } finally {
        process.env.TZ = antes;
      }
    });
  }

  it("vazio vira travessão", () => {
    expect(dataHoraBR(null)).toBe("—");
  });
});
