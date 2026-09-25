const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numFmt = new Intl.NumberFormat("pt-BR");
const umaCasa = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Espaço que não quebra: "R$" e "mil" não se separam do número na quebra de linha. */
const NBSP = String.fromCharCode(160);

const UNIDADES = [
  { base: 1e9, nome: "bi" },
  { base: 1e6, nome: "mi" },
  { base: 1e3, nome: "mil" },
];

/**
 * Forma compacta montada à mão, e não pelo `notation: "compact"` do Intl: a
 * notação compacta depende da versão do ICU, e a do Node escreve "412,0 mil"
 * onde a do navegador escreve "412 mil". Na tela renderizada no servidor, a
 * diferença quebrava a hidratação do React (erro 418) sem aviso nenhum.
 */
function compacto(v: number): string {
  const abs = Math.abs(v);
  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i];
    if (abs < u.base) continue;
    const arred = Math.round((abs / u.base) * 10) / 10;
    // 999.960 arredonda para "1.000 mil": sobe para a unidade de cima.
    if (arred >= 1000 && i > 0) {
      const acima = UNIDADES[i - 1];
      return `${v < 0 ? "-" : ""}${umaCasa.format(Math.round((abs / acima.base) * 10) / 10)}${NBSP}${acima.nome}`;
    }
    return `${v < 0 ? "-" : ""}${umaCasa.format(arred)}${NBSP}${u.nome}`;
  }
  return `${v < 0 ? "-" : ""}${numFmt.format(Math.round(abs))}`;
}

export const brl = (v: number) => brlFmt.format(v);
export const brlCompact = (v: number) => {
  const c = compacto(v);
  return c.startsWith("-") ? `-R$${NBSP}${c.slice(1)}` : `R$${NBSP}${c}`;
};
export const num = (v: number) => numFmt.format(v);
export const numCompact = (v: number) => compacto(v);

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const dataHoraFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** ISO sem fuso: "2026-09-24T15:42", com segundos e fração opcionais. */
const RE_SEM_FUSO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Data + hora no fuso do escritório, igual no servidor e no navegador:
 * componente client também renderiza no servidor, o container está em UTC, e
 * texto diferente dos dois lados quebra a hidratação (#418).
 *
 * Com fuso ("…Z", o `Date` do driver), o instante é formatado em São Paulo.
 * Sem fuso (o `to_char` do banco do app, a hora do Questor), o texto já é a
 * hora do relógio e é lido como está: passar pelo `Date` o reinterpretaria no
 * fuso de quem executa.
 */
export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = RE_SEM_FUSO.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}`;
  return dataHoraFmt.format(new Date(iso));
}

export function mesBR(iso: string): string {
  const [y, m] = iso.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`;
}

export function deltaPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function inicioDoMesISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Formata CNPJ (14) / CPF (11); senão devolve como veio. */
export function documento(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/**
 * Porcentagem com vírgula. `v` já em pontos percentuais (12,5 e não 0,125).
 * `toFixed` devolve ponto, e em pt-BR ponto é milhar: "3.4%" vira "3.400%".
 */
export function pct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(v)}%`;
}

/** Número decimal com vírgula e casas fixas no máximo. */
export function decimal(v: number, casas = 1): string {
  return casas === 1 ? pctFmt.format(v) : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(v);
}

/** Horas decimais como "12h 30min"; abaixo de uma hora, só os minutos. */
export function horas(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}min`;
  return mm ? `${num(hh)}h ${mm}min` : `${num(hh)}h`;
}
