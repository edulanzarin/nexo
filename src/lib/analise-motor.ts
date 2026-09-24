import type { BalanceteContabil, ContaBalancete } from "./balancete-contabil";
import { ehContaRedutora, validarBalancete } from "./validacao-balancete";
import type {
  AnaliseDeterministica,
  GrupoPatrimonial,
  IndicadorCalc,
  Inconsistencia,
  LinhaDRE,
  TotaisBalanco,
} from "./types";

/**
 * MOTOR determinístico da Análise de Balancete — o cérebro. Sem IA: classifica
 * as contas, reconcilia o balanço, monta a DRE do período, calcula os indicadores
 * e a evolução, e levanta as inconsistências. Roda no Executar, de graça. A IA só
 * entra depois, opcional, pra redigir a prosa do laudo sobre o que ISTO achou.
 *
 * ── Classificação (plano padrão Questor deste escritório, validado no banco) ───
 *   1.1  Ativo Circulante            2.1  Passivo Circulante
 *   1.2  Ativo Não Circulante        2.2  Passivo Não Circulante
 *   1.4  (compensação — memorando)   2.4/2.5/2.6  Patrimônio Líquido
 *   3/4  Receitas                    2.9  (compensação — memorando)
 *   5    Custos e despesas           6    Impostos sobre o lucro (IRPJ/CSLL)
 *   7/8  Resultado/apuração (transitórias — ficam de fora dos totais)
 *
 * ── Dois erros contábeis que este motor corrige em relação à versão anterior ──
 *  1. ESTOQUE vs FLUXO. Conta patrimonial (ativo/passivo/PL) é ESTOQUE: usa o
 *     saldo acumulado. Conta de resultado (receita/despesa) é FLUXO: no Questor o
 *     saldo dela acumula o ano inteiro (year-to-date), então ler o saldo mês a mês
 *     mostra uma reta sempre subindo. A DRE e a evolução do resultado usam o
 *     MOVIMENTO do mês, não o saldo.
 *  2. PL RECONCILIADO. Num balancete mensal antes da apuração, o resultado do
 *     exercício ainda não foi transportado ao PL, então Ativo ≠ Passivo + PL
 *     registrado. O PL usado aqui é o RESIDUAL (Ativo − Passivo exigível), que já
 *     embute o resultado — assim o balanço fecha e os indicadores de endividamento
 *     e imobilização ficam corretos. A parte não transportada vira um alerta.
 */

const TOL = 1;

/** Prefixo hierárquico: casa a classe e suas filhas, sem casar "1.10" com "1.1". */
const pref = (classif: string, p: string) => classif === p || classif.startsWith(p + ".");

const idx = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");
const pct1 = (v: number) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Grupo =
  | "ativoCirc"
  | "ativoNaoCirc"
  | "passivoCirc"
  | "passivoNaoCirc"
  | "plReg"
  | "receita"
  | "custoDespesa"
  | "impostoLucro"
  | "compensacao"
  | "apuracao"
  | "ignore";

/**
 * Classificador por `classifconta`. Contas de compensação (memorando) são
 * detectadas por 1.4/2.9 e também pela descrição das sintéticas ("compensação"),
 * pra não distorcer os totais mesmo em planos que numeram diferente.
 */
function fazerClassificador(compensacaoPrefixos: string[]): (c: ContaBalancete) => Grupo {
  return (c) => {
    const cl = c.classif ?? "";
    if (pref(cl, "1.4") || pref(cl, "2.9")) return "compensacao";
    if (compensacaoPrefixos.some((p) => pref(cl, p))) return "compensacao";
    if (pref(cl, "1.1")) return "ativoCirc";
    if (pref(cl, "1.2") || pref(cl, "1.3")) return "ativoNaoCirc";
    if (pref(cl, "2.1")) return "passivoCirc";
    if (pref(cl, "2.2") || pref(cl, "2.3")) return "passivoNaoCirc";
    if (pref(cl, "2.4") || pref(cl, "2.5") || pref(cl, "2.6")) return "plReg";
    if (pref(cl, "3") || pref(cl, "4")) return "receita";
    if (pref(cl, "5")) return "custoDespesa";
    if (pref(cl, "6")) return "impostoLucro";
    if (pref(cl, "7") || pref(cl, "8")) return "apuracao";
    return "ignore";
  };
}

/** Tendência: compara o último ponto com o primeiro não-nulo da série. */
function tendencia(serie: (number | null)[], maiorMelhor: boolean): IndicadorCalc["tendencia"] {
  const pts = serie.filter((v): v is number => v != null && isFinite(v));
  if (pts.length < 2) return "indef";
  const ini = pts[0];
  const fim = pts[pts.length - 1];
  if (!isFinite(ini) || Math.abs(ini) < 1e-9) return "indef";
  const vari = (fim - ini) / Math.abs(ini);
  if (Math.abs(vari) < 0.05) return "estavel";
  return vari > 0 === maiorMelhor ? "melhora" : "piora";
}

export function analisarMotor(bal: BalanceteContabil): AnaliseDeterministica {
  const n = bal.mesesLabels.length;
  const leaves = bal.contas.filter((c) => !c.sintetica);
  const val = validarBalancete(bal);

  // Prefixos de compensação vindos da descrição das sintéticas (robustez extra).
  const compensacaoPrefixos = bal.contas
    .filter((c) => c.sintetica && /compensat/.test(semAcento(c.descricao)))
    .map((c) => c.classif);
  const classificar = fazerClassificador(compensacaoPrefixos);

  const zeros = () => new Array<number>(n).fill(0);

  // ── Estoque (saldo acumulado) dos grupos patrimoniais ──
  const stock: Record<"ativoCirc" | "ativoNaoCirc" | "passivoCirc" | "passivoNaoCirc" | "plReg", number[]> =
    { ativoCirc: zeros(), ativoNaoCirc: zeros(), passivoCirc: zeros(), passivoNaoCirc: zeros(), plReg: zeros() };
  const estoqueSerie = zeros(); // 1.1.08
  const disponivelSerie = zeros(); // 1.1.01 + 1.1.06
  let temEstoque = false;
  let temDisponivel = false;

  // ── Fluxo (movimento do mês) dos grupos de resultado ──
  const flow = { receitaBruta: zeros(), deducoes: zeros(), custoDespesa: zeros(), impostoLucro: zeros() };

  for (const c of leaves) {
    const g = classificar(c);
    if (g === "ativoCirc" || g === "ativoNaoCirc" || g === "passivoCirc" || g === "passivoNaoCirc" || g === "plReg") {
      const sinal = g === "ativoCirc" || g === "ativoNaoCirc" ? 1 : -1; // magnitude natural
      for (let i = 0; i < n; i++) stock[g][i] += sinal * (c.meses[i]?.saldoFinal ?? 0);
      if (g === "ativoCirc") {
        if (pref(c.classif, "1.1.08")) {
          temEstoque = true;
          for (let i = 0; i < n; i++) estoqueSerie[i] += c.meses[i]?.saldoFinal ?? 0;
        }
        if (pref(c.classif, "1.1.01") || pref(c.classif, "1.1.06")) {
          temDisponivel = true;
          for (let i = 0; i < n; i++) disponivelSerie[i] += c.meses[i]?.saldoFinal ?? 0;
        }
      }
    } else if (g === "receita") {
      for (let i = 0; i < n; i++) {
        const cr = c.meses[i]?.credito ?? 0;
        const db = c.meses[i]?.debito ?? 0;
        if (c.natureza === "C") flow.receitaBruta[i] += cr - db;
        else flow.deducoes[i] += db - cr; // impostos s/ vendas, devoluções, descontos
      }
    } else if (g === "custoDespesa" || g === "impostoLucro") {
      const alvo = g === "custoDespesa" ? flow.custoDespesa : flow.impostoLucro;
      for (let i = 0; i < n; i++) alvo[i] += (c.meses[i]?.debito ?? 0) - (c.meses[i]?.credito ?? 0);
    }
  }

  // Séries derivadas
  const somaSeries = (...ss: number[][]) => ss[0].map((_, i) => ss.reduce((s, a) => s + (a[i] ?? 0), 0));
  const subSeries = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const ativoSerie = somaSeries(stock.ativoCirc, stock.ativoNaoCirc);
  const terceirosSerie = somaSeries(stock.passivoCirc, stock.passivoNaoCirc);
  const plSerie = subSeries(ativoSerie, terceirosSerie); // PL reconciliado = Ativo − Exigível
  const receitaLiqSerie = subSeries(flow.receitaBruta, flow.deducoes);
  const resultadoSerie = subSeries(subSeries(receitaLiqSerie, flow.custoDespesa), flow.impostoLucro);

  const last = (a: number[]) => a.at(-1) ?? 0;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  /** Último ponto de uma série que pode ter buracos (razões sem denominador). */
  const kpi = (a: (number | null)[]): number | null => a.at(-1) ?? null;

  // ── Totais reconciliados (estoque, último mês) ──
  const AC = last(stock.ativoCirc);
  const ANC = last(stock.ativoNaoCirc);
  const PC = last(stock.passivoCirc);
  const PNC = last(stock.passivoNaoCirc);
  const PLreg = last(stock.plReg);
  const ativo = AC + ANC;
  const passivoExig = PC + PNC;
  const PL = ativo - passivoExig; // já embute o resultado do exercício
  const resultadoExercicio = PL - PLreg; // parte ainda não transportada ao PL registrado

  const totais: TotaisBalanco = {
    ativo,
    passivo: passivoExig,
    pl: PL,
    plRegistrado: PLreg,
    resultadoExercicio,
  };

  // ── Estrutura patrimonial (magnitude, último mês; % da base) ──
  const pctDe = (v: number, base: number) => (Math.abs(base) > TOL ? v / base : null);
  const estrutura: GrupoPatrimonial[] = [
    { chave: "ativoCirc", nome: "Ativo Circulante", saldo: AC, pctBase: pctDe(AC, ativo), serie: stock.ativoCirc },
    { chave: "ativoNaoCirc", nome: "Ativo Não Circulante", saldo: ANC, pctBase: pctDe(ANC, ativo), serie: stock.ativoNaoCirc },
    { chave: "passivoCirc", nome: "Passivo Circulante", saldo: PC, pctBase: pctDe(PC, ativo), serie: stock.passivoCirc },
    { chave: "passivoNaoCirc", nome: "Passivo Não Circulante", saldo: PNC, pctBase: pctDe(PNC, ativo), serie: stock.passivoNaoCirc },
    { chave: "pl", nome: "Patrimônio Líquido", saldo: PL, pctBase: pctDe(PL, ativo), serie: plSerie },
  ];

  // ── DRE do período (fluxo) ──
  const receitaBrutaP = sum(flow.receitaBruta);
  const deducoesP = sum(flow.deducoes);
  const receitaLiqP = receitaBrutaP - deducoesP;
  const custoDespesaP = sum(flow.custoDespesa);
  const impostoLucroP = sum(flow.impostoLucro);
  const resultadoAntesIR = receitaLiqP - custoDespesaP;
  const resultadoLiqP = resultadoAntesIR - impostoLucroP;
  const temImpostoLucro = Math.abs(impostoLucroP) > TOL;

  const av = (v: number) => (Math.abs(receitaLiqP) > TOL ? v / receitaLiqP : null);
  const dre: LinhaDRE[] = [];
  if (deducoesP > TOL) {
    dre.push({ chave: "receitaBruta", nome: "Receita bruta", valor: receitaBrutaP, pctReceita: av(receitaBrutaP), serie: flow.receitaBruta });
    dre.push({ chave: "deducoes", nome: "(−) Deduções da receita", valor: -deducoesP, pctReceita: av(-deducoesP), serie: flow.deducoes.map((v) => -v) });
    dre.push({ chave: "receitaLiquida", nome: "Receita líquida", valor: receitaLiqP, pctReceita: av(receitaLiqP), serie: receitaLiqSerie, destaque: true });
  } else {
    dre.push({ chave: "receitaLiquida", nome: "Receita", valor: receitaLiqP, pctReceita: av(receitaLiqP), serie: receitaLiqSerie });
  }
  dre.push({ chave: "custoDespesa", nome: "(−) Custos e despesas", valor: -custoDespesaP, pctReceita: av(-custoDespesaP), serie: flow.custoDespesa.map((v) => -v) });
  if (temImpostoLucro) {
    dre.push({ chave: "resultadoAntesIR", nome: "(=) Resultado antes do IRPJ/CSLL", valor: resultadoAntesIR, pctReceita: av(resultadoAntesIR), serie: subSeries(receitaLiqSerie, flow.custoDespesa), destaque: true });
    dre.push({ chave: "impostoLucro", nome: "(−) Impostos sobre o lucro", valor: -impostoLucroP, pctReceita: av(-impostoLucroP), serie: flow.impostoLucro.map((v) => -v) });
  }
  dre.push({ chave: "resultado", nome: "(=) Resultado do período", valor: resultadoLiqP, pctReceita: av(resultadoLiqP), serie: resultadoSerie, destaque: true });

  // ── Indicadores ──
  const razao = (a: number[], b: number[]) => a.map((v, i) => (Math.abs(b[i]) > TOL ? v / b[i] : null));
  const faixaPor = (
    v: number | null,
    bom: (x: number) => boolean,
    ruim: (x: number) => boolean
  ): IndicadorCalc["faixa"] => (v == null ? "neutro" : bom(v) ? "bom" : ruim(v) ? "ruim" : "atencao");

  const indicadores: IndicadorCalc[] = [];
  const addInd = (
    chave: string,
    nome: string,
    valor: number | null,
    serie: (number | null)[],
    unidade: IndicadorCalc["unidade"],
    maiorMelhor: boolean,
    faixaFn: (v: number) => IndicadorCalc["faixa"],
    interp: (v: number | null) => string
  ) => {
    const fmt =
      valor == null ? "—" : unidade === "pct" ? pct1(valor) : unidade === "reais" ? brl0(valor) : idx.format(valor);
    indicadores.push({
      chave,
      nome,
      valor,
      formatado: fmt,
      unidade,
      faixa: valor == null ? "neutro" : faixaFn(valor),
      interpretacao: interp(valor),
      tendencia: tendencia(serie, maiorMelhor),
      serie,
    });
  };

  const liqCorrSerie = razao(stock.ativoCirc, stock.passivoCirc);
  addInd(
    "liquidezCorrente", "Liquidez corrente", kpi(liqCorrSerie), liqCorrSerie, "indice", true,
    (v) => faixaPor(v, (x) => x >= 1.3, (x) => x < 1),
    (v) => v == null ? "Sem passivo circulante no período." : v >= 1.3 ? "Folga para honrar o curto prazo." : v >= 1 ? "Cobre o curto prazo, com pouca folga." : "Ativo circulante não cobre o passivo circulante."
  );

  if (temEstoque) {
    const secaSerie = razao(subSeries(stock.ativoCirc, estoqueSerie), stock.passivoCirc);
    addInd(
      "liquidezSeca", "Liquidez seca", kpi(secaSerie), secaSerie, "indice", true,
      (v) => faixaPor(v, (x) => x >= 1, (x) => x < 0.7),
      (v) => v == null ? "Sem passivo circulante no período." : `Sem contar estoques, cobre ${idx.format(v)}× o passivo circulante.`
    );
  }

  if (temDisponivel) {
    const imedSerie = razao(disponivelSerie, stock.passivoCirc);
    addInd(
      "liquidezImediata", "Liquidez imediata", kpi(imedSerie), imedSerie, "indice", true,
      (v) => faixaPor(v, (x) => x >= 0.3, (x) => x < 0.1),
      (v) => v == null ? "Sem passivo circulante no período." : `Caixa e aplicações cobrem ${pct1(v)} do passivo circulante.`
    );
  }

  const cclSerie = subSeries(stock.ativoCirc, stock.passivoCirc);
  addInd(
    "capitalGiro", "Capital de giro (CCL)", last(cclSerie), cclSerie, "reais", true,
    (v) => (v == null ? "neutro" : v >= 0 ? "bom" : "ruim"),
    (v) => v == null ? "—" : v >= 0 ? "Ativo circulante maior que o passivo circulante." : "Passivo circulante maior que o ativo circulante (giro negativo)."
  );

  const endivAtivoSerie = razao(terceirosSerie, ativoSerie);
  addInd(
    "endividamentoAtivo", "Capital de terceiros / Ativo", kpi(endivAtivoSerie), endivAtivoSerie, "pct", false,
    (v) => faixaPor(v, (x) => x <= 0.5, (x) => x > 0.7),
    (v) => v == null ? "—" : `${pct1(v)} do ativo é financiado por capital de terceiros.`
  );

  const compSerie = razao(stock.passivoCirc, terceirosSerie);
  addInd(
    "composicaoEndiv", "Dívida no curto prazo", kpi(compSerie), compSerie, "pct", false,
    (v) => faixaPor(v, (x) => x <= 0.5, (x) => x > 0.75),
    (v) => v == null ? "Sem dívida com terceiros no período." : `${pct1(v)} da dívida vence no curto prazo.`
  );

  const imobSerie = razao(stock.ativoNaoCirc, plSerie);
  addInd(
    "imobilizacaoPl", "Imobilização do PL", kpi(imobSerie), imobSerie, "pct", false,
    (v) => faixaPor(v, (x) => x <= 0.5, (x) => x > 1),
    (v) => v == null ? "Sem PL positivo no período." : `${pct1(v)} do PL está aplicado no ativo não circulante.`
  );

  const margemPeriodo = Math.abs(receitaLiqP) > TOL ? resultadoLiqP / receitaLiqP : null;
  const margemSerie = resultadoSerie.map((v, i) => (Math.abs(receitaLiqSerie[i]) > TOL ? v / receitaLiqSerie[i] : null));
  addInd(
    "margemLiquida", "Margem do resultado", margemPeriodo, margemSerie, "pct", true,
    (v) => (v == null ? "neutro" : v > 0.02 ? "bom" : v >= 0 ? "atencao" : "ruim"),
    (v) => v == null ? "Sem receita no período." : v >= 0 ? `Sobra ${pct1(v)} da receita líquida como resultado.` : `Resultado negativo: consome ${pct1(Math.abs(v))} da receita líquida.`
  );

  if (PL > TOL) {
    const roeValor = resultadoLiqP / PL;
    const roeSerie = resultadoSerie.map((v, i) => (plSerie[i] > TOL ? v / plSerie[i] : null));
    addInd(
      "rentabilidadePl", "Retorno sobre o PL (período)", roeValor, roeSerie, "pct", true,
      (v) => (v == null ? "neutro" : v > 0 ? "bom" : v < 0 ? "ruim" : "atencao"),
      (v) => v == null ? "—" : v >= 0 ? `O resultado do período rendeu ${pct1(v)} sobre o patrimônio líquido.` : `Prejuízo do período corroeu ${pct1(Math.abs(v))} do patrimônio líquido.`
    );
  }

  addInd(
    "resultado", "Resultado do período", resultadoLiqP, resultadoSerie, "reais", true,
    (v) => (v == null ? "neutro" : v > 0 ? "bom" : v < 0 ? "ruim" : "atencao"),
    (v) => v == null ? "—" : v >= 0 ? "Receitas superaram custos e despesas no período." : "Custos e despesas superaram as receitas no período."
  );

  // ── Inconsistências ──
  const inc: Inconsistencia[] = [];
  const disponivelPrefs = (cl: string) => pref(cl, "1.1.01") || pref(cl, "1.1.06");

  if (!val.fecha) {
    inc.push({
      severidade: "alta", tipo: "nao_fecha", titulo: "Balancete não fecha",
      detalhe: `Diferença de ${brl0(Math.abs(val.difFechamento))} entre débitos e créditos — há partida sem contrapartida. Revise antes de confiar nos números.`,
      valor: val.difFechamento,
    });
  }

  if (PL < -TOL) {
    inc.push({
      severidade: "alta", tipo: "pl_negativo", titulo: "Patrimônio líquido negativo",
      detalhe: `O PL está negativo em ${brl0(Math.abs(PL))} (passivo a descoberto): as obrigações superam os bens e direitos.`,
      valor: PL,
    });
  }

  // Sinal atípico. Três camadas, do sinal ao ruído:
  //  • IMPOSSÍVEL (alta): caixa/banco/aplicação/estoque com saldo invertido.
  //  • ESTRUTURAL (média): conta única (Capital, tributo a recuperar…) invertida.
  //  • CONTRAPARTE (baixa, resumida): cliente/fornecedor/sócio invertido — normal
  //    (adiantamento, nota de crédito, pagamento a maior). No Questor cada terceiro
  //    é uma conta própria sob o MESMO classif, então "muitas irmãs no classif" as
  //    identifica; listar uma a uma só polui, por isso vão num resumo só.
  const irmasPorClassif = new Map<string, number>();
  for (const c of leaves) irmasPorClassif.set(c.classif, (irmasPorClassif.get(c.classif) ?? 0) + 1);
  const ehContraparte = (cl: string) => (irmasPorClassif.get(cl) ?? 0) >= 3;
  const ehImpossivel = (cl: string) => disponivelPrefs(cl) || pref(cl, "1.1.08");

  const anomImpossiveis = val.anomalias.filter((a) => ehImpossivel(a.classif));
  const anomRestantes = val.anomalias.filter((a) => !ehImpossivel(a.classif));
  const anomContraparte = anomRestantes.filter((a) => ehContraparte(a.classif));
  const anomEstruturais = anomRestantes.filter((a) => !ehContraparte(a.classif));

  for (const a of anomImpossiveis.slice(0, 12)) {
    const ehDisp = disponivelPrefs(a.classif);
    inc.push({
      severidade: "alta", tipo: "saldo_impossivel",
      titulo: `${ehDisp ? "Disponibilidade" : "Estoque"} com saldo invertido · ${a.conta} ${a.descricao}`,
      detalhe: ehDisp
        ? `Caixa/banco/aplicação com saldo credor de ${brl0(Math.abs(a.saldoFinal))} — dinheiro não fica negativo. Há lançamento faltando ou trocado.`
        : `Estoque com saldo credor de ${brl0(Math.abs(a.saldoFinal))} — estoque negativo é impossível. Revise entradas/saídas.`,
      conta: a.conta, valor: a.saldoFinal,
    });
  }
  const MAX_SINAL = 12;
  for (const a of anomEstruturais.slice(0, MAX_SINAL)) {
    inc.push({
      severidade: "media", tipo: "sinal_atipico",
      titulo: `Saldo de sinal atípico · ${a.conta} ${a.descricao}`,
      detalhe: a.natureza === "D"
        ? `Conta de natureza devedora com saldo credor de ${brl0(Math.abs(a.saldoFinal))} — pode ser lançamento invertido ou conta usada como redutora sem cadastro.`
        : `Conta de natureza credora com saldo devedor de ${brl0(Math.abs(a.saldoFinal))} — lançamento invertido ou conta usada fora da natureza cadastrada.`,
      conta: a.conta, valor: a.saldoFinal,
    });
  }
  if (anomEstruturais.length > MAX_SINAL) {
    inc.push({
      severidade: "baixa", tipo: "sinal_atipico_resto",
      titulo: `+ ${anomEstruturais.length - MAX_SINAL} contas estruturais com saldo de sinal atípico`,
      detalhe: "Listadas as de maior valor acima; as demais seguem o mesmo tipo de violação.",
    });
  }
  if (anomContraparte.length) {
    const soma = anomContraparte.reduce((s, a) => s + Math.abs(a.saldoFinal), 0);
    inc.push({
      severidade: "baixa", tipo: "sinal_atipico_contraparte",
      titulo: `${anomContraparte.length} conta(s) de clientes/fornecedores/sócios com saldo de sinal atípico`,
      detalhe: `Somam ${brl0(soma)}. Em contas individuais de terceiros isso costuma ser adiantamento, nota de crédito ou pagamento a maior — em geral normal. Vale conferir só as de maior valor.`,
      valor: soma,
    });
  }

  // Resultado do exercício ainda não transportado ao PL registrado (pré-apuração).
  if (Math.abs(resultadoExercicio) > TOL && Math.abs(resultadoExercicio) > 0.01 * Math.max(ativo, 1)) {
    inc.push({
      severidade: "baixa", tipo: "resultado_nao_incorporado",
      titulo: "Resultado do exercício ainda não incorporado ao PL",
      detalhe: `O resultado acumulado do exercício (${brl0(resultadoExercicio)}) ainda está nas contas de resultado e não foi transportado ao PL registrado. É normal num balancete mensal antes da apuração — o PL acima já considera esse valor.`,
      valor: resultadoExercicio,
    });
  }

  // Inversão de natureza DENTRO do período — só contas patrimoniais e NÃO de
  // contraparte (resultado acumula e inverter não significa nada; terceiros
  // invertem no dia a dia). O saldo natural trocou de sinal ao longo dos meses.
  const MAX_INV = 10;
  let invCount = 0;
  for (const c of leaves) {
    const g = classificar(c);
    if (g !== "ativoCirc" && g !== "ativoNaoCirc" && g !== "passivoCirc" && g !== "passivoNaoCirc" && g !== "plReg") continue;
    if (ehContraparte(c.classif) || ehContaRedutora(c.descricao)) continue;
    const nat = c.meses.map((m) => (c.natureza === "C" ? -m.saldoFinal : m.saldoFinal));
    if (nat.some((v) => v > TOL) && nat.some((v) => v < -TOL)) {
      invCount++;
      if (invCount <= MAX_INV) {
        inc.push({
          severidade: "media", tipo: "inversao_periodo",
          titulo: `Saldo inverteu de natureza no período · ${c.conta} ${c.descricao}`,
          detalhe: "O saldo passou de normal a atípico (ou vice-versa) ao longo dos meses — confira os lançamentos do intervalo.",
          conta: c.conta,
        });
      }
    }
  }

  // Variação abrupta de grupo patrimonial (estoque) entre meses consecutivos.
  for (const grp of estrutura) {
    const s = grp.serie;
    for (let i = 1; i < s.length; i++) {
      const ant = s[i - 1];
      const dif = s[i] - ant;
      if (Math.abs(ant) > TOL && Math.abs(dif) > 50000 && Math.abs(dif) / Math.abs(ant) > 0.6) {
        inc.push({
          severidade: "baixa", tipo: "variacao_abrupta",
          titulo: `Salto em ${grp.nome} · ${bal.mesesLabels[i - 1]} → ${bal.mesesLabels[i]}`,
          detalhe: `Variação de ${brl0(dif)} (${pct1(dif / Math.abs(ant))}). Vale conferir o que causou.`,
          valor: dif,
        });
        break; // um alerta por grupo basta
      }
    }
  }

  inc.sort((a, b) => sev(b.severidade) - sev(a.severidade));

  // ── Saúde geral (regra determinística) ──
  const temAlta = inc.some((i) => i.severidade === "alta");
  const liq = liqCorrSerie.at(-1) ?? null;
  const endiv = endivAtivoSerie.at(-1) ?? null;
  const prejuizoOperacional = receitaLiqP > TOL && resultadoLiqP < -TOL;
  let saudeGeral: AnaliseDeterministica["saudeGeral"];
  if (!val.fecha || PL < -TOL) saudeGeral = "critica";
  else if (
    temAlta ||
    (liq != null && liq < 1) ||
    (endiv != null && endiv > 0.7) ||
    AC - PC < -TOL ||
    prejuizoOperacional
  )
    saudeGeral = "atencao";
  else if (inc.some((i) => i.severidade === "media")) saudeGeral = "estavel";
  else saudeGeral = "forte";

  return {
    saudeGeral,
    fecha: val.fecha,
    difFechamento: val.difFechamento,
    cobertura: val.cobertura,
    estrutura,
    totais,
    dre,
    indicadores,
    inconsistencias: inc,
    meses: bal.mesesLabels,
  };
}

const sev = (s: Inconsistencia["severidade"]) => (s === "alta" ? 3 : s === "media" ? 2 : 1);
