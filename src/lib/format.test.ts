import { describe, expect, it } from "vitest";
import { brlCompact, numCompact } from "./format";

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
