import { PoolClient } from "pg";
import type { AuditoriaResp, GrupoAchado, LancamentoAchado, TipoAchado } from "./types";

/**
 * AUDITORIA DE LANÇAMENTOS — varredura linha-a-linha do `lctoctb`. É o nível que
 * o balancete agregado esconde: um lançamento em conta sintética SOME do rollup
 * (o coletor do balancete só redistribui analíticas), uma conta órfã não aparece
 * em conta nenhuma, um lançamento sem histórico não muda saldo algum. Aqui cada
 * lançamento é olhado por si.
 *
 * Complementa (não repete) o `analise-motor`, que audita SALDOS por conta. Os
 * checks são determinísticos; onde a identificação é heurística (duplicidade,
 * manual em conta de controle) a tela mostra a amostra — a memória de cálculo —
 * para o humano validar. Ver [[Deixar o método da conferência visível quando o
 * SQL não foi validado]] e [[Módulo contábil do Questor]].
 *
 * Partida dobrada em `lctoctb`: débito e crédito na MESMA linha (`contactbdeb`/
 * `contactbcred`, mesmo `valorlctoctb`), então "partida que não fecha" não existe
 * por construção — o que se caça é a perna que caiu em conta errada/inexistente.
 */

/** Teto da amostra por grupo — a contagem/valor totais vêm de window (exatos). */
const AMOSTRA = 200;

/** Origens de ajuste a dedo (fora dos módulos automáticos). Ver `origemlctoctb`. */
const ORIGENS_MANUAIS = ["CB", "IP", "LA", "ZZ"] as const;
/** Origens de período anterior — ajuste extemporâneo já marcado pelo Questor. */
const ORIGENS_EXTEMPORANEAS = ["XX", "AA"] as const;

/**
 * Filtro base de todo check: uma empresa, o período, só lançamento normal (LN,
 * como o balancete) e o recorte de filial. `$4` é sempre o array de estabs (vazio
 * = todas), para o índice de parâmetro ficar fixo entre as queries.
 */
const BASE = `codigoempresa = $1 and datalctoctb between $2 and $3 and tipolancamento = 'LN'
  and (cardinality($4::int[]) = 0 or codigoestab = any($4::int[]))`;

/** Colunas de um lançamento que toda amostra traz (resolvo descrição no Node). */
const COLS = `chavelctoctb::text chave, to_char(datalctoctb, 'YYYY-MM-DD') data,
  contactbdeb, contactbcred, valorlctoctb::float valor, codigooriglctoctb origem,
  codigohistctb, complhist, codigousuario, to_char(datahoralctoctb, 'YYYY-MM-DD HH24:MI') lancado_em`;

interface RowLanc {
  chave: string;
  data: string;
  contactbdeb: number | null;
  contactbcred: number | null;
  valor: number;
  origem: string | null;
  codigohistctb: number | null;
  complhist: string | null;
  codigousuario: number | null;
  lancado_em: string | null;
  total_cnt?: number;
  total_val?: number;
}

/** Prefixo hierárquico do classif (casa a classe e as filhas, sem "1.10" em "1.1"). */
const pref = (classif: string, p: string) => classif === p || classif.startsWith(p + ".");

/** É conta patrimonial de controle? Classe 1/2 analítica, fora compensação e PL. */
function ehControle(classif: string, sintetica: boolean): boolean {
  if (sintetica) return false;
  if (pref(classif, "1.4") || pref(classif, "2.9")) return false; // compensação
  if (pref(classif, "2.4") || pref(classif, "2.5") || pref(classif, "2.6")) return false; // PL
  return pref(classif, "1") || pref(classif, "2");
}

export async function montarAuditoria(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[]
): Promise<AuditoriaResp> {
  const base: [number, string, string, number[]] = [empresa, inicio, fim, estabs];

  // ── Cadastros de apoio (resolvem as descrições da amostra sem inflar joins) ──
  const planoQ = await client.query<{
    conta: number;
    classif: string;
    descr: string | null;
    sintetica: boolean;
  }>(
    `select contactb conta, classifconta classif, descrconta descr, (tipoconta = 1) sintetica
       from planoespec where codigoempresa = $1`,
    [empresa]
  );
  const plano = new Map(planoQ.rows.map((r) => [r.conta, r]));
  const sinteticas = planoQ.rows.filter((r) => r.sintetica).map((r) => r.conta);
  const contasControle = planoQ.rows.filter((r) => ehControle(r.classif, r.sintetica)).map((r) => r.conta);
  const nomeEmpresa = await empresaNome(client, empresa);

  // Históricos padrão (`historicoctb`) e usuários são GLOBAIS no Questor, não por
  // empresa — ver a rota de históricos da Implantação e a produtividade fiscal.
  const histQ = await client.query<{ codigo: number; descr: string | null }>(
    `select codigohistctb codigo, btrim(descrhistctb) descr from historicoctb`
  );
  const historicos = new Map(histQ.rows.map((r) => [r.codigo, r.descr]));
  const usrQ = await client.query<{ codigo: number; nome: string | null }>(
    `select codigousuario codigo,
            coalesce(nullif(btrim(nomeusuariocompl), ''), nullif(btrim(nomeusuario), '')) nome
       from usuario`
  );
  const usuarios = new Map(usrQ.rows.map((r) => [r.codigo, r.nome]));

  const descrConta = (c: number | null) => (c == null ? null : plano.get(c)?.descr ?? null);
  const histTexto = (cod: number | null, compl: string | null): string | null => {
    const t = compl?.trim();
    if (t) return t;
    return (cod != null && historicos.get(cod)) || null;
  };
  const usuarioNome = (cod: number | null): string | null => {
    if (cod == null) return null;
    if (cod === 0) return "ADMINISTRADOR (sistema)";
    return usuarios.get(cod) ?? String(cod);
  };
  const linha = (r: RowLanc, detalhe?: string): LancamentoAchado => ({
    chave: r.chave,
    data: r.data,
    contaDeb: r.contactbdeb,
    contaCred: r.contactbcred,
    descrDeb: descrConta(r.contactbdeb),
    descrCred: descrConta(r.contactbcred),
    valor: r.valor,
    origem: r.origem ?? "",
    historico: histTexto(r.codigohistctb, r.complhist),
    usuario: usuarioNome(r.codigousuario),
    lancadoEm: r.lancado_em,
    detalhe,
  });

  // Denominador: lançamentos normais do período.
  const totQ = await client.query<{ n: number }>(
    `select count(*)::int n from lctoctb where ${BASE}`,
    base
  );
  const totalLancamentos = totQ.rows[0]?.n ?? 0;

  // ── Um coletor genérico: filtro extra + montador de detalhe → grupo ou null ──
  async function coletar(
    tipo: TipoAchado,
    titulo: string,
    criterio: string,
    severidade: "alta" | "media",
    where: string,
    extraParams: unknown[],
    detalhe?: (r: RowLanc) => string | undefined
  ): Promise<GrupoAchado | null> {
    const q = await client.query<RowLanc>(
      `select ${COLS}, count(*) over()::int total_cnt, sum(valorlctoctb) over()::float total_val
         from lctoctb
        where ${BASE} and (${where})
        order by valorlctoctb desc
        limit ${AMOSTRA}`,
      [...base, ...extraParams]
    );
    if (q.rows.length === 0) return null;
    const contagem = q.rows[0].total_cnt ?? q.rows.length;
    const valor = q.rows[0].total_val ?? 0;
    return {
      tipo,
      titulo,
      criterio,
      severidade,
      contagem,
      valor,
      amostra: q.rows.map((r) => linha(r, detalhe?.(r))),
      truncado: contagem > q.rows.length,
    };
  }

  const grupos: (GrupoAchado | null)[] = [];

  // 1 — Lançamento em conta SINTÉTICA (só analítica recebe lançamento).
  grupos.push(
    await coletar(
      "sintetica",
      "Lançamento em conta sintética",
      "Débito ou crédito numa conta agrupadora (sintética) — só contas analíticas recebem lançamento. Some do balancete no rollup.",
      "alta",
      "contactbdeb = any($5::bigint[]) or contactbcred = any($5::bigint[])",
      [sinteticas],
      (r) => {
        const d = r.contactbdeb != null && plano.get(r.contactbdeb)?.sintetica;
        const c = r.contactbcred != null && plano.get(r.contactbcred)?.sintetica;
        return d && c ? "débito e crédito sintéticos" : d ? "débito sintético" : "crédito sintético";
      }
    )
  );

  // 2 — Conta ÓRFÃ (perna aponta para conta fora do plano da empresa).
  grupos.push(
    await coletar(
      "orfa",
      "Conta fora do plano",
      "Débito ou crédito numa conta que não existe no plano de contas da empresa — lançamento em conta inválida.",
      "alta",
      `(contactbdeb is not null and not exists (select 1 from planoespec p where p.codigoempresa = $1 and p.contactb = lctoctb.contactbdeb))
       or (contactbcred is not null and not exists (select 1 from planoespec p where p.codigoempresa = $1 and p.contactb = lctoctb.contactbcred))`,
      [],
      (r) => {
        const d = r.contactbdeb != null && !plano.has(r.contactbdeb);
        const c = r.contactbcred != null && !plano.has(r.contactbcred);
        return d && c ? "débito e crédito fora do plano" : d ? `débito ${r.contactbdeb} fora do plano` : `crédito ${r.contactbcred} fora do plano`;
      }
    )
  );

  // 3 — SEM HISTÓRICO (nem código padrão nem complemento) — a ECD (I200) exige.
  grupos.push(
    await coletar(
      "sem_historico",
      "Lançamento sem histórico",
      "Sem histórico padrão nem complemento de texto. O registro I200 da ECD exige histórico — a validação da escrituração rejeita.",
      "media",
      "(codigohistctb is null or codigohistctb = 0) and (complhist is null or btrim(complhist) = '')",
      []
    )
  );

  // 4 — EXTEMPORÂNEO (origem de ajuste de período anterior, marcada pelo Questor).
  grupos.push(
    await coletar(
      "extemporaneo",
      "Ajuste de período anterior",
      "Origem XX (extemporâneo) ou AA (ajuste de exercícios anteriores) — lançamento que corrige um período já encerrado.",
      "media",
      "codigooriglctoctb = any($5::varchar[])",
      [ORIGENS_EXTEMPORANEAS],
      (r) => (r.origem === "XX" ? "extemporâneo" : "ajuste de exercício anterior")
    )
  );

  // 5 — MANUAL em conta de CONTROLE (a dedo numa conta que módulo deveria alimentar).
  grupos.push(
    await coletar(
      "manual_controle",
      "Ajuste manual em conta de controle",
      "Lançamento a dedo (contabilidade manual, importação, Lalur, zeramento) numa conta patrimonial que os módulos deveriam conciliar sozinhos.",
      "media",
      `codigooriglctoctb = any($5::varchar[])
       and (contactbdeb = any($6::bigint[]) or contactbcred = any($6::bigint[]))`,
      [ORIGENS_MANUAIS, contasControle]
    )
  );

  // 6 — DUPLICADO (partida idêntica repetida — possível dupla contabilização).
  grupos.push(await coletarDuplicados(client, base, linha));

  // Alta antes de média; dentro, mais achados primeiro.
  const ordem = { alta: 0, media: 1 } as const;
  const comAchado = grupos.filter((g): g is GrupoAchado => g !== null);
  comAchado.sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || b.contagem - a.contagem);

  return {
    empresa: { codigo: empresa, nome: nomeEmpresa },
    periodo: { inicio, fim },
    totalLancamentos,
    grupos: comAchado,
    resumo: {
      totalAchados: comAchado.reduce((s, g) => s + g.contagem, 0),
      tiposComAchado: comAchado.length,
    },
  };
}

/**
 * Duplicidade tem forma própria (agrega por partida, não lista lançamento). Um
 * "achado" é um GRUPO de lançamentos idênticos — mesma data, contas, valor,
 * origem e histórico. O valor reportado é o EXCEDENTE (o que foi lançado a mais),
 * `valor × (repetições − 1)`.
 */
async function coletarDuplicados(
  client: PoolClient,
  base: [number, string, string, number[]],
  linha: (r: RowLanc, detalhe?: string) => LancamentoAchado
): Promise<GrupoAchado | null> {
  const q = await client.query<
    RowLanc & { reps: number; excedente: number }
  >(
    `select to_char(datalctoctb, 'YYYY-MM-DD') data, contactbdeb, contactbcred,
            valorlctoctb::float valor, codigooriglctoctb origem,
            max(codigohistctb) codigohistctb, max(complhist) complhist,
            max(codigousuario) codigousuario, null lancado_em,
            (min(chavelctoctb))::text chave,
            count(*)::int reps, (valorlctoctb * (count(*) - 1))::float excedente,
            count(*) over()::int total_cnt,
            sum(valorlctoctb * (count(*) - 1)) over()::float total_val
       from lctoctb
      where ${BASE} and contactbdeb is not null and contactbcred is not null
      group by datalctoctb, contactbdeb, contactbcred, valorlctoctb, codigooriglctoctb,
               codigohistctb, complhist
     having count(*) > 1
      order by valorlctoctb * (count(*) - 1) desc
      limit ${AMOSTRA}`,
    base
  );
  if (q.rows.length === 0) return null;
  const contagem = q.rows[0].total_cnt ?? q.rows.length;
  const valor = q.rows[0].total_val ?? 0;
  return {
    tipo: "duplicado",
    titulo: "Partida repetida",
    criterio:
      "Lançamentos idênticos (mesma data, contas, valor, origem e histórico) repetidos no período — possível dupla contabilização. Valor = o excedente.",
    severidade: "media",
    contagem,
    valor,
    amostra: q.rows.map((r) => ({
      ...linha({ ...r, valor: r.excedente }),
      detalhe: `repetido ${r.reps}× (${brl(r.valor)} cada)`,
    })),
    truncado: contagem > q.rows.length,
  };
}

/** Nome da empresa para o cabeçalho (o CNPJ mora em `estab`; aqui basta o nome). */
async function empresaNome(client: PoolClient, empresa: number): Promise<string> {
  const q = await client.query<{ nome: string }>(
    `select nomeempresa nome from empresa where codigoempresa = $1`,
    [empresa]
  );
  return q.rows[0]?.nome ?? String(empresa);
}

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
