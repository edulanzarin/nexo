import { describe, expect, it } from "vitest";
import { periodosEmAberto } from "./controle-ferias";

/**
 * A regra CLT: a cada 12 meses de trabalho nasce um período aquisitivo (30 dias
 * de direito); a empresa tem os 12 meses seguintes (concessivo) para conceder,
 * senão paga em DOBRO. `periodosEmAberto` deriva os períodos completos e ainda
 * não gozados, marcando `vencido` quando o concessivo já passou.
 */
describe("periodosEmAberto — período aquisitivo/concessivo", () => {
  it("empregado com < 1 ano não tem período aberto", () => {
    // admissão 2026-01-01, ref 2026-06-01: 1º aquisitivo fecharia em 2027-01-01
    expect(periodosEmAberto("2026-01-01", "2026-06-01", [])).toEqual([]);
  });

  it("deriva períodos completos, com limite de concessão = fim + 12 meses", () => {
    const abertos = periodosEmAberto("2024-01-15", "2026-03-01", []);
    expect(abertos).toHaveLength(2);

    // 1º período: aquisitivo fechou em 2025-01-15, concessivo até 2026-01-15 (já passou de ref) => vencido
    expect(abertos[0]).toMatchObject({
      inicio: "2024-01-15",
      fim: "2025-01-15",
      limite: "2026-01-15",
      vencido: true,
    });
    expect(abertos[0].diasParaLimite).toBeLessThan(0);

    // 2º período: aquisitivo fechou em 2026-01-15, concessivo até 2027-01-15 (futuro) => não vencido
    expect(abertos[1]).toMatchObject({
      inicio: "2025-01-15",
      fim: "2026-01-15",
      limite: "2027-01-15",
      vencido: false,
    });
    expect(abertos[1].diasParaLimite).toBeGreaterThan(0);
  });

  it("período não fechado até a referência é ignorado (não conta o em curso)", () => {
    // 3º período aquisitivo (2026-01-15..2027-01-15) ainda não fechou em 2026-03-01
    const abertos = periodosEmAberto("2024-01-15", "2026-03-01", []);
    expect(abertos.some((p) => p.inicio === "2026-01-15")).toBe(false);
  });

  it("período com recibo de gozo (início do aquisitivo casa) sai da lista", () => {
    // gozou o 1º período (aquisitivo iniciado em 2024-01-15)
    const abertos = periodosEmAberto("2024-01-15", "2026-03-01", ["2024-01-15"]);
    expect(abertos).toHaveLength(1);
    expect(abertos[0].inicio).toBe("2025-01-15");
  });

  it("recibo fora de qualquer período aberto não zera nada", () => {
    const abertos = periodosEmAberto("2024-01-15", "2026-03-01", ["2019-05-05"]);
    expect(abertos).toHaveLength(2);
  });
});
