import { describe, expect, it } from "vitest";
import { aplicarContaEfetiva, type ContaEfetiva } from "./conta-efetiva-calculo";
import type { PlanoCfop } from "./types";

function natureza(cfop: number, conta: number, origem: PlanoCfop["origem"] = "questor"): PlanoCfop {
  return {
    estab: 1,
    cfop,
    cfopBase: Number(String(cfop).slice(0, 4)),
    descricao: "Serviços Tomados S/ Retenção",
    lado: "ent",
    contaLivro: null,
    origem,
    contabiliza: true,
    componentes: [
      {
        id: "vlrcontabil",
        rotulo: "Valor contábil",
        retido: false,
        tabela: 748,
        descrTabela: null,
        linhas: [
          { seq: 1, natureza: 1, conta, contaVariavel: false, origemConta: 0, descrConta: "Serviços de Terceiros", regraValor: "vlrContabil" },
          { seq: 2, natureza: -1, conta: null, contaVariavel: true, origemConta: 2, descrConta: null, regraValor: "vlrContabil" },
        ],
      },
      {
        id: "pis",
        rotulo: "PIS",
        retido: false,
        tabela: 748,
        descrTabela: null,
        linhas: [
          { seq: 3, natureza: 1, conta: 384, contaVariavel: false, origemConta: 0, descrConta: "PIS a Recuperar", regraValor: "vlrPISOutros" },
        ],
      },
    ],
  };
}

const aprendido = (over: Partial<ContaEfetiva> = {}): ContaEfetiva => ({
  contaPlano: 3171,
  contaEfetiva: 4537,
  descrEfetiva: "Serviços Profissionais",
  habitual: true,
  notas: 40,
  acertos: 39,
  ...over,
});

const principal = (p: PlanoCfop) => p.componentes.find((c) => c.id === "vlrcontabil")!.linhas[0];

describe("aplicarContaEfetiva", () => {
  it("troca a conta morta do Questor pela conta habitual da natureza", () => {
    const [p] = aplicarContaEfetiva([natureza(8000001, 3171)], new Map([["1:8000001", aprendido()]]));
    expect(principal(p).conta).toBe(4537);
    expect(principal(p).descrConta).toBe("Serviços Profissionais");
    expect(p.contaEfetiva).toEqual({ de: 3171, para: 4537, notas: 40, acertos: 39 });
  });

  it("não mexe quando o Questor já aponta para a conta habitual", () => {
    const plano = [natureza(8000001, 4537)];
    const [p] = aplicarContaEfetiva(plano, new Map([["1:8000001", aprendido()]]));
    expect(p).toBe(plano[0]);
  });

  it("natureza genérica vira conta decidida no lançamento, sem conta a cobrar", () => {
    const [p] = aplicarContaEfetiva(
      [natureza(8001015, 4537)],
      new Map([["1:8001015", aprendido({ habitual: false, contaEfetiva: null, descrEfetiva: null })]])
    );
    expect(principal(p).contaVariavel).toBe(true);
    expect(principal(p).conta).toBeNull();
    expect(p.contaEfetiva?.para).toBeNull();
  });

  it("não toca nas linhas de tributo — a regra delas não envelhece", () => {
    const [p] = aplicarContaEfetiva([natureza(8000001, 3171)], new Map([["1:8000001", aprendido()]]));
    expect(p.componentes.find((c) => c.id === "pis")!.linhas[0].conta).toBe(384);
  });

  it("override manual fica intacto — é a decisão de quem sabe", () => {
    const over = natureza(8000001, 3171, "override");
    const [a] = aplicarContaEfetiva([over], new Map([["1:8000001", aprendido()]]));
    expect(a).toBe(over);
  });

  it("natureza de mercadoria fica intacta — lá o aprendizado por nota não serve", () => {
    const merc = [natureza(1102, 3171)];
    const [p] = aplicarContaEfetiva(merc, new Map([["1:1102", aprendido()]]));
    expect(p).toBe(merc[0]);
  });
});
