import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { registrarAuditoria } from "@/lib/auditoria";
import { FilterError } from "@/lib/fiscal-filters";
import { planoQuestor } from "@/lib/plano-contabil";
import {
  aplicarOverrides,
  listarOverrides,
  removerOverride,
  salvarOverride,
  type SalvarOverride,
} from "@/lib/plano-override";
import { aprenderContabilizacao, buscarAutoContabiliza } from "@/lib/aprender-contabilizacao";
import type { EstabInfo, PlanoResp } from "@/lib/types";

const POR_PAGINA = 50;

/**
 * Plano de contabilização da empresa. É configuração **fixa**: vale enquanto
 * não for alterada, sem relação com período — por isso esta rota não recebe
 * inicio/fim. Vem do Questor e, onde houver override cadastrado, do override.
 */
export const GET = apiRoute(async (req) => {
  const p = req.nextUrl.searchParams;

  const empresa = Number(p.get("empresa"));
  if (!Number.isInteger(empresa)) throw new FilterError("Selecione uma empresa");
  await assertEmpresaVisivel(empresa);

  const estabParam = p.get("estab");
  const estab = estabParam ? Number(estabParam) : undefined;
  if (estabParam && !Number.isInteger(estab)) throw new FilterError("Estabelecimento inválido");

  const busca = (p.get("busca") ?? "").trim().toLowerCase();
  const filtro = p.get("filtro") ?? "todos";
  const pagina = Math.max(1, Number(p.get("pagina") ?? 1) || 1);

  const client = await pool.connect();
  try {
    const [planoBruto, overrides] = await Promise.all([
      planoQuestor(client, empresa, { estab }),
      listarOverrides(empresa),
    ]);

    // "Contabiliza?" vem do cadastro aprendido do histórico (semeado na primeira
    // vez). Override manda; senão vale o aprendido; sem aprendido, a config crua.
    let autoContab = await buscarAutoContabiliza(empresa);
    if (autoContab.size === 0) {
      await aprenderContabilizacao(client, empresa);
      autoContab = await buscarAutoContabiliza(empresa);
    }

    const todos = aplicarOverrides(planoBruto, overrides).map((p) => {
      const auto = autoContab.get(`${p.estab}:${p.cfop}`);
      const aprendido = auto
        ? { contabiliza: auto.contabiliza, notas: auto.notas, contabilizadas: auto.contabilizadas }
        : null;
      const contabiliza =
        p.origem === "override" ? p.contabiliza : (auto?.contabiliza ?? p.contabiliza);
      return { ...p, contabiliza, aprendido };
    });

    const filtrados = todos
      .filter((c) => {
        if (filtro === "ent" && c.lado !== "ent") return false;
        if (filtro === "sai" && c.lado !== "sai") return false;
        if (filtro === "override" && c.origem !== "override") return false;
        if (filtro === "naocontabiliza" && c.contabiliza) return false;
        if (!busca) return true;
        return (
          String(c.cfop).includes(busca) ||
          String(c.cfopBase).includes(busca) ||
          (c.descricao ?? "").toLowerCase().includes(busca)
        );
      })
      // Overrides primeiro: é o que o usuário mexeu e quer reencontrar.
      .sort(
        (a, b) =>
          Number(b.origem === "override") - Number(a.origem === "override") ||
          a.cfop - b.cfop ||
          a.estab - b.estab
      );

    const pagina1 = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

    // Identifica cada estabelecimento pelo CNPJ — "estab 2" sozinho não diz nada.
    const codigos = [...new Set(todos.map((c) => c.estab))].sort((a, b) => a - b);
    const estabRes = await client.query<EstabInfo>(
      `select codigoestab codigo, btrim(nomeestab) nome, inscrfederal cnpj, siglaestado uf
         from estab where codigoempresa = $1 and codigoestab = any($2::int[])`,
      [empresa, codigos]
    );
    const porCodigo = new Map(estabRes.rows.map((e) => [e.codigo, e]));

    return {
      empresa,
      estabs: codigos.map(
        (c) => porCodigo.get(c) ?? { codigo: c, nome: null, cnpj: null, uf: null }
      ),
      cfops: pagina1,
      total: filtrados.length,
      totalGeral: todos.length,
      overrides: todos.filter((c) => c.origem === "override").length,
      pagina,
      porPagina: POR_PAGINA,
    } satisfies PlanoResp;
  } finally {
    client.release();
  }
});

interface CorpoOverride {
  empresa?: number;
  estab?: number;
  cfop?: number;
  contabiliza?: boolean;
  observacao?: string | null;
  linhas?: Array<{
    natureza?: number;
    conta?: number | null;
    origemConta?: number;
    regraValor?: string | null;
    rotulo?: string | null;
  }>;
}

/** Cria ou atualiza o override de um CFOP. */
export const PUT = apiRoute(async (req) => {
  const corpo = (await req.json()) as CorpoOverride;
  const { empresa, cfop } = corpo;
  if (!Number.isInteger(empresa) || !Number.isInteger(cfop)) {
    throw new FilterError("Informe empresa e cfop");
  }
  await assertEmpresaVisivel(empresa!);
  const estab = corpo.estab ?? 0;
  if (!Number.isInteger(estab) || estab < 0) throw new FilterError("Estabelecimento inválido");

  const contabiliza = corpo.contabiliza ?? true;
  const linhas: SalvarOverride["linhas"] = (corpo.linhas ?? []).map((l, i) => {
    const origemConta = l.origemConta ?? 0;
    const conta = origemConta === 0 ? (l.conta ?? null) : null;
    if (origemConta === 0 && conta == null) {
      throw new FilterError(`Lançamento ${i + 1}: informe a conta contábil`);
    }
    const natureza = l.natureza;
    if (natureza !== 1 && natureza !== -1) {
      throw new FilterError(`Lançamento ${i + 1}: natureza deve ser débito ou crédito`);
    }
    return {
      natureza,
      conta,
      origemConta,
      regraValor: l.regraValor ?? null,
      rotulo: l.rotulo ?? null,
    };
  });
  if (contabiliza && !linhas.length) {
    throw new FilterError("Um CFOP que contabiliza precisa de ao menos um lançamento");
  }

  const id = await salvarOverride({
    empresa: empresa!,
    estab,
    cfop: cfop!,
    contabiliza,
    observacao: corpo.observacao ?? null,
    linhas,
  });
  // Configurar o plano é trabalho contábil como conciliar é: muda o que a
  // Conferência vai cobrar de todas as notas daquele CFOP dali pra frente.
  await registrarAuditoria({
    acao: "contabil.plano.salvar",
    modulo: "contabil",
    alvo: `CFOP ${cfop} · empresa ${empresa}`,
    codigoempresa: empresa!,
    detalhe: { cfop, estab, contabiliza, linhas: linhas.length },
  });
  return { id, ok: true };
});

/** Remove o override — o CFOP volta a seguir o plano do Questor. */
export const DELETE = apiRoute(async (req) => {
  const p = req.nextUrl.searchParams;
  const empresa = Number(p.get("empresa"));
  const cfop = Number(p.get("cfop"));
  const estab = Number(p.get("estab") ?? 0);
  if (!Number.isInteger(empresa) || !Number.isInteger(cfop) || !Number.isInteger(estab)) {
    throw new FilterError("Informe empresa e cfop");
  }
  await assertEmpresaVisivel(empresa);
  const removido = await removerOverride(empresa, estab, cfop);
  if (removido) {
    await registrarAuditoria({
      acao: "contabil.plano.reverter",
      modulo: "contabil",
      alvo: `CFOP ${cfop} · empresa ${empresa}`,
      codigoempresa: empresa,
      detalhe: { cfop, estab },
    });
  }
  return { ok: removido };
});
