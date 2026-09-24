import { describe, expect, it } from "vitest";
import { linkRescisoes, linkFerias, linkEsocial } from "./painel-links";
import { diffDias } from "./rescisoes-calculo";

const HOJE = "2026-08-14";

/** Extrai os query params de um link do painel. */
function params(url: string): { path: string; sp: URLSearchParams } {
  const [path, qs] = url.split("?");
  return { path, sp: new URLSearchParams(qs) };
}

describe("links do painel caem com filtro APLICADO", () => {
  it("todos marcam ap=1 e fim=hoje", () => {
    for (const url of [linkRescisoes(HOJE), linkFerias(HOJE), linkEsocial(HOJE)]) {
      const { sp } = params(url);
      expect(sp.get("ap")).toBe("1");
      expect(sp.get("fim")).toBe(HOJE);
    }
  });

  it("linkRescisoes: /folha/rescisoes com janela de 180 dias", () => {
    const { path, sp } = params(linkRescisoes(HOJE));
    expect(path).toBe("/folha/rescisoes");
    expect(diffDias(HOJE, sp.get("inicio")!)).toBe(180);
  });

  it("linkFerias: /folha/ferias com janela de 30 dias", () => {
    const { path, sp } = params(linkFerias(HOJE));
    expect(path).toBe("/folha/ferias");
    expect(diffDias(HOJE, sp.get("inicio")!)).toBe(30);
  });

  it("linkEsocial: /folha/esocial com janela de 90 dias", () => {
    const { path, sp } = params(linkEsocial(HOJE));
    expect(path).toBe("/folha/esocial");
    expect(diffDias(HOJE, sp.get("inicio")!)).toBe(90);
  });

  it("empresa opcional entra como filtro; sem empresa não aparece", () => {
    expect(params(linkFerias(HOJE, 42)).sp.get("empresas")).toBe("42");
    expect(params(linkFerias(HOJE)).sp.has("empresas")).toBe(false);
    expect(params(linkRescisoes(HOJE, 7)).sp.get("empresas")).toBe("7");
  });
});
