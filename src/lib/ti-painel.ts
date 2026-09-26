import "server-only";
import { appQuery } from "./app-db";
import { dataBR } from "./format";
import { cofreTemChave, listarAcessos, listarRegistro } from "./ti-acessos";
import {
  diasEntre,
  DIAS_LICENCA,
  fraseEvento,
  segredoAntigo,
  tipoAcesso,
} from "./ti-acessos-tipos";
import { listarEquipamentos, listarExternos, listarMovimentacoes, pessoasTi } from "./ti-equipamentos";
import {
  DIAS_GARANTIA,
  DIAS_MANUTENCAO_LONGA,
  type AtividadeTi,
  type PainelTi,
  type PainelTiAcessos,
  type PainelTiEquipamentos,
  type PendenciaTi,
  type TipoPendenciaTi,
} from "./ti-painel-tipos";
import { hojeEscritorio } from "./ti-regras";
import {
  aRecolher,
  chaveDaPosse,
  chavePessoa,
  comAlguem,
  frasePosse,
  nomeEquipamento,
  situacaoDaPosse,
  type EquipamentoLista,
} from "./ti-tipos";

/**
 * Monta o Painel da TI. Cada lado é uma consulta independente: o inventário lê
 * o Diretório do RH (o Questor), o cofre só o banco do app, e o que falhar vira
 * buraco só no bloco dele.
 */

interface Bloco<T> {
  resumo: T;
  pendencias: PendenciaTi[];
  atividade: AtividadeTi[];
}

const identificacao = (e: Pick<EquipamentoLista, "tipo" | "marca" | "modelo" | "patrimonio">) =>
  e.patrimonio ? `${e.patrimonio} · ${nomeEquipamento(e)}` : nomeEquipamento(e);

async function blocoEquipamentos(hoje: string): Promise<Bloco<PainelTiEquipamentos>> {
  const [lista, externos, diretorio, movimentacoes] = await Promise.all([
    listarEquipamentos(),
    listarExternos(),
    // Sem o Diretório, o resto do inventário continua valendo; só o "a recolher" de quem é da casa fica sem resposta.
    pessoasTi().catch((err) => {
      console.error("[ti-painel] diretório", err instanceof Error ? err.message : err);
      return null;
    }),
    listarMovimentacoes(),
  ]);
  const ativos = diretorio ? new Set(diretorio.map((p) => chavePessoa(p.empresa, p.contrato))) : null;
  const encerrados = new Set(externos.filter((x) => !x.ativo).map((x) => x.id));

  const r: PainelTiEquipamentos = {
    ativos: 0,
    uso: 0,
    pessoas: 0,
    estoque: 0,
    manutencao: 0,
    baixados: 0,
    aRecolher: ativos ? 0 : null,
    manutencaoLonga: 0,
    garantiasVencendo: 0,
    porTipo: [],
  };
  const pessoas = new Set<string>();
  const porTipo = new Map<string, { tipo: string; uso: number; estoque: number; manutencao: number }>();
  const pendencias: PendenciaTi[] = [];

  for (const e of lista) {
    const s = situacaoDaPosse(e.posse);
    if (s === "baixado") {
      r.baixados++;
      continue;
    }
    r.ativos++;
    r[s]++;
    const t = porTipo.get(e.tipo) ?? { tipo: e.tipo, uso: 0, estoque: 0, manutencao: 0 };
    t[s]++;
    porTipo.set(e.tipo, t);
    if (comAlguem(e.posse)) pessoas.add(chaveDaPosse(e.posse));
    const alvo = { secao: "equipamentos" as const, id: e.id };

    // Com o Diretório fora do ar, só quem é de fora pode ser dito encerrado.
    if (aRecolher(e.posse, ativos, encerrados)) {
      if (r.aRecolher != null) r.aRecolher++;
      const p = e.posse as Extract<typeof e.posse, { nome: string }>;
      pendencias.push({
        chave: `recolher:${e.id}`,
        tipo: "recolher",
        alvo,
        titulo: identificacao(e),
        apoio: `Com ${p.nome} · ${e.posse.destino === "externo" ? "cadastro encerrado" : "saiu do Diretório"}`,
        dias: diasEntre(e.desde, hoje),
      });
    }
    if (e.posse.destino === "manutencao") {
      const dias = diasEntre(e.desde, hoje);
      if (dias > DIAS_MANUTENCAO_LONGA) {
        r.manutencaoLonga++;
        pendencias.push({
          chave: `manutencao:${e.id}`,
          tipo: "manutencao",
          alvo,
          titulo: identificacao(e),
          apoio: e.posse.local ? `Em manutenção em ${e.posse.local} desde ${dataBR(e.desde)}` : `Em manutenção desde ${dataBR(e.desde)}`,
          dias,
        });
      }
    }
    if (e.garantiaAte) {
      const faltam = diasEntre(hoje, e.garantiaAte);
      if (faltam >= 0 && faltam <= DIAS_GARANTIA) {
        r.garantiasVencendo++;
        pendencias.push({
          chave: `garantia:${e.id}`,
          tipo: "garantia",
          alvo,
          titulo: identificacao(e),
          apoio: `Garantia até ${dataBR(e.garantiaAte)}`,
          dias: faltam,
        });
      }
    }
  }
  r.pessoas = pessoas.size;
  r.porTipo = [...porTipo.values()].sort((a, b) => b.uso + b.estoque + b.manutencao - (a.uso + a.estoque + a.manutencao));

  const atividade: AtividadeTi[] = movimentacoes.slice(0, 10).map((m) => ({
    chave: `mov:${m.id}`,
    origem: "equipamentos",
    alvoId: m.equipamentoId,
    icone: "transferir",
    titulo: frasePosse(m).titulo,
    alvo: identificacao(m.equipamento),
    por: m.registradoPor,
    em: m.registradoEm,
  }));

  return { resumo: r, pendencias, atividade };
}

async function blocoAcessos(hoje: string): Promise<Bloco<PainelTiAcessos>> {
  const [acessos, registro, [contagem]] = await Promise.all([
    listarAcessos(),
    listarRegistro(10),
    appQuery<{ vistas7: number; trocas30: number }>(
      `select count(*) filter (where acao in ('revelado', 'copiado') and em > now() - interval '7 days')::int as vistas7,
              count(*) filter (where acao = 'segredo' and em > now() - interval '30 days')::int as trocas30
         from ti_acesso_evento`
    ),
  ]);

  const porTipo = new Map<string, number>();
  const grupos = new Set<string>();
  const pendencias: PendenciaTi[] = [];
  let senhasAntigas = 0;
  let licencasVencendo = 0;
  let outraChave = 0;

  for (const a of acessos) {
    porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
    if (a.grupo) grupos.add(a.grupo.toLowerCase());
    if (a.outraChave.length) outraChave++;
    const alvo = { secao: "acessos" as const, id: a.id };
    const antiga = segredoAntigo(a, hoje);
    if (antiga) {
      senhasAntigas++;
      pendencias.push({
        chave: `senha:${a.id}`,
        tipo: "senha",
        alvo,
        titulo: a.nome,
        apoio: `${tipoAcesso(a.tipo).rotulo} · trocada em ${dataBR(antiga)}`,
        dias: diasEntre(antiga, hoje),
      });
    }
    const validade = a.campos.validade;
    if (validade) {
      const faltam = diasEntre(hoje, validade);
      if (faltam <= DIAS_LICENCA) {
        licencasVencendo++;
        pendencias.push({
          chave: `licenca:${a.id}`,
          tipo: "licenca",
          alvo,
          titulo: a.nome,
          apoio: `${faltam < 0 ? "Venceu" : "Vence"} em ${dataBR(validade)}`,
          dias: faltam,
        });
      }
    }
  }

  const atividade: AtividadeTi[] = registro.map((ev) => {
    const f = fraseEvento(ev, ev.acesso.tipo);
    return {
      chave: `acesso:${ev.id}`,
      origem: "acessos",
      alvoId: ev.acesso.id,
      icone: f.icone,
      titulo: f.titulo,
      alvo: ev.acesso.nome,
      por: ev.usuario,
      em: ev.em,
    };
  });

  return {
    resumo: {
      total: acessos.length,
      grupos: grupos.size,
      porTipo: [...porTipo.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
      senhasAntigas,
      licencasVencendo,
      vistas7: contagem?.vistas7 ?? 0,
      trocas30: contagem?.trocas30 ?? 0,
      chave: cofreTemChave(),
      outraChave,
    },
    pendencias,
    atividade,
  };
}

/** O que pesa mais sobe: equipamento com quem saiu antes de garantia a vencer. */
const PESO: Record<TipoPendenciaTi, number> = { recolher: 0, licenca: 1, manutencao: 2, senha: 3, garantia: 4 };

function ordemPendencia(a: PendenciaTi, b: PendenciaTi): number {
  if (a.tipo !== b.tipo) return PESO[a.tipo] - PESO[b.tipo];
  // Garantia e licença: o que vence antes primeiro. O resto: o mais antigo primeiro.
  return a.tipo === "garantia" || a.tipo === "licenca" ? a.dias - b.dias : b.dias - a.dias;
}

async function comFalha<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[ti-painel] ${nome}`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function montarPainelTi(pode: { equipamentos: boolean; acessos: boolean }): Promise<PainelTi> {
  const hoje = hojeEscritorio();
  const [eq, ac] = await Promise.all([
    pode.equipamentos ? comFalha("equipamentos", () => blocoEquipamentos(hoje)) : null,
    pode.acessos ? comFalha("acessos", () => blocoAcessos(hoje)) : null,
  ]);
  return {
    hoje,
    permitido: pode,
    equipamentos: eq?.resumo ?? null,
    acessos: ac?.resumo ?? null,
    pendencias: [...(eq?.pendencias ?? []), ...(ac?.pendencias ?? [])].sort(ordemPendencia),
    atividade: [...(eq?.atividade ?? []), ...(ac?.atividade ?? [])].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 12),
  };
}
