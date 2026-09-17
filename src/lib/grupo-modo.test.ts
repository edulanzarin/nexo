import { describe, expect, it } from "vitest";
import { ehModoGrupo, inverterMarcadas, membrosDoGrupo } from "./grupo-modo";

const UNIVERSO = [1, 2, 3, 4, 5];

describe("grupo de empresa por modo", () => {
  it("lista: as marcadas são o grupo, sem repetição", () => {
    expect(membrosDoGrupo("lista", [2, 4, 4], UNIVERSO)).toEqual([2, 4]);
  });

  it("exceto: o universo menos as marcadas", () => {
    expect(membrosDoGrupo("exceto", [2, 4], UNIVERSO)).toEqual([1, 3, 5]);
  });

  it("exceto: empresa nova no universo entra sem editar o grupo", () => {
    const marcadas = [2, 4];
    expect(membrosDoGrupo("exceto", marcadas, [...UNIVERSO, 6])).toEqual([1, 3, 5, 6]);
    // A mesma empresa nova num grupo em lista fica de fora — o problema de antes.
    expect(membrosDoGrupo("lista", [1, 3, 5], [...UNIVERSO, 6])).toEqual([1, 3, 5]);
  });

  it("exceto sem nenhuma marcada é o universo inteiro", () => {
    expect(membrosDoGrupo("exceto", [], UNIVERSO)).toEqual(UNIVERSO);
  });

  it("trocar de modo inverte as marcadas e mantém quem está no grupo", () => {
    const lista = new Set([1, 3, 5]);
    const exceto = inverterMarcadas(lista, UNIVERSO);
    expect([...exceto]).toEqual([2, 4]);
    expect(membrosDoGrupo("exceto", exceto, UNIVERSO)).toEqual(membrosDoGrupo("lista", lista, UNIVERSO));
    // E volta: inverter duas vezes devolve as marcadas de origem.
    expect([...inverterMarcadas(exceto, UNIVERSO)]).toEqual([1, 3, 5]);
  });

  it("só aceita os dois modos vindos do form", () => {
    expect(ehModoGrupo("lista")).toBe(true);
    expect(ehModoGrupo("exceto")).toBe(true);
    expect(ehModoGrupo("todas")).toBe(false);
    expect(ehModoGrupo(null)).toBe(false);
  });
});
