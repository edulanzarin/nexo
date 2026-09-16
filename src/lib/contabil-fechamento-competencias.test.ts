import { describe, expect, it } from "vitest";
import { competenciasDoFechamento } from "./contabil-fechamento-competencias";

/**
 * A regra que decide de que mês são os números da aba Fechamento. O caso que a
 * motivou: em 16/09, com o período padrão da barra (do dia 1º até hoje), a tela
 * media set/26 — mês que ainda não encerrou — e mostrava o escritório inteiro em
 * aberto com 0% fechado.
 */
describe("competenciasDoFechamento", () => {
  it("mede o mês anterior quando o período é só o mês corrente", () => {
    const c = competenciasDoFechamento("2026-09-01", "2026-09-16", "2026-09-16");
    expect(c.referencia).toBe("2026-08-01");
    // set/26 continua na fita: ele existe, só não é o que se cobra.
    expect(c.meses).toEqual(["2026-08-01", "2026-09-01"]);
    expect(c.naoEncerradas).toEqual(["2026-09-01"]);
  });

  it("mede a última encerrada do período, não a última do período", () => {
    const c = competenciasDoFechamento("2026-01-01", "2026-09-09", "2026-09-16");
    expect(c.referencia).toBe("2026-08-01");
    expect(c.meses).toHaveLength(9);
    expect(c.naoEncerradas).toEqual(["2026-09-01"]);
  });

  it("não mexe em período inteiro no passado", () => {
    const c = competenciasDoFechamento("2026-03-01", "2026-05-31", "2026-09-16");
    expect(c.referencia).toBe("2026-05-01");
    expect(c.naoEncerradas).toEqual([]);
    expect(c.janela).toEqual({ inicio: "2026-03-01", fim: "2026-05-31" });
  });

  it("atravessa a virada do ano", () => {
    const c = competenciasDoFechamento("2027-01-01", "2027-01-08", "2027-01-08");
    expect(c.referencia).toBe("2026-12-01");
    expect(c.meses).toEqual(["2026-12-01", "2027-01-01"]);
    expect(c.janela).toEqual({ inicio: "2026-12-01", fim: "2027-01-31" });
  });

  it("varre a competência inteira, mesmo com período pela metade", () => {
    // O fechamento de ago/26 pode ser lançado no dia 28; um período que termina
    // no dia 9 precisa enxergá-lo, senão a empresa aparece em aberto sem estar.
    const c = competenciasDoFechamento("2026-08-09", "2026-08-09", "2026-09-16");
    expect(c.janela).toEqual({ inicio: "2026-08-01", fim: "2026-08-31" });
  });

  it("fim de fevereiro em ano bissexto", () => {
    const c = competenciasDoFechamento("2028-02-10", "2028-02-10", "2028-04-01");
    expect(c.janela).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
  });
});
