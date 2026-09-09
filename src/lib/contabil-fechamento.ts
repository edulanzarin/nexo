import "server-only";
import { query } from "./db";
import { buckets, carregarCadastros, escopoEmpresas, type ProdFiltros } from "./contabil-prod-comum";
import { carteiraDoSetor, estadoCarteira, SETOR_CONTABIL } from "./carteira-setores";
import { cnpjsDosGrupos, gruposPorCnpj } from "./carteira-grupos";
import type {
  ContabilFechamentoResp,
  CtbFechamentoAnalista,
  CtbFechamentoEmpresa,
  SituacaoFechamento,
} from "./contabil-fechamento-tipos";

/**
 * ABA FECHAMENTO — quais empresas tiveram o mês fechado, e de quem elas são.
 *
 * As outras abas medem o que o time PRODUZIU; esta mede o que ele TERMINOU.
 * Fechar o mês de uma empresa é apurar o resultado, e isso deixa um rastro
 * único: um lançamento na conta de Encerramento do Exercício. Sem ele, a empresa
 * pode ter mil lançamentos e não estar fechada.
 *
 * ## O que torna a consulta barata
 *
 * Varrer `lctoctb` atrás de um par débito/crédito é caro porque o OR não usa
 * índice: medido em set/2026, doze meses do escritório inteiro levam 58 s —
 * perto do timeout. O que derruba isso para menos de 1 s são DUAS condições
 * juntas, e nenhuma sozinha resolve:
 *
 *  1. a LISTA DE EMPRESAS (a carteira do Acessórias) no `where`, que dá ao
 *     planner o prefixo dos índices `(codigoempresa, contactbdeb/cred)`; e
 *  2. o predicado REDUNDANTE com as contas distintas, que é o que ele consegue
 *     casar com esses índices — o `join` pareado por empresa garante a
 *     correção, mas sozinho não habilita índice nenhum.
 *
 * ## Por que o razão, e não o saldo mensal
 *
 * `saldoctbmensal` responde a mesma pergunta em 0,8 s e foi a primeira escolha —
 * mas ele agrega MOVIMENTO DE SALDO, não lançamento, e saldo também entra por
 * implantação (`implsaldoctb`, a função de saldo de abertura do Questor). Medido:
 * a empresa 1389 aparece com movimento na conta de encerramento em maio/2026 e
 * NÃO TEM UM ÚNICO LANÇAMENTO no razão — o saldo veio da implantação. Contá-la
 * como fechada seria creditar ao analista um fechamento que não houve. O saldo
 * mensal fica no que ele responde sem ambiguidade: se a empresa escriturou
 * alguma coisa na competência.
 */

/**
 * As contas de encerramento por empresa, pela CLASSIFICAÇÃO (não pelo código
 * reduzido): 4855 é "Encerramento do Exercício" em 1.363 empresas, mas em uma
 * delas é "PARTICIPAÇÕES NOS LUCROS" (4.3.03.01) — fixar o número contaria
 * fechamento onde não houve. Só analíticas: a sintética `7.1.01` não recebe
 * lançamento.
 */
const SQL_CONTAS = `
  with contas as (
    select codigoempresa, contactb
      from planoespec
     where classifconta like '7.1.01%' and tipoconta = 2
  ),
  distintas as (select distinct contactb from contas)`;

/** O par de predicados que habilita os índices — ver o cabeçalho. */
const SQL_JUNCAO_CONTAS = `
  join contas c on c.codigoempresa = l.codigoempresa
   and (l.contactbdeb = c.contactb or l.contactbcred = c.contactb)`;

const SQL_FILTRO_CONTAS = `
  and (l.contactbdeb = any(array(select contactb from distintas))
       or l.contactbcred = any(array(select contactb from distintas)))`;

interface FechamentoRow {
  e: number;
  mes: string;
  registrado: string;
  usuario: number;
}

interface UltimaRow {
  e: number;
  ultima: string;
}

interface MovimentoRow {
  e: number;
  mes: string;
}

const mesDe = (iso: string) => iso.slice(0, 7) + "-01";

/** Distância em meses entre duas competências "YYYY-MM-01". */
function distanciaEmMeses(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

export async function montarFechamentoContabil(
  f: ProdFiltros,
  /**
   * Grupos de empresa do ACESSÓRIAS a exibir. Vazio = sem recorte. O filtro
   * corta a carteira ANTES de qualquer contagem, então totais, ranking por
   * analista e série por competência falam todos do mesmo conjunto — filtro que
   * só recorta a tabela e deixa os cartões falando do escritório inteiro é o
   * jeito mais rápido de alguém ler o número errado.
   */
  gruposAcess: number[] = []
): Promise<ContabilFechamentoResp> {
  // As competências do recorte. Período que começa ou termina no meio do mês
  // inclui o mês inteiro: fechamento é do mês, não do intervalo.
  const meses = buckets(f.inicio, f.fim, "mes");
  const referencia = meses[meses.length - 1];
  const referenciaEmCurso = referencia >= mesDe(new Date().toISOString().slice(0, 10));

  const [carteira, estado, escopo, nomesDeGrupo, cnpjsDoFiltro] = await Promise.all([
    carteiraDoSetor(SETOR_CONTABIL),
    estadoCarteira(),
    escopoEmpresas(f),
    gruposPorCnpj(),
    cnpjsDosGrupos(gruposAcess),
  ]);

  // O recorte de empresa da barra e o alcance da sessão valem aqui como em
  // qualquer consulta: a carteira do Acessórias não é uma porta lateral para ver
  // empresa que a permissão não alcança.
  const permitida = (codigo: number | null) =>
    codigo !== null && (escopo === "todas" || escopo.includes(codigo));

  const permitidas = carteira.filter((c) => c.codigoempresa === null || permitida(c.codigoempresa));
  const foraDoEscopo = carteira.length - permitidas.length;

  // O grupo recorta DEPOIS da permissão e é contado à parte: "fora do seu
  // escopo" é cadastro/permissão a resolver, "fora do grupo" é escolha de quem
  // está olhando. Somar os dois num número só faria a tela acusar um problema
  // que não existe toda vez que alguém filtrasse.
  const noEscopo = gruposAcess.length
    ? permitidas.filter((c) => cnpjsDoFiltro.has(c.cnpj))
    : permitidas;
  const foraDoGrupo = permitidas.length - noEscopo.length;
  const codigos = noEscopo.map((c) => c.codigoempresa).filter((c): c is number => c !== null);

  const [fechamentos, ultimas, movimento] = codigos.length
    ? await Promise.all([
        // O fechamento e quem o registrou, por empresa e competência.
        query<FechamentoRow>(
          `${SQL_CONTAS}
           select l.codigoempresa as e,
                  to_char(date_trunc('month', l.datalctoctb), 'YYYY-MM-DD') as mes,
                  to_char(max(l.datahoralctoctb), 'YYYY-MM-DD"T"HH24:MI:SS') as registrado,
                  (array_agg(l.codigousuario order by l.datahoralctoctb desc))[1] as usuario
             from lctoctb l ${SQL_JUNCAO_CONTAS}
            where l.codigoempresa = any($1::int[])
              ${SQL_FILTRO_CONTAS}
              and l.datalctoctb >= $2::date and l.datalctoctb < ($3::date + 1)
            group by 1, 2`,
          [codigos, f.inicio, f.fim]
        ),
        // Última competência fechada de TODOS os tempos, fora do período: é o que
        // responde "esta empresa está parada no fechamento desde quando", coisa
        // que o recorte, por definição, não pode dar.
        query<UltimaRow>(
          `${SQL_CONTAS}
           select l.codigoempresa as e,
                  to_char(date_trunc('month', max(l.datalctoctb)), 'YYYY-MM-DD') as ultima
             from lctoctb l ${SQL_JUNCAO_CONTAS}
            where l.codigoempresa = any($1::int[])
              ${SQL_FILTRO_CONTAS}
            group by 1`,
          [codigos]
        ),
        // Houve escrituração na competência? Aqui o saldo mensal é a fonte certa
        // — ele já é o movimento agregado por (empresa, conta, mês), e a mesma
        // pergunta no razão obrigaria a varrer o período inteiro sem filtro de
        // conta. Empresa sem linha aqui não deixou trabalho por fazer.
        //
        // O `not exists` tira o saldo que veio da IMPLANTAÇÃO (`implsaldoctb`, o
        // saldo de abertura que o Questor grava direto, sem partida dobrada).
        // Sem ele, a empresa que acabou de entrar no escritório aparece "em
        // aberto" no mês da abertura — cobrando um fechamento de um mês que ela
        // não trabalhou aqui. É o mesmo ruído que já tirou o saldo mensal da
        // função de marcar o fechamento; aqui ele volta pela porta do movimento.
        query<MovimentoRow>(
          `select distinct s.codigoempresa as e, to_char(s.datasaldo, 'YYYY-MM-DD') as mes
             from saldoctbmensal s
            where s.codigoempresa = any($1::int[])
              and s.datasaldo = any($2::date[])
              and (s.valordeb <> 0 or s.valorcred <> 0)
              and not exists (
                select 1 from implsaldoctb i
                 where i.codigoempresa = s.codigoempresa
                   and i.contactb = s.contactb
                   and date_trunc('month', i.datasaldo) = s.datasaldo)`,
          [codigos, meses]
        ),
      ])
    : [[], [], []];

  const cadastros = await carregarCadastros({ empresas: [] });

  const fechadoEm = new Map<string, { registrado: string; usuario: number }>();
  for (const r of fechamentos) {
    fechadoEm.set(`${r.e}|${r.mes}`, { registrado: r.registrado, usuario: r.usuario });
  }
  const comMovimento = new Set(movimento.map((m) => `${m.e}|${m.mes}`));
  const ultimaDe = new Map(ultimas.map((u) => [u.e, u.ultima]));

  const iReferencia = meses.length - 1;
  const empresas: CtbFechamentoEmpresa[] = [];
  const porAnalista = new Map<string, CtbFechamentoAnalista>();
  const porMes = meses.map((mes) => ({ mes, fechadas: 0, abertas: 0 }));

  let fechadas = 0;
  let abertas = 0;
  let semMovimento = 0;
  let nuncaFecharam = 0;
  let semPar = 0;

  for (const c of noEscopo) {
    const codigo = c.codigoempresa;
    const analista = c.respNome;

    if (codigo === null) {
      semPar++;
      empresas.push({
        codigo: null,
        cnpj: c.cnpj,
        nome: c.fantasia || c.razao,
        analista,
        grupos: nomesDeGrupo.get(c.cnpj) ?? [],
        situacoes: meses.map(() => "sem-par" as SituacaoFechamento),
        registradoEm: null,
        fechadoPor: null,
        ultimaCompetencia: null,
        mesesAtras: null,
      });
      continue;
    }

    // O fechamento mais recente DENTRO do período — a coluna "Registro" da
    // tabela. Na competência de referência ele costuma não existir ainda, e
    // mostrar vazio ali esconderia que a empresa fechou o resto do período.
    let ultimoRegistro: { registrado: string; usuario: number } | null = null;

    const situacoes: SituacaoFechamento[] = meses.map((mes, i) => {
      const chave = `${codigo}|${mes}`;
      const fechou = fechadoEm.get(chave);
      if (fechou && (!ultimoRegistro || fechou.registrado > ultimoRegistro.registrado)) {
        ultimoRegistro = fechou;
      }
      const situacao: SituacaoFechamento = fechou
        ? "fechada"
        : comMovimento.has(chave)
          ? "aberta"
          : "sem-movimento";
      if (situacao === "fechada") porMes[i].fechadas++;
      else if (situacao === "aberta") porMes[i].abertas++;
      return situacao;
    });

    const ultima = ultimaDe.get(codigo) ?? null;
    const naReferencia = situacoes[iReferencia];

    // A carteira do analista é contada na REFERÊNCIA, não no período inteiro:
    // "fechou 40 de 60" só quer dizer alguma coisa dentro de uma competência.
    const chaveAnalista = analista ?? "";
    const linha = porAnalista.get(chaveAnalista) ?? {
      nome: analista ?? "Sem responsável",
      carteira: 0,
      fechadas: 0,
      abertas: 0,
      semMovimento: 0,
      pct: 0,
    };
    if (naReferencia === "fechada") {
      linha.fechadas++;
      linha.carteira++;
      fechadas++;
    } else if (naReferencia === "aberta") {
      linha.abertas++;
      linha.carteira++;
      abertas++;
    } else {
      linha.semMovimento++;
      semMovimento++;
    }
    porAnalista.set(chaveAnalista, linha);

    // Nunca fechou, mas escritura: é o caso que mais custa caro descobrir tarde,
    // porque não aparece em atraso nenhum — a empresa simplesmente nunca teve
    // uma apuração.
    if (!ultima && naReferencia !== "sem-movimento") nuncaFecharam++;

    const registro = ultimoRegistro as { registrado: string; usuario: number } | null;
    empresas.push({
      codigo,
      cnpj: c.cnpj,
      nome: c.fantasia || c.razao,
      analista,
      grupos: nomesDeGrupo.get(c.cnpj) ?? [],
      situacoes,
      registradoEm: registro?.registrado ?? null,
      fechadoPor: registro ? cadastros.nomeUsuario(registro.usuario) : null,
      ultimaCompetencia: ultima,
      mesesAtras: ultima ? distanciaEmMeses(ultima, referencia) : null,
    });
  }

  // O topo é o que precisa de ação: aberto na referência primeiro, e dentro
  // disso quem está parado há mais tempo. Sem par vai para o fim — não é
  // trabalho atrasado, é cadastro a acertar.
  const peso = (e: CtbFechamentoEmpresa) => {
    if (e.codigo === null) return 3;
    const s = e.situacoes[iReferencia];
    return s === "aberta" ? 0 : s === "fechada" ? 1 : 2;
  };
  empresas.sort(
    (a, b) =>
      peso(a) - peso(b) ||
      (b.mesesAtras ?? -1) - (a.mesesAtras ?? -1) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  const analistas = [...porAnalista.values()]
    .map((a) => ({ ...a, pct: a.carteira ? a.fechadas / a.carteira : 0 }))
    .sort((a, b) => b.carteira - a.carteira || a.nome.localeCompare(b.nome, "pt-BR"));

  const mediveis = fechadas + abertas;

  return {
    periodo: { inicio: f.inicio, fim: f.fim },
    meses,
    referencia,
    referenciaEmCurso,
    carteira: {
      atualizadoEm: estado.atualizadoEm,
      empresas: carteira.length,
      semPar,
      foraDoEscopo,
      foraDoGrupo,
      sincronizando: estado.rodando !== null,
    },
    totais: {
      carteira: mediveis,
      fechadas,
      abertas,
      semMovimento,
      pct: mediveis ? fechadas / mediveis : 0,
      nuncaFecharam,
    },
    porAnalista: analistas,
    porMes,
    empresas,
  };
}
