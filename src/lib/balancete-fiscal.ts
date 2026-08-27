import { PoolClient } from "pg";
import { planoQuestor } from "./plano-contabil";
import { aplicarOverrides, listarOverrides } from "./plano-override";
import { aprenderContabilizacao, buscarAutoContabiliza } from "./aprender-contabilizacao";
import { aplicarContaEfetiva } from "./conta-efetiva-calculo";
import {
  aprenderContaEfetiva,
  buscarContaEfetiva,
  precisaAprenderContaEfetiva,
} from "./conta-efetiva";
import { avaliarRegra, type ValoresNota } from "./divergencias";

/**
 * Balancete FISCAL (hipotético): a movimentação de débito/crédito que as notas
 * DEVERIAM gerar segundo as regras de contabilização — independente de onde o
 * contábil de fato lançou. Serve para comparar com a movimentação real do
 * contábil e achar valor que foi parar na conta errada.
 *
 * Não é saldo: é MOVIMENTO do período (o saldo é consequência). Para cada nota,
 * "replaya" o plano de contabilização (mesmo motor da Conferência) avaliando as
 * fórmulas com os valores da nota, e soma por conta.
 *
 * Versão atual = PARTIDA PRINCIPAL: cobre os componentes cujos valores são
 * sourceáveis com segurança (valor contábil e ICMS/IPI/Funrural). Componentes
 * de serviço/retenção (ISS, PIS/COFINS, retenções, duplicatas) usam tokens de
 * outras tabelas e ficam para a fase 2 — são contados em `pulados` para a tela
 * mostrar a cobertura. Contas variáveis (fornecedor/cliente) caem num balde
 * único de contrapartida, já que o sub-razão de cada pessoa não é reproduzível.
 */

/** Conta virtual da contrapartida variável (fornecedor no débito, cliente no crédito). */
export const CONTA_CONTRAPARTIDA = -1;

export interface MovConta {
  debito: number;
  credito: number;
}

export interface BalanceteFiscalMov {
  /** Movimento hipotético por conta contábil (contactb). */
  porConta: Map<number, MovConta>;
  notas: number;
  /** Componentes do plano pulados por não ter como avaliar a fórmula (fase 2). */
  pulados: number;
  /**
   * O que a natureza deve à conta no PERÍODO INTEIRO, e não nota a nota:
   * componente que o contábil fecha na apuração mensal (o ICMS da devolução de
   * venda, p.ex., que sai num lançamento só no dia 31). Chave "natureza:conta".
   *
   * Sem isto, parar de cobrar por nota vira parar de conferir: o motor não
   * distinguiria "não é lançado por nota" de "nunca foi lançado".
   *
   * A chave é "natureza:conta:histórico:irmãs" e `irmas` são as outras contas
   * fixas do mesmo componente: juntos identificam, na apuração, a linha que veio
   * DESTA regra. Só o par de contas não basta — na 2827/1541 (ICMS sobre vendas) o
   * mesmo par recebe a apuração do mês E os ajustes que alguém lança à mão, que
   * o motor não tem como reproduzir; o histórico separa os dois (a regra carimba
   * o dela, o ajuste manual vai com 0).
   */
  agregado: Map<string, { valor: number; irmas: number[] }>;
}

interface NotaRow {
  chave: number;
  estab: number;
  numero: number | null;
  especie: string;
  data: string;
  contraparte: string | null;
  vlrcontabil: number;
  vlripi: number;
  vlrfunrural: number;
}

/** Contribuição de uma nota (pelo motor) ao movimento fiscal de uma conta. */
export interface FiscalDetalheNota {
  chave: number;
  numero: number | null;
  especie: string;
  data: string;
  contraparte: string | null;
  origem: "ME" | "MS";
  valor: number;
  /** Conta alvo onde o motor esperou a maior parte do valor (para o detalhe da diferença). */
  conta: number | null;
}

/**
 * Coletor do drill-down do lado Fiscal: quando presente, o motor registra, por
 * nota, quanto gerou nas `contas` alvo na `natureza` alvo — é a lista de notas
 * por trás do valor hipotético. `regradas` marca as contas que o motor de fato
 * movimentou (o chamador usa para decidir o que espelhar do real).
 */
export interface DetalheFiscal {
  contas: Set<number>;
  natureza: 1 | -1;
  /**
   * Modo LÍQUIDO (auditoria de diferença): coleta débito − crédito por nota nas
   * `contas`, ignorando `natureza`. Sem isto, coleta só a `natureza` pedida (o
   * drill-down de uma célula débito ou crédito).
   */
  net?: boolean;
  porNota: Map<number, FiscalDetalheNota>;
  regradas: Set<number>;
}

const LADO = {
  ent: { tabela: "lctofisent", chave: "chavelctofisent", cfopTab: "lctofisentcfop", prod: "lctofisentproduto", funrural: "coalesce(f.valorfunrural,0)" },
  sai: { tabela: "lctofissai", chave: "chavelctofissai", cfopTab: "lctofissaicfop", prod: "lctofissaiproduto", funrural: "0" },
} as const;

/**
 * Calibra o motor por NATUREZA: quais (natureza, natureza contábil, conta) de
 * fato recebem lançamento nota a nota no período, e quais naturezas têm
 * lançamento por nota (a marca "cfop:*").
 *
 * Existe porque a calibração por conta erra por cima. A 382 (ICMS a Recuperar)
 * recebe por nota das compras, então o gate por conta libera qualquer natureza
 * a postar nela — e a devolução de venda, que credita o ICMS uma vez por mês na
 * apuração, aparecia com o ICMS "faltando" em toda nota. O par (natureza, conta)
 * é a granularidade em que a pergunta "isso é lançado por nota?" tem resposta.
 */
export async function calibrarPorNatureza(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  estabs: number[] = []
): Promise<Set<string>> {
  const params: unknown[] = [empresa, inicio, fim];
  let filtroEstab = "";
  if (estabs.length) {
    params.push(estabs);
    filtroEstab = ` and l.codigoestab = any($${params.length}::int[])`;
  }
  const { rows } = await client.query<{ cfop: number; nat: number; conta: number }>(
    `with lct as (
       select substring(l.chaveorigem for 2) origem,
              substring(l.chaveorigem from 3)::bigint chave,
              l.contactbdeb conta, 1 nat
         from lctoctb l
        where l.codigoempresa=$1 and l.codigooriglctoctb='FI'
          and l.datalctoctb between $2 and $3 and l.chaveorigem ~ '^M[ES][0-9]+$'
          and l.contactbdeb is not null${filtroEstab}
       union all
       select substring(l.chaveorigem for 2), substring(l.chaveorigem from 3)::bigint,
              l.contactbcred, -1
         from lctoctb l
        where l.codigoempresa=$1 and l.codigooriglctoctb='FI'
          and l.datalctoctb between $2 and $3 and l.chaveorigem ~ '^M[ES][0-9]+$'
          and l.contactbcred is not null${filtroEstab}
     ),
     cf as (
       select 'ME' origem, chavelctofisent chave, codigocfop cfop
         from lctofisentproduto
        where codigoempresa=$1 and datalctofis between $2 and $3
       union
       select 'MS', chavelctofissai, codigocfop
         from lctofissaiproduto
        where codigoempresa=$1 and datalctofis between $2 and $3
     )
     select cf.cfop, lct.nat, lct.conta
       from lct join cf on cf.origem = lct.origem and cf.chave = lct.chave
      group by cf.cfop, lct.nat, lct.conta`,
    params
  );
  const set = new Set<string>();
  for (const r of rows) {
    set.add(`${r.cfop}:*`);
    set.add(`${r.cfop}:${r.nat}:${r.conta}`);
  }
  return set;
}

/** Tudo que o chamador pode pedir ao motor. Objeto (e não posição) porque são
 *  muitos coletores opcionais e trocar dois de lugar não daria erro de tipo. */
export interface OpcoesBalanceteFiscal {
  /** Restringe a estas chaves (para validar reprodução só nas notas contabilizadas). */
  chavesFiltro?: number[];
  /**
   * Contas que de fato recebem lançamento nota a nota no ME ("natureza:conta").
   * Componente do plano cuja conta não está aqui NÃO é lançada por nota — vai na
   * apuração mensal (IM). Sem este filtro o motor super-gera imposto no ME.
   * A contrapartida variável (fornecedor/cliente) é sempre aceita.
   */
  observadas?: Set<string>;
  /**
   * O mesmo, mas por NATUREZA: "cfop:natureza:conta" para o par observado e
   * "cfop:*" para marcar que aquela natureza tem lançamento por nota no período.
   *
   * A calibração por conta é grossa demais e inventa erro: a 382 (ICMS a
   * Recuperar) recebe por nota das COMPRAS, então passa no gate; mas a
   * devolução de venda credita o ICMS uma vez por mês, na apuração, e cobrar
   * dela por nota acusava toda devolução. Quando a natureza tem lançamento no
   * período, quem manda é o par fino; sem isso, cai no gate por conta.
   */
  observadasPorNatureza?: Set<string>;
  /** Coletor do drill-down do lado Fiscal (opcional) — ver DetalheFiscal. */
  detalhe?: DetalheFiscal;
  /**
   * Se presente, registra "origem:chave" de toda nota que o motor produziu em
   * ALGUMA conta fixa (não a contrapartida). Serve para distinguir, no detalhe da
   * diferença, "conta errada" (a nota foi reproduzida em outra conta) de "sem
   * plano" (o motor não reproduz de jeito nenhum).
   *
   * Além disso registra "origem:chave:natureza" quando o motor DE FATO somou em
   * conta fixa (pós-gate). O chamador usa para o espelho por NOTA: o real de uma
   * nota reproduzida não é espelhado — a versão do motor a substitui — e é isso
   * que faz conta errada aparecer no balancete (a conta certa fica com a nota a
   * mais, a errada com a nota a menos), sem dobrar o valor.
   */
  produzidas?: Set<string>;
  /**
   * Se presente, registra "origem:chave:natureza" quando o plano prevê
   * CONTRAPARTIDA VARIÁVEL naquela natureza (fornecedor no crédito, cliente no
   * débito). A conta dela nasce no lançamento, então lançamento da nota ali é
   * o certo — e chamá-lo de "conta errada" é acusar o plano de seguir o plano.
   */
  contrapartidaVariavel?: Set<string>;
  /**
   * Chaves ("ME:chave"/"MS:chave") das notas que TÊM lançamento nota a nota no
   * real. Para elas o componente PRINCIPAL (valor contábil) fura o gate
   * `observadas`: a despesa/receita de uma nota lançada por nota existe em
   * algum lugar do contábil — se a conta do plano nunca é usada, é porque foi
   * pra conta errada, e o motor precisa produzir a conta certa pra diferença
   * aparecer. Nota consolidada (MOV) ou pendente fica de fora (o espelho cuida).
   */
  lancadas?: Set<string>;
  /**
   * Se presente, registra por nota ("origem:chave") a conta FIXA que o plano
   * manda no componente principal — a "conta certa" segundo a regra, ANTES do
   * gate (mesmo quando o motor não a produz). Em multi-CFOP fica a de maior
   * valor. Serve pro detalhe da diferença dizer "deveria estar em X".
   */
  producao?: Map<string, { conta: number; valor: number }>;
  /** Filiais (codigoestab) a recortar; vazio = todas. O recorte entra só na
   *  scan das notas — os demais scans seguem as chaves já filtradas. */
  estabs?: number[];
  /**
   * Se presente, recebe "origem:chave" das notas cuja natureza de SERVIÇO não
   * tem regra de conta (genérica: a conta se decide na nota — ver conta-efetiva).
   * Para elas o motor não produz conta nenhuma, então o chamador precisa
   * espelhar o real MESMO em conta regrada: o gate por conta é um atalho que
   * aqui erraria, deixando a nota sem contrapartida no lado fiscal e inventando
   * uma diferença do tamanho dela.
   */
  semRegraConta?: Set<string>;
}

export async function balanceteFiscal(
  client: PoolClient,
  empresa: number,
  inicio: string,
  fim: string,
  tipo: "ent" | "sai",
  opts: OpcoesBalanceteFiscal = {}
): Promise<BalanceteFiscalMov> {
  const {
    chavesFiltro,
    observadas,
    observadasPorNatureza,
    detalhe,
    produzidas,
    contrapartidaVariavel,
    lancadas,
    producao,
    estabs = [],
    semRegraConta,
  } = opts;
  const c = LADO[tipo];

  // Notas do período, com os valores que alimentam as fórmulas.
  const params: unknown[] = [empresa, inicio, fim];
  let filtroChaves = "";
  if (chavesFiltro) {
    params.push(chavesFiltro);
    filtroChaves = `and f.${c.chave} = any($${params.length}::bigint[])`;
  }
  let filtroEstab = "";
  if (estabs.length) {
    params.push(estabs);
    filtroEstab = `and f.codigoestab = any($${params.length}::int[])`;
  }
  const notas = (
    await client.query<NotaRow>(
      `select f.${c.chave} chave, f.codigoestab estab,
              f.numeronf numero, upper(btrim(f.especienf)) especie,
              to_char(f.datalctofis,'YYYY-MM-DD') data, p.nomepessoa contraparte,
              coalesce(f.valorcontabil,0)::float vlrcontabil,
              coalesce(f.valoripi,0)::float vlripi,
              ${c.funrural}::float vlrfunrural
         from ${c.tabela} f
         left join pessoa p on p.codigopessoa = f.codigopessoa
        where f.codigoempresa=$1 and f.datalctofis between $2 and $3 and f.cancelada <> '1' ${filtroChaves} ${filtroEstab}`,
      params
    )
  ).rows;
  if (!notas.length) return { porConta: new Map(), notas: 0, pulados: 0, agregado: new Map() };

  const chaves = notas.map((n) => n.chave);

  // CFOPs de cada nota.
  const cfopsRes = await client.query<{ chave: number; cfop: number }>(
    `select distinct ${c.chave} chave, codigocfop cfop from ${c.prod}
      where codigoempresa=$1 and datalctofis between $2 and $3 and ${c.chave}=any($4::bigint[])`,
    [empresa, inicio, fim, chaves]
  );
  const cfopsPorNota = new Map<number, number[]>();
  const todosCfops = new Set<number>();
  for (const r of cfopsRes.rows) {
    todosCfops.add(r.cfop);
    const l = cfopsPorNota.get(r.chave);
    if (l) l.push(r.cfop);
    else cfopsPorNota.set(r.chave, [r.cfop]);
  }

  // Valores POR CFOP — uma nota se reparte por CFOP no `lctofis*cfop` (cada CFOP
  // com a sua parcela do valor contábil), então usar o total da nota em cada CFOP
  // dobra/tripa o esperado em nota multi-CFOP. `valorcontabilimposto` do ICMS
  // (tipoimposto 1) é a parcela contábil de cada CFOP; some ao total da nota.
  // Nulo quando o CFOP não tem ICMS destacado — aí cai no total (nota de 1 CFOP).
  const valoresCfop = new Map<string, { cont: number | null; icms: number; ipi: number }>();
  const vcRes = await client.query<{ chave: number; cfop: number; cont: number | null; icms: number; ipi: number }>(
    `select ${c.chave} chave, codigocfop cfop,
            sum(valorcontabilimposto) filter (where tipoimposto=1)::float cont,
            coalesce(sum(valorimposto) filter (where tipoimposto=1),0)::float icms,
            coalesce(sum(valorimposto) filter (where tipoimposto=2),0)::float ipi
       from ${c.cfopTab}
      where codigoempresa=$1 and datalctofis between $2 and $3 and ${c.chave}=any($4::bigint[])
      group by ${c.chave}, codigocfop`,
    [empresa, inicio, fim, chaves]
  );
  for (const r of vcRes.rows) valoresCfop.set(`${r.chave}:${r.cfop}`, { cont: r.cont, icms: r.icms, ipi: r.ipi });

  // (chave:cfop) que têm ICMS-ST na nota (valorsubtribut no produto — no cfopTab
  // só existe ICMS/IPI). O componente de ST do plano só deve gerar lançamento
  // quando a nota TEM ST; sem isto o motor dispara a ST pelo flag `apurasubtribut`
  // do CFOP mesmo sem ST na nota e, como a tabela de ST costuma ser cópia da de
  // mercadoria (mesma conta, mesmo vlrContICMS), DOBRA o valor contábil.
  const temSt = new Set<string>();
  const stRes = await client.query<{ chave: number; cfop: number }>(
    `select ${c.chave} chave, codigocfop cfop from ${c.prod}
      where codigoempresa=$1 and datalctofis between $2 and $3 and ${c.chave}=any($4::bigint[])
      group by ${c.chave}, codigocfop having coalesce(sum(valorsubtribut),0) > 0.005`,
    [empresa, inicio, fim, chaves]
  );
  for (const r of stRes.rows) temSt.add(`${r.chave}:${r.cfop}`);

  // Plano de contabilização (Questor + override + aprendido), igual à Conferência.
  const [planoBruto, overrides] = await Promise.all([
    planoQuestor(client, empresa, { cfops: [...todosCfops] }),
    listarOverrides(empresa),
  ]);
  const comOverride = aplicarOverrides(planoBruto, overrides);
  // Natureza de serviço com tabela de contabilização velha cobraria uma conta
  // que ninguém mais usa — o motor espera a conta que ela de fato recebe.
  if (await precisaAprenderContaEfetiva(empresa)) {
    await aprenderContaEfetiva(client, empresa, new Map(comOverride.map((p) => [`${p.estab}:${p.cfop}`, p])));
  }
  const plano = aplicarContaEfetiva(comOverride, await buscarContaEfetiva(empresa));
  let auto = await buscarAutoContabiliza(empresa);
  if (auto.size === 0) {
    await aprenderContabilizacao(client, empresa);
    auto = await buscarAutoContabiliza(empresa);
  }
  const porChave = new Map<string, (typeof plano)[number]>();
  for (const p of plano) {
    if (p.origem !== "override") {
      const a = auto.get(`${p.estab}:${p.cfop}`);
      if (a) p.contabiliza = a.contabiliza;
    }
    porChave.set(`${p.estab}:${p.cfop}`, p);
  }

  const porConta = new Map<number, MovConta>();
  const agregado = new Map<string, { valor: number; irmas: number[] }>();
  let pulados = 0;
  const add = (conta: number, natureza: 1 | -1, valor: number) => {
    let m = porConta.get(conta);
    if (!m) {
      m = { debito: 0, credito: 0 };
      porConta.set(conta, m);
    }
    if (natureza === 1) m.debito += valor;
    else m.credito += valor;
  };

  for (const n of notas) {
    const cfops = cfopsPorNota.get(n.chave) ?? [];
    const umCfop = cfops.length === 1;
    for (const cf of cfops) {
      const p = porChave.get(`${n.estab}:${cf}`);
      if (!p || !p.contabiliza) continue;
      // Natureza genérica de serviço: sem conta habitual, não há o que cobrar.
      if (semRegraConta && p.contaEfetiva && p.contaEfetiva.para == null) {
        semRegraConta.add(`${tipo === "ent" ? "ME" : "MS"}:${n.chave}`);
      }
      // Valores da PARCELA deste CFOP (não o total da nota — senão dobra em multi-CFOP).
      const vc = valoresCfop.get(`${n.chave}:${cf}`);
      const cont = vc?.cont ?? (umCfop ? n.vlrcontabil : 0);
      const valores = {
        vlrContabil: cont,
        vlrContICMS: cont,
        // vlrContISS (líquido de ISS) só faz sentido em SERVIÇO (só NFSE tem ISS).
        // Gateado por espécie: uma NFE de mercadoria pode ter CFOP cujo componente
        // usa vlrContISS e, sem o gate, o motor gera despesa de serviço pra ela.
        ...(n.especie === "NFSE" ? { vlrContISS: cont } : {}),
        vlrICMS: vc?.icms ?? 0,
        vlrIPI: vc?.ipi ?? (umCfop ? n.vlripi : 0),
        vlrFunRural: umCfop ? n.vlrfunrural : 0,
      } as ValoresNota;

      // Contas FIXAS que o componente PRINCIPAL (valor contábil) já posta nesta
      // nota+CFOP. No Questor, quando a tabela do valor contábil é a entrada
      // COMPLETA (mercadoria líquida + fornecedor + os tributos: ICMS a
      // recuperar, PIS/COFINS a recuperar, IPI…), as tabelas por-tributo
      // (ICMS/IPI/PIS/COFINS…) são redundantes e o ERP NÃO as aplica. O motor
      // aplicava as duas e dobrava o tributo (ex.: conta 382 "ICMS a Recuperar"
      // vinha 2×). Regra: componente de tributo cuja conta o principal já posta
      // é ignorado inteiro. Validado na nota 14228 (bate 1× com o real).
      const contasPrincipais = new Set<number>();
      const principal = p.componentes.find((comp) => comp.id === "vlrcontabil");
      if (principal) {
        for (const linha of principal.linhas) {
          if (linha.contaVariavel || linha.conta == null) continue;
          const v = avaliarRegra(linha.regraValor, valores);
          if (v != null && Math.abs(v) >= 0.005) contasPrincipais.add(linha.conta);
        }
      }

      for (const comp of p.componentes) {
        // ST só gera lançamento se a nota realmente tem ST — senão dobra a mercadoria.
        if (comp.id === "st" && !temSt.has(`${n.chave}:${cf}`)) continue;
        // Tributo já embutido no valor contábil: não somar de novo (ver acima).
        if (
          comp.id !== "vlrcontabil" &&
          comp.linhas.some(
            (l) => l.conta != null && !l.contaVariavel && contasPrincipais.has(l.conta)
          )
        ) {
          continue;
        }
        for (const linha of comp.linhas) {
          const valor = avaliarRegra(linha.regraValor, valores);
          if (valor == null) {
            pulados += 1; // token de fase 2 (serviço/retenção) — não sei o valor ainda
            continue;
          }
          if (Math.abs(valor) < 0.005) continue;
          const conta = linha.contaVariavel ? CONTA_CONTRAPARTIDA : linha.conta;
          if (conta == null) continue;
          const origem = tipo === "ent" ? "ME" : "MS";
          // O plano prevê conta variável nesta natureza: qualquer conta que a
          // nota tenha ali é legítima (é o fornecedor/cliente dela).
          if (contrapartidaVariavel && linha.contaVariavel) {
            contrapartidaVariavel.add(`${origem}:${n.chave}:${linha.natureza}`);
          }
          // Registra ANTES do gate `observadas`: a nota tem plano que gera esta
          // conta fixa, mesmo que essa conta não receba lançamento por nota (aí o
          // motor não a soma, mas ela É reproduzível — é o que separa conta errada
          // de sem-plano no detalhe da diferença).
          if (produzidas && conta !== CONTA_CONTRAPARTIDA) {
            produzidas.add(`${origem}:${n.chave}`);
          }
          // A conta que o plano MANDA no componente principal (pré-gate): é a
          // "certa" pela regra, mesmo quando o motor não chega a produzi-la.
          if (producao && conta !== CONTA_CONTRAPARTIDA && comp.id === "vlrcontabil") {
            const k = `${origem}:${n.chave}`;
            const atual = producao.get(k);
            if (!atual || Math.abs(valor) > atual.valor) {
              producao.set(k, { conta, valor: Math.abs(valor) });
            }
          }
          // Conta que não é lançada nota a nota (vai na apuração mensal): não é ME.
          // Exceção: o componente PRINCIPAL de nota lançada por nota fura o gate —
          // a despesa/receita dela existe no contábil; se a conta do plano nunca é
          // usada, foi pra conta errada, e produzir a certa expõe a diferença.
          // Quem responde "isso é lançado por nota?" é o par (natureza, conta)
          // quando a natureza tem lançamento no período; senão o gate por conta.
          const lancaPorNota =
            observadasPorNatureza?.has(`${cf}:*`)
              ? observadasPorNatureza.has(`${cf}:${linha.natureza}:${conta}`)
              : (observadas?.has(`${linha.natureza}:${conta}`) ?? true);
          if (observadas && conta !== CONTA_CONTRAPARTIDA && !lancaPorNota) {
            const notaLancada = lancadas?.has(`${origem}:${n.chave}`) ?? false;
            if (!(comp.id === "vlrcontabil" && notaLancada)) {
              // A natureza lança por nota, mas NESTA conta não: é componente que
              // o contábil fecha na apuração. Não se cobra da nota — se cobra do
              // mês, somando aqui o que a apuração deveria ter lançado.
              if (observadasPorNatureza?.has(`${cf}:*`)) {
                const irmas = comp.linhas
                  .filter((l) => !l.contaVariavel && l.conta != null && l.conta !== conta)
                  .map((l) => l.conta as number)
                  .sort((a, b) => a - b);
                // A conta irmã entra na chave: duas naturezas podem debitar a
                // MESMA conta com o mesmo histórico contra créditos diferentes
                // (382 contra 3040 e contra 3097). Somadas numa chave só, a
                // expectativa casaria com um lado e sobraria do outro.
                const k = `${linha.natureza}:${conta}:${linha.historico ?? 0}:${irmas.join(",")}`;
                const ac = agregado.get(k) ?? { valor: 0, irmas };
                ac.valor += valor;
                agregado.set(k, ac);
              }
              continue;
            }
            // Bypass disparou: a nota foi lançada, mas a conta do plano nunca
            // recebe nota — o lançamento real dela (nesta natureza) está em conta
            // errada e sai do espelho (a versão do motor o substitui). SÓ no
            // bypass: quando o principal cai em conta observada, a comparação por
            // conta já cuida, e excluir aqui varreria componentes irmãos que o
            // motor não reproduz (PIS/COFINS a recuperar etc.) → fantasma.
            if (produzidas) {
              produzidas.add(`${origem}:${n.chave}:${linha.natureza}`);
            }
          }
          add(conta, linha.natureza, valor);
          // Drill-down do Fiscal: registra a contribuição desta nota à conta alvo.
          if (
            detalhe &&
            conta !== CONTA_CONTRAPARTIDA &&
            detalhe.contas.has(conta) &&
            (detalhe.net || linha.natureza === detalhe.natureza)
          ) {
            detalhe.regradas.add(conta);
            // No modo líquido, débito soma e crédito subtrai; senão o valor cru.
            const v = detalhe.net && linha.natureza === -1 ? -valor : valor;
            const ex = detalhe.porNota.get(n.chave);
            if (ex) ex.valor += v;
            else
              detalhe.porNota.set(n.chave, {
                chave: n.chave,
                numero: n.numero,
                especie: n.especie,
                data: n.data,
                contraparte: n.contraparte,
                origem: tipo === "ent" ? "ME" : "MS",
                valor: v,
                conta,
              });
          }
        }
      }
    }
  }

  return { porConta, notas: notas.length, pulados, agregado };
}
