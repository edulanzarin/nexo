/**
 * Serviço da Conferência Fiscal — o núcleo `conferir` que cruza as notas do
 * período com os lançamentos contábeis e o plano de contabilização. Vive na base
 * (e não na rota) porque a Central de Pendências também consome o `resumo` desta
 * conferência: extrair aqui é o que evita duplicar a classificação de nota.
 */
import { PoolClient } from "pg";
import { planoQuestor } from "@/lib/plano-contabil";
import { aplicarOverrides, listarOverrides } from "@/lib/plano-override";
import { aprenderContabilizacao, buscarAutoContabiliza } from "@/lib/aprender-contabilizacao";
import { conferirNota, type LancamentoReal, type ValoresNota } from "@/lib/divergencias";
import type {
  ConferenciaResp,
  ConfResumo,
  ConsolidacaoInfo,
  Duplicidade,
  Faceta,
  NotaConferida,
  PlanoCfop,
  SituacaoNota,
} from "@/lib/types";

/** Lançamento com o dia em que foi feito — o dia é o que denuncia a duplicidade. */
type LancamentoComDia = LancamentoReal & { dia: string };

/**
 * Duplicidade = a MESMA partida (débito, crédito, valor) aparece em dias de
 * lançamento distintos: re-rodaram a contabilização. Não confundir com nota
 * lançada em parcelas (partidas diferentes) nem com itens iguais no mesmo dia
 * (mesma partida, mesmo dia) — por isso o critério é "partida idêntica em 2+
 * DIAS", validado contra os dados reais.
 */
function detectarDuplicidade(
  lancamentos: LancamentoComDia[],
  valorNota: number
): Duplicidade | null {
  const diasPorPartida = new Map<string, Set<string>>();
  for (const l of lancamentos) {
    const key = `${l.contaDeb ?? ""}|${l.contaCred ?? ""}|${l.valor.toFixed(2)}`;
    let dias = diasPorPartida.get(key);
    if (!dias) {
      dias = new Set();
      diasPorPartida.set(key, dias);
    }
    dias.add(l.dia);
  }
  let vezes = 1;
  const datas = new Set<string>();
  for (const dias of diasPorPartida.values()) {
    if (dias.size >= 2) {
      vezes = Math.max(vezes, dias.size);
      for (const d of dias) datas.add(d);
    }
  }
  if (vezes < 2) return null;
  return { vezes, valor: valorNota * (vezes - 1), datas: [...datas].sort() };
}

/**
 * Contas FIXAS (não-variáveis) que a nota postaria pelo plano, com natureza e
 * rótulo. É o que se cruza com as contas tocadas por consolidação (MOV) para
 * decidir se uma nota sem lançamento individual está, na verdade, lançada em
 * bloco. Contas variáveis (fornecedor/cliente por pessoa) não entram: a
 * consolidação não passa por sub-razão de pessoa. Funciona igual para plano do
 * Questor (componentes por tributo) e override (componente único), porque só
 * olha as linhas fixas — não depende de id de componente nem de fórmula, que o
 * override não carrega.
 */
function contasFixasDaNota(
  planoNota: PlanoCfop[]
): { conta: number; natureza: 1 | -1; descr: string | null }[] {
  const out: { conta: number; natureza: 1 | -1; descr: string | null }[] = [];
  const vistas = new Set<string>();
  for (const p of planoNota) {
    for (const comp of p.componentes) {
      for (const l of comp.linhas) {
        if (l.contaVariavel || l.conta == null) continue;
        const key = `${l.natureza}:${l.conta}`;
        if (vistas.has(key)) continue;
        vistas.add(key);
        out.push({ conta: l.conta, natureza: l.natureza, descr: l.descrConta });
      }
    }
  }
  return out;
}

const POR_PAGINA = 100;
/** Teto de notas analisadas — a comparação com o plano roda em memória. */
const MAX_NOTAS = 8000;

interface LadoCfg {
  tabela: string;
  chave: string;
  itens: string;
  cfops: string;
  prefix: "ME" | "MS";
  funrural: string;
}
const ENT: LadoCfg = {
  tabela: "lctofisent",
  chave: "chavelctofisent",
  itens: "lctofisentproduto",
  cfops: "lctofisentcfop",
  prefix: "ME",
  funrural: "coalesce(n.valorfunrural, 0)",
};
const SAI: LadoCfg = {
  tabela: "lctofissai",
  chave: "chavelctofissai",
  itens: "lctofissaiproduto",
  cfops: "lctofissaicfop",
  prefix: "MS",
  funrural: "0",
};

interface NotaRow {
  chave: number;
  numero: number;
  serie: string | null;
  especie: string;
  data: string;
  estab: number;
  cancelada: boolean;
  valorcontabil: number;
  valoripi: number;
  valorfunrural: number;
  valoricms: number;
  contraparte: string | null;
  doc: string | null;
  uf: string | null;
}

/** Todas as notas do período, com os valores que alimentam as fórmulas do plano.
 *  `estabClause` recorta por filial (vazio = todas) — vem no $4 quando há filial. */
function sqlNotas(c: LadoCfg, estabClause: string): string {
  return `
    select n.${c.chave} chave, n.numeronf numero, n.serienf serie,
           upper(btrim(n.especienf)) especie, n.datalctofis data, n.codigoestab estab,
           (n.cancelada = '1') cancelada,
           coalesce(n.valorcontabil, 0) valorcontabil, coalesce(n.valoripi, 0) valoripi,
           ${c.funrural} valorfunrural,
           coalesce((select sum(f.valorimposto) from ${c.cfops} f
                      where f.codigoempresa = n.codigoempresa
                        and f.${c.chave} = n.${c.chave} and f.tipoimposto = 1), 0) valoricms,
           p.nomepessoa contraparte, p.inscrfederal doc, p.siglaestado uf
      from ${c.tabela} n
      left join pessoa p on p.codigopessoa = n.codigopessoa
     where n.codigoempresa = $1 and n.datalctofis between $2 and $3${estabClause}
     order by n.valorcontabil desc
     limit ${MAX_NOTAS + 1}`;
}

export type Ordem = "valor_desc" | "valor_asc" | "data_desc" | "data_asc" | "numero";

/** Agrupa pares [valor, rótulo] em facetas ordenadas por frequência. */
function contar(pares: ReadonlyArray<readonly [string, string | null]>): Faceta[] {
  const mapa = new Map<string, Faceta>();
  for (const [valor, rotulo] of pares) {
    const atual = mapa.get(valor);
    if (atual) atual.qtd += 1;
    else mapa.set(valor, { valor, rotulo, qtd: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.qtd - a.qtd || a.valor.localeCompare(b.valor));
}

export interface Opcoes {
  tipo: "ent" | "sai";
  situacao: string;
  busca: string;
  especies: string[];
  cfops: number[];
  ordem: Ordem;
  pagina: number;
}

/**
 * Núcleo da conferência: confere TODAS as notas do período de um lado
 * (ent/sai), SEM filtro de tela nem paginação, e devolve o resumo + a lista
 * inteira. É o que a Central de Pendências consome direto; a `conferir` (tela)
 * pagina e filtra por cima.
 */
export async function conferirTudo(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[],
  tipo: "ent" | "sai"
): Promise<{
  resumo: ConfResumo;
  conferidas: NotaConferida[];
  truncado: boolean;
  /** cfop → descrição, para as facetas da tela (a Central de Pendências ignora). */
  descrCfop: Map<number, string>;
}> {
  const c = tipo === "ent" ? ENT : SAI;
  const params = [empresa, inicio, fim];
  // Filial: recorta os scans de FATO (notas e a consolidação MOV). Os scans "por
  // chave" (lctoctb/itens) seguem as notas já filtradas, então não precisam. O
  // plano e o cadastro aprendido são por empresa/estab e ficam intactos.
  const temEstab = estabs.length > 0;
  const estabNota = temEstab ? ` and n.codigoestab = any($4::int[])` : "";
  const linhas = (
    await client.query<NotaRow>(sqlNotas(c, estabNota), temEstab ? [...params, estabs] : params)
  ).rows;
  const truncado = linhas.length > MAX_NOTAS;
  const notas = truncado ? linhas.slice(0, MAX_NOTAS) : linhas;

  const vazio: ConferenciaResp = {
    resumo: {
      total: 0,
      contabilizadas: 0,
      conformes: 0,
      divergentes: 0,
      duplicadas: 0,
      consolidadas: 0,
      pendentes: 0,
      naoExigem: 0,
      canceladas: 0,
      semPlano: 0,
      valorTotal: 0,
      valorPendente: 0,
      valorDivergente: 0,
      valorDuplicado: 0,
      valorConsolidado: 0,
    },
    notas: [],
    total: 0,
    pagina: 1,
    porPagina: POR_PAGINA,
    truncado: false,
    facetas: { especies: [], cfops: [] },
  };
  if (!notas.length)
    return { resumo: vazio.resumo, conferidas: [], truncado: false, descrCfop: new Map() };

  const chaves = notas.map((n) => n.chave);

  // Lançamentos contábeis (origem FI) de todas as notas de uma vez.
  const lctos = await client.query<{
    chave: number;
    deb: number | null;
    cred: number | null;
    valor: number;
    dia: string;
  }>(
    `select substring(chaveorigem from 3)::bigint chave, contactbdeb deb, contactbcred cred,
            valorlctoctb valor,
            coalesce(to_char(datahoralctoctb, 'YYYY-MM-DD'), to_char(datalctoctb, 'YYYY-MM-DD')) dia
       from lctoctb
      where codigoempresa = $1 and datalctoctb between $2 and $3
        and codigooriglctoctb = 'FI' and chaveorigem like '${c.prefix}%'
        and substring(chaveorigem from 3)::bigint = any($4::bigint[])`,
    [...params, chaves]
  );
  const porNota = new Map<number, LancamentoComDia[]>();
  // Contas que de fato recebem lançamento por nota — calibra o que é cobrável.
  const observadas = new Set<string>();
  for (const l of lctos.rows) {
    if (l.deb != null) observadas.add(`1:${l.deb}`);
    if (l.cred != null) observadas.add(`-1:${l.cred}`);
    const item = { contaDeb: l.deb, contaCred: l.cred, valor: Number(l.valor), dia: l.dia };
    const lista = porNota.get(l.chave);
    if (lista) lista.push(item);
    else porNota.set(l.chave, [item]);
  }

  const cfopsRes = await client.query<{ chave: number; cfop: number }>(
    `select distinct ${c.chave} chave, codigocfop cfop from ${c.itens}
      where codigoempresa = $1 and datalctofis between $2 and $3 and ${c.chave} = any($4::bigint[])`,
    [...params, chaves]
  );
  const cfopsPorNota = new Map<number, number[]>();
  const todosCfops = new Set<number>();
  for (const r of cfopsRes.rows) {
    todosCfops.add(r.cfop);
    const lista = cfopsPorNota.get(r.chave);
    if (lista) lista.push(r.cfop);
    else cfopsPorNota.set(r.chave, [r.cfop]);
  }

  const [planoBruto, overrides] = await Promise.all([
    planoQuestor(client, empresa, { cfops: [...todosCfops] }),
    listarOverrides(empresa),
  ]);
  const plano = aplicarOverrides(planoBruto, overrides);

  // "Este CFOP contabiliza?" vem do cadastro aprendido do histórico (últimos 12
  // meses) — não do mês da tela, que classificava tudo como "não exige" num mês
  // ainda não fechado, nem da config do Questor, que erra dos dois lados. É
  // semeado na primeira vez que a empresa é conferida; depois a aba Configuração
  // permite atualizar/ajustar.
  let autoContab = await buscarAutoContabiliza(empresa);
  if (autoContab.size === 0) {
    await aprenderContabilizacao(client, empresa);
    autoContab = await buscarAutoContabiliza(empresa);
  }

  const porChave = new Map<string, PlanoCfop>();
  const descrCfop = new Map<number, string>();
  for (const p of plano) {
    // Precedência: override (já aplicado) > aprendido > config do Questor.
    if (p.origem !== "override") {
      const auto = autoContab.get(`${p.estab}:${p.cfop}`);
      if (auto) p.contabiliza = auto.contabiliza;
    }
    porChave.set(`${p.estab}:${p.cfop}`, p);
    if (p.descricao && !descrCfop.has(p.cfop)) descrCfop.set(p.cfop, p.descricao);
  }

  // Contas tocadas por CONSOLIDAÇÃO (origem MOV) no período: varejo/cupom lançado
  // em bloco, sem nota individual (ex.: MOVMS...). Uma nota que "deve contabilizar"
  // e não tem lançamento por chave não está pendente se a receita/contrapartida
  // dela cai numa dessas contas — está dentro do bloco. Chave "natureza:conta"
  // (débito = 1, crédito = -1), igual a `observadas`.
  const movEstab = temEstab ? ` and codigoestab = any($4::int[])` : "";
  const movRows = await client.query<{ conta: number; nat: number }>(
    `select contactbdeb conta, 1 nat from lctoctb
       where codigoempresa = $1 and codigooriglctoctb = 'FI'
         and datalctoctb between $2 and $3 and chaveorigem like 'MOV%' and contactbdeb is not null${movEstab}
      group by contactbdeb
     union
     select contactbcred, -1 from lctoctb
       where codigoempresa = $1 and codigooriglctoctb = 'FI'
         and datalctoctb between $2 and $3 and chaveorigem like 'MOV%' and contactbcred is not null${movEstab}
      group by contactbcred`,
    temEstab ? [...params, estabs] : params
  );
  const contasConsolidadas = new Set<string>();
  const contasConsolidadasNums = new Set<number>();
  for (const r of movRows.rows) {
    contasConsolidadas.add(`${r.nat}:${r.conta}`);
    contasConsolidadasNums.add(r.conta);
  }

  // Os próprios lançamentos MOV que tocam essas contas — a prova que o detalhe
  // mostra para a nota consolidada, no lugar de um texto afirmando o fato.
  let movLancamentos: {
    data: string;
    origem: string;
    deb: number | null;
    cred: number | null;
    valor: number;
  }[] = [];
  if (contasConsolidadasNums.size) {
    const movLctEstab = temEstab ? ` and l.codigoestab = any($5::int[])` : "";
    const det = await client.query<(typeof movLancamentos)[number]>(
      `select coalesce(to_char(l.datalctoctb, 'YYYY-MM-DD'), '') data, l.chaveorigem origem,
              l.contactbdeb deb, l.contactbcred cred, l.valorlctoctb::float valor
         from lctoctb l
        where l.codigoempresa = $1 and l.codigooriglctoctb = 'FI'
          and l.datalctoctb between $2 and $3 and l.chaveorigem like 'MOV%'
          and (l.contactbdeb = any($4::bigint[]) or l.contactbcred = any($4::bigint[]))${movLctEstab}
        order by l.valorlctoctb desc
        limit 500`,
      temEstab ? [...params, [...contasConsolidadasNums], estabs] : [...params, [...contasConsolidadasNums]]
    );
    movLancamentos = det.rows;
  }

  const resumo: ConfResumo = { ...vazio.resumo };
  const conferidas: NotaConferida[] = [];

  for (const n of notas) {
    const cfops = (cfopsPorNota.get(n.chave) ?? []).sort((a, b) => a - b);
    const lancamentos = porNota.get(n.chave) ?? [];
    const valor = Number(n.valorcontabil);

    resumo.total += 1;
    resumo.valorTotal += valor;

    let situacao: SituacaoNota;
    let divergencias: NotaConferida["divergencias"] = [];
    let duplicidade: Duplicidade | null = null;
    let consolidacao: ConsolidacaoInfo | null = null;

    if (n.cancelada) {
      situacao = "cancelada";
      resumo.canceladas += 1;
    } else {
      duplicidade = detectarDuplicidade(lancamentos, valor);
      const planoNota = cfops
        .map((cf) => porChave.get(`${n.estab}:${cf}`))
        .filter((p): p is PlanoCfop => p != null);
      // Nota sem item (serviço) não tem CFOP: assume-se que deve contabilizar.
      const deveContabilizar =
        cfops.length === 0 || planoNota.some((p) => p.contabiliza);

      if (lancamentos.length > 0) {
        resumo.contabilizadas += 1;
        if (duplicidade) {
          // Contabilizada mais de uma vez: é o problema principal e ofusca a
          // conferência de conta (os valores vêm dobrados). Não computa divergência.
          situacao = "duplicada";
          resumo.duplicadas += 1;
          resumo.valorDuplicado += duplicidade.valor;
        } else {
          const conferiveis = planoNota.filter((p) => p.contabiliza);
          if (!conferiveis.length) {
            // Contabilizada, mas sem plano para comparar as contas.
            situacao = "ok";
            resumo.semPlano += 1;
            resumo.conformes += 1;
          } else {
            const valores: ValoresNota = {
              vlrContabil: valor,
              vlrICMS: Number(n.valoricms),
              vlrIPI: Number(n.valoripi),
              vlrFunRural: Number(n.valorfunrural),
            };
            divergencias = conferirNota(lancamentos, conferiveis, valores, {
              observadas,
              checarValor: cfops.length === 1,
            });
            if (divergencias.length) {
              situacao = "divergente";
              resumo.divergentes += 1;
              resumo.valorDivergente += valor;
            } else {
              situacao = "ok";
              resumo.conformes += 1;
            }
          }
        }
      } else {
        // Sem lançamento por nota. Antes de pendência, checa consolidação: o
        // bloco MOV é uma partida (débito clientes/caixa × crédito receita). Se a
        // nota posta, entre as contas fixas do plano, um débito E um crédito que
        // o MOV cobre, a partida principal dela coincide com a consolidação — está
        // lançada em bloco, não pendente. Os impostos (ICMS/IPI) ficam de fora
        // porque vão para a apuração mensal, não para o MOV.
        const fixas = deveContabilizar ? contasFixasDaNota(planoNota) : [];
        const cobertas = fixas.filter((cc) => contasConsolidadas.has(`${cc.natureza}:${cc.conta}`));
        const consolidada =
          cobertas.some((cc) => cc.natureza === 1) && cobertas.some((cc) => cc.natureza === -1);
        if (consolidada) {
          situacao = "consolidada";
          resumo.consolidadas += 1;
          resumo.valorConsolidado += valor;
          const contasNota = new Set(cobertas.map((cc) => cc.conta));
          const cobrindo = movLancamentos.filter(
            (m) =>
              (m.deb != null && contasNota.has(m.deb)) ||
              (m.cred != null && contasNota.has(m.cred))
          );
          consolidacao = {
            contas: cobertas.map((cc) => ({ conta: cc.conta, descr: cc.descr })),
            lancamentos: cobrindo.slice(0, 50).map((m) => ({
              data: m.data,
              origem: m.origem,
              contaDeb: m.deb,
              contaCred: m.cred,
              valor: m.valor,
            })),
            qtd: cobrindo.length,
          };
        } else if (deveContabilizar) {
          situacao = "pendente";
          resumo.pendentes += 1;
          resumo.valorPendente += valor;
        } else {
          situacao = "nao_exige";
          resumo.naoExigem += 1;
        }
      }
    }

    conferidas.push({
      chave: String(n.chave),
      numero: n.numero,
      serie: n.serie,
      especie: n.especie,
      data: n.data,
      valor,
      contraparte: n.contraparte,
      doc: n.doc,
      uf: n.uf,
      cfops,
      situacao,
      lancamentos: lancamentos.length,
      divergencias,
      duplicidade,
      consolidacao,
    });
  }

  return { resumo, conferidas, truncado, descrCfop };
}

/**
 * Conferência da TELA: roda `conferirTudo` e aplica situação/busca/espécie/
 * CFOP, facetas e paginação por cima. Assinatura preservada — é o que a rota
 * de Conferência e a Central de Pendências consomem.
 */
export async function conferir(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[],
  o: Opcoes
): Promise<ConferenciaResp> {
  const { resumo, conferidas, truncado, descrCfop } = await conferirTudo(
    client,
    empresa,
    inicio,
    fim,
    estabs,
    o.tipo
  );

  // ---- filtros ----
  // A busca livre não procura CFOP: CFOP tem filtro próprio, e ter os dois
  // fazia o mesmo termo cair em dois lugares com resultados diferentes.
  const q = o.busca.trim().toLowerCase();
  // Dígitos do termo, para casar CNPJ mesmo digitado com pontuação. Precisa ter
  // conteúdo: `"".includes("")` é sempre verdadeiro e faria a busca por texto
  // casar com todas as notas.
  const qDigitos = q.replace(/\D/g, "");
  const base = conferidas.filter((n) => {
    if (o.situacao === "problema") {
      if (
        n.situacao !== "pendente" &&
        n.situacao !== "divergente" &&
        n.situacao !== "duplicada"
      )
        return false;
    } else if (o.situacao !== "todas" && n.situacao !== o.situacao) return false;
    if (!q) return true;
    return (
      (qDigitos.length > 0 && String(n.numero).includes(qDigitos)) ||
      (n.contraparte ?? "").toLowerCase().includes(q) ||
      (qDigitos.length >= 3 && (n.doc ?? "").replace(/\D/g, "").includes(qDigitos)) ||
      (n.uf ?? "").toLowerCase() === q
    );
  });

  // Facetas saem do conjunto antes dos filtros de espécie/CFOP, para as opções
  // não sumirem conforme se seleciona — é o que se espera de um filtro assim.
  const facetas = {
    especies: contar(base.map((n) => [n.especie, null] as const)),
    cfops: contar(
      base.flatMap((n) => n.cfops.map((cf) => [String(cf), descrCfop.get(cf) ?? null] as const))
    ),
  };

  const especies = new Set(o.especies);
  const cfopsSel = new Set(o.cfops);
  const filtradas = base.filter((n) => {
    if (especies.size && !especies.has(n.especie)) return false;
    if (cfopsSel.size && !n.cfops.some((cf) => cfopsSel.has(cf))) return false;
    return true;
  });

  const ordenadas = filtradas.sort((a, b) => {
    switch (o.ordem) {
      case "valor_asc":
        return a.valor - b.valor;
      case "data_desc":
        return b.data.localeCompare(a.data) || b.valor - a.valor;
      case "data_asc":
        return a.data.localeCompare(b.data) || b.valor - a.valor;
      case "numero":
        return a.numero - b.numero;
      default:
        return b.valor - a.valor;
    }
  });

  const pagina = Math.max(1, o.pagina);
  return {
    resumo,
    notas: ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    total: ordenadas.length,
    pagina,
    porPagina: POR_PAGINA,
    truncado,
    facetas,
  };
}
