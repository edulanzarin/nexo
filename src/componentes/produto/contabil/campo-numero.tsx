"use client";

import { useState } from "react";
import { Campo } from "@/componentes/primitivos/campo";
import { cn } from "@/lib/cn";

/**
 * Casas fixas no campo, sem símbolo de moeda. O `lib/format` formata para LER
 * (brl leva "R$", decimal corta zeros); um campo que se edita precisa mostrar
 * "1.200,50" como a pessoa digitaria.
 */
function formatar(v: number, casas: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

/**
 * Lê o número como se digita no Brasil: "1.234,56", "1234,56", "1234.56" ou
 * "1.234". Ponto sozinho seguido de três dígitos é milhar; com vírgula, o ponto
 * é sempre milhar. Devolve null quando não dá para ler.
 */
export function numeroDigitado(texto: string): number | null {
  const t = texto.replace(/\s|R\$|%/g, "");
  if (!t) return null;
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  const v = Number(normal);
  return Number.isFinite(v) ? v : null;
}

/**
 * Número editável em formato brasileiro. Enquanto o campo tem foco o texto é
 * livre; ao sair (ou no Enter) vira número. Texto que não se lê volta ao valor
 * anterior em vez de virar zero: zerar um valor por um erro de digitação é o
 * tipo de engano que só aparece depois de importar.
 */
export function CampoNumero({
  valor,
  onMudar,
  casas = 2,
  rotulo,
  id,
  className,
}: {
  valor: number;
  onMudar: (v: number) => void;
  casas?: number;
  /** Nome acessível quando não há `Rotulado` em volta. */
  rotulo?: string;
  id?: string;
  className?: string;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const exibido = rascunho ?? formatar(valor, casas);
  const fator = 10 ** casas;
  return (
    <Campo
      id={id}
      inputMode="decimal"
      aria-label={rotulo}
      value={exibido}
      onFocus={(e) => {
        setRascunho(exibido);
        e.currentTarget.select();
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        const v = rascunho == null ? null : numeroDigitado(rascunho);
        if (v != null && Math.abs(v - valor) > 1 / (fator * 10)) onMudar(Math.round(v * fator) / fator);
        setRascunho(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn("text-right", className)}
    />
  );
}
