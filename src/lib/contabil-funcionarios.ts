import "server-only";
import { query } from "./db";
import { empresasPermitidas, getSessaoOpcional } from "./sessao";
import { FilterError } from "./fiscal-filters";
import {
  casarPessoa,
  indexarPessoas,
  normalizar,
  type PessoaFolha,
  type SeloFolha,
} from "./folha-casamento";
import type { FuncionarioContabil, FuncionariosContabilResp } from "./contabil-funcionarios-tipos";

/**
 * A folha vista pelo Contábil. Duas perguntas, uma fonte:
 *
 * 1. "Quem são os funcionários desta empresa?" — a seção Funcionários.
 * 2. "Esta linha do extrato é pagamento a funcionário?" — o selo da Conciliação.
 *
 * Não é integração com nada: a folha do Questor mora no MESMO banco que o app já
 * lê. O que faltava era o contábil poder olhar sem depender do DP. O recorte é
 * de propósito mais pobre que o do módulo DP — nome, vínculo e datas, nunca
 * remuneração (ver [[contabil-funcionarios-tipos]]).
 */

/** Mascara o CPF deixando o miolo — os mesmos dígitos que o PIX expõe. */
export function mascararCpf(cpf: string | null): string | null {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/**
 * Empresas em que se pode procurar. `null` = sem restrição (quem vê todas).
 * O casamento cruza empresas — funcionário registrado numa e pago por outra do
 * grupo é o caso que mais confunde —, mas nunca vaza para fora do escopo da
 * sessão: quem só enxerga três empresas só descobre gente dessas três.
 */
async function escopoDeEmpresas(): Promise<number[] | null> {
  const sessao = await getSessaoOpcional();
  if (!sessao) throw new FilterError("Sessão expirada");
  const escopo = empresasPermitidas(sessao);
  return escopo === "todas" ? null : escopo;
}

/** Nome das empresas citadas nos selos — o código sozinho não diz nada a quem lê. */
async function nomesDeEmpresa(codigos: number[]): Promise<Map<number, string>> {
  if (!codigos.length) return new Map();
  const rows = await query<{ codigo: number; nome: string }>(
    `select codigoempresa as codigo, btrim(nomeempresa) as nome
       from empresa where codigoempresa = any($1::int[])`,
    [codigos]
  );
  return new Map(rows.map((r) => [r.codigo, r.nome]));
}

interface PessoaRow {
  empresa: number;
  contrato: number;
  nome: string;
  cpf: string | null;
  dataadm: string | null;
  datadem: string | null;
}

/**
 * Todos os vínculos do escopo, para o casamento em memória.
 *
 * Sai de `funccontrato` + `funcpessoa` e NÃO da view `funcionario` de propósito:
 * a view resolve as vigências (salário, cargo, lotação) com um join por tabela,
 * e aqui só se precisa de nome, CPF e datas. São ~21 mil vínculos na base
 * inteira — cabem na memória do processo e casam mais rápido que um ILIKE por
 * linha do extrato.
 *
 * Inclui desligados: comissão paga a ex-funcionário é justamente um dos casos
 * que o contábil erra — o selo mostra a data e deixa a decisão com ele.
 */
async function vinculosDoEscopo(empresas: number[] | null): Promise<PessoaFolha[]> {
  if (empresas && empresas.length === 0) return [];
  const filtro = empresas ? "and fc.codigoempresa = any($1::int[])" : "";
  const rows = await query<PessoaRow>(
    `select fc.codigoempresa as empresa,
            fc.codigofunccontr as contrato,
            btrim(fp.nomefunc) as nome,
            nullif(btrim(fp.cpffunc), '') as cpf,
            to_char(fc.dataadm, 'YYYY-MM-DD') as dataadm,
            to_char(fc.datadem, 'YYYY-MM-DD') as datadem
       from funccontrato fc
       join funcpessoa fp on fp.codigofuncpessoa = fc.codigofuncpessoa
      where nullif(btrim(fp.nomefunc), '') is not null ${filtro}`,
    empresas ? [empresas] : []
  );
  return rows;
}

/**
 * Carimba em cada descrição quem é a pessoa na folha, quando é alguém.
 *
 * Roda sobre a prévia inteira do extrato de uma vez: uma consulta e um índice
 * para todas as linhas. Descrições repetidas (o mesmo favorecido toda semana)
 * são resolvidas uma vez só.
 */
export async function anotarPessoas(
  empresaDoExtrato: number,
  descricoes: string[]
): Promise<(SeloFolha | null)[]> {
  const pessoas = await vinculosDoEscopo(await escopoDeEmpresas());
  if (!pessoas.length) return descricoes.map(() => null);

  const indice = indexarPessoas(pessoas);
  const memo = new Map<string, SeloFolha | null>();
  const selos = descricoes.map((d) => {
    const chave = normalizar(d);
    const visto = memo.get(chave);
    if (visto !== undefined) return visto;
    const selo = casarPessoa(d, indice, empresaDoExtrato);
    memo.set(chave, selo);
    return selo;
  });

  // Só as empresas que apareceram — e só as diferentes da do extrato, que é a
  // única que o selo não precisa nomear.
  const nomes = await nomesDeEmpresa([
    ...new Set(
      selos.filter((s): s is SeloFolha => !!s && !s.mesmaEmpresa).map((s) => s.empresa)
    ),
  ]);
  for (const s of selos) {
    if (s && !s.mesmaEmpresa) s.empresaNome = nomes.get(s.empresa) ?? null;
  }
  return selos;
}

interface QuadroRow {
  contrato: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  setor: string | null;
  estabelecimento: string | null;
  dataadm: string | null;
  datadem: string | null;
  tempocasadias: number | null;
}

/**
 * Quadro de funcionários de UMA empresa, para a seção do Contábil.
 *
 * Aqui vale a view `funcionario` (é ela que resolve cargo e lotação vigentes) —
 * uma empresa por vez, como o resto da bancada do módulo. Cargo basta: função
 * não entra porque quase todo contrato vem sem ela.
 */
export async function quadroDaEmpresa(
  empresa: number,
  incluirDesligados: boolean
): Promise<FuncionariosContabilResp> {
  const rows = await query<QuadroRow>(
    `select f.codigofunccontr as contrato,
            btrim(f.nomefunc) as nome,
            nullif(btrim(f.cpffunc), '') as cpf,
            nullif(btrim(ca.descrcargo), '') as cargo,
            nullif(btrim(o.descrorgan), '') as setor,
            coalesce(nullif(btrim(es.apelidoestab), ''), nullif(btrim(es.nomeestab), '')) as estabelecimento,
            to_char(f.dataadm, 'YYYY-MM-DD') as dataadm,
            to_char(f.datadem, 'YYYY-MM-DD') as datadem,
            (coalesce(f.datadem, current_date) - f.dataadm) as tempocasadias
       from funcionario f
       left join cargo ca on ca.codigocargo = f.codigocargo
       left join organograma o
         on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab
        and o.classiforgan = f.classiforgan
       left join estab es on es.codigoempresa = f.codigoempresa and es.codigoestab = f.codigoestab
      where f.codigoempresa = $1 ${incluirDesligados ? "" : "and f.datadem is null"}
      order by f.nomefunc`,
    [empresa]
  );

  const linhas: FuncionarioContabil[] = rows.map((r) => ({
    contrato: r.contrato,
    nome: r.nome,
    cpf: mascararCpf(r.cpf),
    cargo: r.cargo,
    setor: r.setor,
    estabelecimento: r.estabelecimento,
    dataadm: r.dataadm,
    datadem: r.datadem,
    tempoCasaDias: r.tempocasadias,
  }));

  return {
    empresa,
    ativos: linhas.filter((l) => !l.datadem).length,
    desligados: linhas.filter((l) => l.datadem).length,
    linhas,
  };
}
