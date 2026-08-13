"use client";

import { useEffect, useRef } from "react";
import { CalendarRange, Check } from "lucide-react";
import { toast } from "sonner";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { mesBR } from "@/lib/format";

export interface PresetMes {
  nome: string;
  /** Mês inicial "YYYY-MM". */
  mesIni: string;
  /** Mês final "YYYY-MM" (inclusive). */
  mesFim: string;
}

/** Último dia do mês "YYYY-MM" como ISO "YYYY-MM-DD". */
function fimDoMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${ym}-${String(ultimo).padStart(2, "0")}`;
}

/** Nº de meses entre dois "YYYY-MM" (inclusive). */
function qtdMeses(mesIni: string, mesFim: string): number {
  const [ai, mi] = mesIni.split("-").map(Number);
  const [af, mf] = mesFim.split("-").map(Number);
  return (af - ai) * 12 + (mf - mi) + 1;
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Último mês fechado "YYYY-MM" — o mês anterior ao corrente. É o teto do
 * balancete: o mês em curso está incompleto e não entra na análise.
 */
export function ultimoMesFechadoYM(): string {
  const h = new Date();
  return ym(new Date(h.getFullYear(), h.getMonth() - 1, 1));
}

/**
 * Presets mensais para análise de balancete (todos ≤ 12 meses).
 *
 * Ancorados no ÚLTIMO MÊS FECHADO (o mês anterior ao atual): balancete não se
 * analisa com mês pela metade — o mês corrente incompleto pareceria uma queda.
 * Por isso o mês corrente nem é escolhível, nem por preset nem no "De/Até".
 */
export function presetsMensais(): PresetMes[] {
  const hoje = new Date();
  // 1º dia do mês passado = último mês fechado.
  const fechado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesFimF = ym(fechado);
  const antes = (n: number) =>
    ym(new Date(fechado.getFullYear(), fechado.getMonth() - n, 1));

  const lista: PresetMes[] = [
    { nome: "Mês anterior", mesIni: mesFimF, mesFim: mesFimF },
    { nome: "Últimos 3 meses", mesIni: antes(2), mesFim: mesFimF },
  ];
  // "Este ano" só faz sentido se já houver algum mês fechado no ano corrente
  // (ou seja, de fevereiro em diante). Vai de janeiro até o último mês fechado.
  if (hoje.getMonth() > 0) {
    lista.push({ nome: "Este ano (até mês fechado)", mesIni: `${hoje.getFullYear()}-01`, mesFim: mesFimF });
  }
  lista.push({
    nome: "Ano anterior",
    mesIni: `${hoje.getFullYear() - 1}-01`,
    mesFim: `${hoje.getFullYear() - 1}-12`,
  });
  return lista;
}

/**
 * Seletor de período MENSAL — mesmo estilo do `PeriodoDropdown`, mas a escolha é
 * por mês (o balancete é mensal). Internamente continua entregando `inicio`/`fim`
 * como datas ISO (1º dia do mês inicial → último dia do mês final), para não
 * mexer no resto do funil de filtros. Teto de 12 meses.
 */
export function PeriodoMensalDropdown({
  inicio,
  fim,
  onChange,
}: {
  inicio: string;
  fim: string;
  onChange: (inicio: string, fim: string) => void;
}) {
  const lista = presetsMensais();
  const mesMax = ultimoMesFechadoYM();
  const iniRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLInputElement>(null);

  const mesIniAtual = inicio.slice(0, 7);
  const mesFimAtual = fim.slice(0, 7);
  const presetAtivo = lista.find(
    (p) => p.mesIni === mesIniAtual && fimDoMes(p.mesFim) === fim
  );

  const aplicarMeses = (mesIni: string, mesFim: string) => {
    onChange(`${mesIni}-01`, fimDoMes(mesFim));
  };

  // O balancete não inclui o mês corrente (incompleto). O default global do app
  // é o mês em curso; aqui ele é recuado para o último mês fechado. Quando o fim
  // recua até antes do início (caso do default: mês corrente vira mês anterior),
  // o recorte colapsa no mês anterior. Autocorretivo: pára quando fim ≤ teto.
  useEffect(() => {
    if (mesFimAtual > mesMax) {
      aplicarMeses(mesIniAtual > mesMax ? mesMax : mesIniAtual, mesMax);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFimAtual, mesIniAtual, mesMax]);

  return (
    <Dropdown
      icone={<CalendarRange className="size-4" />}
      rotulo={
        presetAtivo
          ? presetAtivo.nome
          : mesIniAtual === mesFimAtual
            ? mesBR(inicio)
            : `${mesBR(inicio)} – ${mesBR(fim)}`
      }
      ativo
      largura="w-64"
    >
      {(fechar) => (
        <div>
          <div className="py-1">
            {lista.map((p) => (
              <ItemLista
                key={p.nome}
                selecionado={presetAtivo?.nome === p.nome}
                onClick={() => {
                  aplicarMeses(p.mesIni, p.mesFim);
                  fechar();
                }}
              >
                <span className="grid size-4 place-items-center">
                  {presetAtivo?.nome === p.nome && (
                    <Check className="size-4 stroke-[3] text-accent" />
                  )}
                </span>
                {p.nome}
              </ItemLista>
            ))}
          </div>
          <div className="border-t border-hairline p-3">
            <p className="mb-2 text-xs text-muted">Intervalo de meses (máx. 12)</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-8 shrink-0">De</span>
                <input
                  key={`ini-${mesIniAtual}`}
                  ref={iniRef}
                  type="month"
                  max={mesMax}
                  defaultValue={mesIniAtual}
                  className="h-8 w-full rounded-md border border-hairline bg-surface-2 px-2 text-xs text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-8 shrink-0">Até</span>
                <input
                  key={`fim-${mesFimAtual}`}
                  ref={fimRef}
                  type="month"
                  max={mesMax}
                  defaultValue={mesFimAtual}
                  className="h-8 w-full rounded-md border border-hairline bg-surface-2 px-2 text-xs text-ink"
                />
              </label>
              <button
                onClick={() => {
                  const v1 = iniRef.current?.value;
                  const v2 = fimRef.current?.value;
                  if (!v1 || !v2 || v1 < "2000-01" || v2 < "2000-01") return;
                  let mi = v1 <= v2 ? v1 : v2;
                  let mf = v1 <= v2 ? v2 : v1;
                  // Mês corrente (incompleto) não entra no balancete: recua ao
                  // último mês fechado.
                  if (mf > mesMax) {
                    mf = mesMax;
                    if (mi > mesMax) mi = mesMax;
                    toast.info("Mês corrente ainda aberto — recortado até o último mês fechado");
                  }
                  // Teto de 12 meses: recua o fim para não passar do limite.
                  if (qtdMeses(mi, mf) > 12) {
                    const [y, m] = mi.split("-").map(Number);
                    const d = new Date(y, m - 1 + 11, 1);
                    mf = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    toast.info("Período limitado a 12 meses");
                  }
                  aplicarMeses(mi, mf);
                  fechar();
                }}
                className="h-8 w-full rounded-md bg-accent text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Definir período
              </button>
            </div>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
