import type { Aba } from "./secoes/tipos";
import { empresaDaAba, periodoDaAba } from "./secoes/tipos";

/**
 * O contexto de trabalho: a empresa (ou o grupo), a filial e o período sobre os
 * quais as telas do módulo rodam. Mora na URL e segue a pessoa de seção em
 * seção: escolher a empresa uma vez vale para a conciliação, a conferência e o
 * balancete dela.
 *
 * Os nomes dos parâmetros são os que as rotas de API do nexo2 já leem
 * (`empresas`, `grupos`, `estabs`, `inicio`, `fim`), então a query da tela é
 * o próprio contexto.
 */
export interface Contexto {
  empresas: number[];
  grupos: number[];
  estabs: number[];
  inicio: string;
  fim: string;
}

export const CHAVES_CONTEXTO = ["empresas", "grupos", "estabs", "inicio", "fim"] as const;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoje(): string {
  return iso(new Date());
}

export function inicioDoMes(): string {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** "YYYY-MM" do mês anterior ao corrente: o último mês que já fechou. */
export function ultimoMesFechado(): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return iso(m).slice(0, 7);
}

/** Último dia do mês "YYYY-MM", como ISO. */
export function fimDoMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/** Meses entre dois "YYYY-MM", inclusive. */
export function mesesEntre(ini: string, fim: string): number {
  const [ai, mi] = ini.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  return (af - ai) * 12 + (mf - mi) + 1;
}

export function somarMeses(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return iso(new Date(y, m - 1 + n, 1)).slice(0, 7);
}

function lista(v: string | null): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function dataValida(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function lerContexto(sp: URLSearchParams | { get(k: string): string | null }): Contexto {
  const inicio = sp.get("inicio");
  const fim = sp.get("fim");
  return {
    empresas: lista(sp.get("empresas")),
    grupos: lista(sp.get("grupos")),
    estabs: lista(sp.get("estabs")),
    inicio: dataValida(inicio) ? inicio : inicioDoMes(),
    fim: dataValida(fim) ? fim : hoje(),
  };
}

/** Escreve o contexto sobre os parâmetros atuais, sem apagar os que são da tela. */
export function gravarContexto(base: URLSearchParams, c: Contexto): URLSearchParams {
  const p = new URLSearchParams(base.toString());
  for (const k of CHAVES_CONTEXTO) p.delete(k);
  if (c.empresas.length) p.set("empresas", c.empresas.join(","));
  if (c.grupos.length) p.set("grupos", c.grupos.join(","));
  if (c.estabs.length) p.set("estabs", c.estabs.join(","));
  p.set("inicio", c.inicio);
  p.set("fim", c.fim);
  return p;
}

/** Só o contexto, para levar de uma seção para outra no link da barra lateral. */
export function qsSoContexto(c: Contexto): string {
  return gravarContexto(new URLSearchParams(), c).toString();
}

/**
 * O período que a aba realmente usa. Balancete é mensal e não entra com o mês
 * corrente (incompleto, pareceria uma queda): o recorte recua até o último mês
 * fechado e tem teto de 12 meses. O contexto na URL não muda; muda só o que
 * esta aba lê dele.
 */
export function periodoEfetivo(c: Contexto, aba: Aba | undefined): { inicio: string; fim: string } {
  const tipo = periodoDaAba(aba);
  if (tipo !== "mes") return { inicio: c.inicio, fim: c.fim };
  const teto = ultimoMesFechado();
  let mf = c.fim.slice(0, 7);
  let mi = c.inicio.slice(0, 7);
  if (mf > teto) mf = teto;
  if (mi > mf) mi = mf;
  if (mesesEntre(mi, mf) > 12) mi = somarMeses(mf, -11);
  return { inicio: `${mi}-01`, fim: fimDoMes(mf) };
}

/**
 * A query que a aba manda para a API: o contexto, recortado pelo que a aba usa.
 * Tela de uma empresa manda só a primeira; tela de escopo manda empresas e
 * grupos; filial só vai quando a aba honra filial e há uma empresa.
 */
export function qsDaAba(c: Contexto, aba: Aba | undefined): string {
  const p = new URLSearchParams();
  const escopo = empresaDaAba(aba);
  if (escopo === "uma" && c.empresas[0]) p.set("empresas", String(c.empresas[0]));
  if (escopo === "opcional") {
    if (c.empresas.length) p.set("empresas", c.empresas.join(","));
    else if (c.grupos.length) p.set("grupos", c.grupos.join(","));
  }
  if (aba?.filial && c.empresas.length === 1 && c.estabs.length) p.set("estabs", c.estabs.join(","));
  if (periodoDaAba(aba) !== "nenhum") {
    const { inicio, fim } = periodoEfetivo(c, aba);
    p.set("inicio", inicio);
    p.set("fim", fim);
  }
  return p.toString();
}

/** A aba tem o que precisa para rodar? Bancada sem empresa não roda. */
export function faltaEmpresa(c: Contexto, aba: Aba | undefined): boolean {
  return empresaDaAba(aba) === "uma" && c.empresas.length === 0;
}

export interface Atalho {
  nome: string;
  inicio: string;
  fim: string;
}

/** Atalhos de período por dia. Teto de um ano no intervalo livre. */
export function atalhosDia(): Atalho[] {
  const d = new Date();
  const mesPassadoIni = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const mesPassadoFim = new Date(d.getFullYear(), d.getMonth(), 0);
  const tresMeses = new Date(d.getFullYear(), d.getMonth() - 2, 1);
  return [
    { nome: "Este mês", inicio: inicioDoMes(), fim: hoje() },
    { nome: "Mês passado", inicio: iso(mesPassadoIni), fim: iso(mesPassadoFim) },
    { nome: "Últimos 3 meses", inicio: iso(tresMeses), fim: hoje() },
    { nome: "Este ano", inicio: `${d.getFullYear()}-01-01`, fim: hoje() },
    { nome: "Ano passado", inicio: `${d.getFullYear() - 1}-01-01`, fim: `${d.getFullYear() - 1}-12-31` },
  ];
}

/** Atalhos de período por mês, ancorados no último mês fechado. */
export function atalhosMes(): Atalho[] {
  const teto = ultimoMesFechado();
  const ano = new Date().getFullYear();
  const l: Atalho[] = [
    { nome: "Mês anterior", inicio: `${teto}-01`, fim: fimDoMes(teto) },
    { nome: "Últimos 3 meses", inicio: `${somarMeses(teto, -2)}-01`, fim: fimDoMes(teto) },
  ];
  if (new Date().getMonth() > 0) l.push({ nome: "Este ano", inicio: `${ano}-01-01`, fim: fimDoMes(teto) });
  l.push({ nome: "Ano passado", inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31` });
  return l;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function nomeMes(ym: string, longo = false): string {
  const [y, m] = ym.split("-");
  return longo ? `${MESES_LONGOS[Number(m) - 1]} de ${y}` : `${MESES[Number(m) - 1]}/${y.slice(2)}`;
}

export const ABREV_MESES = MESES;

/** Rótulo curto do período para o botão do topo. */
export function rotuloPeriodo(inicio: string, fim: string, tipo: "dia" | "mes"): string {
  const atalhos = tipo === "mes" ? atalhosMes() : atalhosDia();
  const a = atalhos.find((x) => x.inicio === inicio && x.fim === fim);
  if (a) return a.nome;
  if (tipo === "mes") {
    const mi = inicio.slice(0, 7);
    const mf = fim.slice(0, 7);
    return mi === mf ? nomeMes(mi) : `${nomeMes(mi)} a ${nomeMes(mf)}`;
  }
  const br = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(2, 4)}`;
  return `${br(inicio)} a ${br(fim)}`;
}
