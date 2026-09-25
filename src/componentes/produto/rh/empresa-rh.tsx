"use client";

import { Segmentado } from "@/componentes/primitivos/abas";
import { Selo } from "@/componentes/primitivos/selo";
import { num } from "@/lib/format";
import { EMPRESAS_RH, ehEmpresaRh, nomeEmpresaRh, type EmpresaRh } from "@/lib/rh";

/** "todas" ou o código de uma empresa do RH, em texto (o Segmentado trabalha com string). */
export type FiltroEmpresaRh = "todas" | `${EmpresaRh}`;

/** Códigos que o filtro pede: todas as do RH, ou só a escolhida. */
export function empresasDoFiltroRh(f: FiltroEmpresaRh): number[] {
  const cod = Number(f);
  return f !== "todas" && ehEmpresaRh(cod) ? [cod] : [...EMPRESAS_RH];
}

/** Nome do recorte, para cabeçalho de impressão e nome de arquivo. */
export function rotuloFiltroRh(f: FiltroEmpresaRh): string {
  return f === "todas" ? EMPRESAS_RH.map(nomeEmpresaRh).join(", ") : nomeEmpresaRh(Number(f));
}

/**
 * A empresa do RH dentro da tela. O RH só lê as empresas da própria Navecon, e
 * o seletor do topo lista as da carteira da sessão (onde a Navecon costuma nem
 * estar), por isso a escolha mora aqui e não no contexto. "Todas" é o padrão:
 * as três são a mesma Navecon com CNPJs diferentes.
 *
 * `contagens` põe ao lado de cada nome quantas pessoas a tela tem nela.
 */
export function SeletorEmpresaRh({
  valor,
  onMudar,
  contagens,
  className,
}: {
  valor: FiltroEmpresaRh;
  onMudar: (v: FiltroEmpresaRh) => void;
  contagens?: Partial<Record<number, number>>;
  className?: string;
}) {
  const total = contagens ? EMPRESAS_RH.reduce((s, c) => s + (contagens[c] ?? 0), 0) : null;
  const comConta = (rotulo: string, n: number | null | undefined) =>
    n == null ? (
      rotulo
    ) : (
      <>
        {rotulo}
        <span className="num text-apagado">{num(n)}</span>
      </>
    );
  return (
    <Segmentado<FiltroEmpresaRh>
      rotulo="Empresa"
      className={className}
      valor={valor}
      onMudar={onMudar}
      opcoes={[
        { valor: "todas", rotulo: comConta("Todas", total) },
        ...EMPRESAS_RH.map((c) => ({
          valor: String(c) as FiltroEmpresaRh,
          rotulo: comConta(nomeEmpresaRh(c), contagens ? (contagens[c] ?? 0) : null),
        })),
      ]}
    />
  );
}

/**
 * De qual das empresas da Navecon é a pessoa. Sem cor: as três são a mesma
 * casa, e cor de selo no NaveX quer dizer situação.
 */
export function SeloEmpresaRh({ codigo, className }: { codigo: number; className?: string }) {
  return (
    <Selo className={className} title="Empresa do contrato">
      {nomeEmpresaRh(codigo)}
    </Selo>
  );
}
