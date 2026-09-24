import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRABALHOS_CONTABIL,
  TRABALHOS_FISCAL,
  classeDaAcao,
  idsDeProducao,
  trabalhosDe,
  type ModuloApp,
} from "./prod-app-tipos";

const MODULOS: ModuloApp[] = ["contabil", "fiscal"];

describe("catálogo de trabalhos do app", () => {
  it("não repete id dentro de um módulo", () => {
    for (const m of MODULOS) {
      const ids = trabalhosDe(m).map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("não põe o mesmo verbo em duas classes", () => {
    for (const m of MODULOS) {
      const acoes = trabalhosDe(m).flatMap((t) => t.acoes);
      expect(new Set(acoes).size).toBe(acoes.length);
    }
  });

  it("só cataloga verbo do próprio módulo — senão o Fiscal contaria trabalho do Contábil", () => {
    for (const m of MODULOS) {
      for (const acao of trabalhosDe(m).flatMap((t) => t.acoes)) {
        expect(acao.startsWith(`${m}.`)).toBe(true);
      }
    }
  });

  it("verbo conhecido cai na sua classe; desconhecido cai em outros", () => {
    expect(classeDaAcao("contabil", "contabil.conciliacao.gerar")).toBe("conciliacao");
    expect(classeDaAcao("contabil", "contabil.regra.salvar")).toBe("base");
    expect(classeDaAcao("contabil", "contabil.export")).toBe("leitura");
    expect(classeDaAcao("fiscal", "fiscal.nota.ver")).toBe("nota");
    expect(classeDaAcao("contabil", "contabil.inventado.agora")).toBe("outros");
    // Verbo do outro módulo não vaza de lado nenhum.
    expect(classeDaAcao("fiscal", "contabil.conciliacao.gerar")).toBe("outros");
  });

  it("o Contábil produz; o Fiscal, dentro do app, não", () => {
    expect(idsDeProducao("contabil").length).toBeGreaterThan(0);
    // Não é lapso: o módulo Fiscal é painel sobre base somente leitura — não há
    // gesto ali que grave nada. Se um dia gravar, este teste é o lembrete de
    // classificar o verbo novo como produção.
    expect(idsDeProducao("fiscal")).toEqual([]);
  });

  it("toda classe tem cor, rótulo e descrição — a legenda não aceita buraco", () => {
    for (const m of MODULOS) {
      for (const t of trabalhosDe(m)) {
        expect(t.rotulo).not.toBe("");
        expect(t.descricao).not.toBe("");
        expect(t.cor).toMatch(/^var\(--/);
      }
    }
  });
});

/**
 * A aba No Nexo só enxerga gesto instrumentado, e só CLASSIFICA gesto
 * catalogado. Verbo novo registrado no código sem entrada no catálogo cairia em
 * "Outros" em silêncio — este teste varre o `src` atrás dos verbos gravados e
 * cobra a classificação de cada um.
 */
function verbosRegistradosNoCodigo(): string[] {
  const raiz = join(process.cwd(), "src");
  const verbos = new Set<string>();

  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        varrer(caminho);
        continue;
      }
      if (!/\.tsx?$/.test(nome) || nome.endsWith(".test.ts")) continue;
      const texto = readFileSync(caminho, "utf8");
      for (const m of texto.matchAll(/acao:\s*"((?:contabil|fiscal)\.[a-z.]+)"/g)) {
        verbos.add(m[1]);
      }
    }
  };
  varrer(raiz);
  return [...verbos];
}

describe("catálogo cobre o que o app de fato registra", () => {
  it("todo verbo literal gravado no código tem classe", () => {
    const semClasse = verbosRegistradosNoCodigo().filter((v) => {
      const modulo = v.split(".")[0] as ModuloApp;
      return classeDaAcao(modulo, v) === "outros";
    });
    expect(semClasse).toEqual([]);
  });

  it("os verbos DERIVADOS pelo beacon também estão catalogados", () => {
    // `/api/auditoria` monta `<modulo>.<tipo>` — não há literal para varrer, e
    // foi assim que a exportação ficou anos sem aparecer em lugar nenhum.
    for (const m of MODULOS) {
      for (const tipo of ["export", "consulta"]) {
        expect(classeDaAcao(m, `${m}.${tipo}`)).not.toBe("outros");
      }
    }
  });

  it("não cataloga verbo que ninguém registra — catálogo não é lista de desejos", () => {
    const registrados = new Set([
      ...verbosRegistradosNoCodigo(),
      ...MODULOS.flatMap((m) => [`${m}.export`, `${m}.consulta`]),
    ]);
    const orfaos = [...TRABALHOS_CONTABIL, ...TRABALHOS_FISCAL]
      .flatMap((t) => t.acoes)
      .filter((a) => !registrados.has(a));
    expect(orfaos).toEqual([]);
  });
});
