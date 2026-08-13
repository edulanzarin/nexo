"use client";

import { useRef } from "react";
import { CalendarRange, Check } from "lucide-react";
import { toast } from "sonner";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { dataBR, hojeISO, inicioDoMesISO } from "@/lib/format";

export interface Preset {
  nome: string;
  inicio: string;
  fim: string;
}

/** Presets padrão (mês/ano). Cada barra pode passar a sua própria lista. */
export function presetsPadrao(): Preset[] {
  const hoje = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mesPassadoIni = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesPassadoFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  return [
    { nome: "Este mês", inicio: inicioDoMesISO(), fim: hojeISO() },
    { nome: "Mês passado", inicio: iso(mesPassadoIni), fim: iso(mesPassadoFim) },
    { nome: "Este ano", inicio: `${hoje.getFullYear()}-01-01`, fim: hojeISO() },
    {
      nome: "Ano anterior",
      inicio: `${hoje.getFullYear() - 1}-01-01`,
      fim: `${hoje.getFullYear() - 1}-12-31`,
    },
  ];
}

/**
 * Seletor de período PADRÃO de todo o app: um Dropdown com presets + um range
 * personalizado (teto de 1 ano). Um primitivo só — Fiscal, Contábil e RH usam o
 * mesmo, mudando só a lista de presets. `onChange(inicio, fim)` comita a escolha.
 */
export function PeriodoDropdown({
  inicio,
  fim,
  onChange,
  presets,
}: {
  inicio: string;
  fim: string;
  onChange: (inicio: string, fim: string) => void;
  presets?: Preset[];
}) {
  const lista = presets ?? presetsPadrao();
  const iniRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLInputElement>(null);
  const presetAtivo = lista.find((p) => p.inicio === inicio && p.fim === fim);

  return (
    <Dropdown
      icone={<CalendarRange className="size-4" />}
      rotulo={presetAtivo ? presetAtivo.nome : `${dataBR(inicio)} – ${dataBR(fim)}`}
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
                  onChange(p.inicio, p.fim);
                  fechar();
                }}
              >
                <span className="grid size-4 place-items-center">
                  {presetAtivo?.nome === p.nome && <Check className="size-4 stroke-[3] text-accent" />}
                </span>
                {p.nome}
              </ItemLista>
            ))}
          </div>
          <div className="border-t border-hairline p-3">
            <p className="mb-2 text-xs text-muted">Período personalizado (máx. 1 ano)</p>
            {/* Campos não-controlados (defaultValue + ref) e commit só no "Definir":
                nada muda enquanto digita, então dá pra escrever o ano de 4 dígitos
                sem sobrescrever. O `key` remonta os campos quando um preset muda as
                datas por fora. */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-8 shrink-0">De</span>
                <input
                  key={`ini-${inicio}`}
                  ref={iniRef}
                  type="date"
                  defaultValue={inicio}
                  className="h-8 w-full rounded-md border border-hairline bg-surface-2 px-2 text-xs text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span className="w-8 shrink-0">Até</span>
                <input
                  key={`fim-${fim}`}
                  ref={fimRef}
                  type="date"
                  defaultValue={fim}
                  className="h-8 w-full rounded-md border border-hairline bg-surface-2 px-2 text-xs text-ink"
                />
              </label>
              <button
                onClick={() => {
                  const v1 = iniRef.current?.value;
                  const v2 = fimRef.current?.value;
                  if (!v1 || !v2 || v1 < "2000-01-01" || v2 < "2000-01-01") return;
                  const [ini, fimOrig] = v1 <= v2 ? [v1, v2] : [v2, v1];
                  let fimF = fimOrig;
                  // Teto de 1 ano: se passar, limita o fim e avisa.
                  const MAX = 365 * 86_400_000;
                  if (Date.parse(fimF) - Date.parse(ini) > MAX) {
                    const d = new Date(ini + "T00:00:00Z");
                    d.setUTCDate(d.getUTCDate() + 365);
                    fimF = d.toISOString().slice(0, 10);
                    toast.info("Período limitado a 1 ano");
                  }
                  onChange(ini, fimF);
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
