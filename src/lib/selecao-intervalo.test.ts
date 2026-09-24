import { describe, expect, it } from "vitest";
import { codigosDoIntervalo } from "./selecao-intervalo";

const LISTA = [10, 20, 30, 40, 50];

describe("Shift+clique", () => {
  it("pega do anterior até o clicado, com as pontas", () => {
    expect(codigosDoIntervalo(LISTA, 20, 40)).toEqual([20, 30, 40]);
  });

  it("vale de baixo para cima", () => {
    expect(codigosDoIntervalo(LISTA, 50, 30)).toEqual([30, 40, 50]);
  });

  it("sem âncora, só o clicado", () => {
    expect(codigosDoIntervalo(LISTA, null, 30)).toEqual([30]);
  });

  it("âncora que a busca escondeu não puxa intervalo invisível", () => {
    expect(codigosDoIntervalo(LISTA, 99, 30)).toEqual([30]);
  });

  it("clicar na própria âncora é só ela", () => {
    expect(codigosDoIntervalo(LISTA, 30, 30)).toEqual([30]);
  });
});
