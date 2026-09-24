import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./icone";

export type Tom = "neutro" | "ok" | "atencao" | "perigo" | "rota" | "acento";

const LAMPADA: Record<Tom, string> = {
  neutro: "",
  ok: "before:bg-ok",
  atencao: "before:bg-atencao",
  perigo: "before:bg-perigo",
  rota: "before:bg-rota",
  acento: "before:bg-acento-solido",
};

const TINTA: Record<Tom, string> = {
  neutro: "text-tinta",
  ok: "text-ok",
  atencao: "text-atencao",
  perigo: "text-perigo",
  rota: "text-rota",
  acento: "text-acento",
};

/**
 * Faixa de leitura: os números da tela num painel só, divididos por fio, como
 * um painel de instrumentos. Não é uma grade de cartões iguais: cartão por
 * número repete borda, sombra e respiro seis vezes para dizer seis números.
 */
export function FaixaIndicadores({
  children,
  className,
  colunas,
}: {
  children: ReactNode;
  className?: string;
  /** Força o número de colunas no desktop; sem ele, cada célula pede 170px. */
  colunas?: number;
}) {
  return (
    <div
      className={cn(
        "nx-vidro grid overflow-hidden rounded-painel",
        "[&>*]:border-linha [&>*]:border-b [&>*]:border-r",
        className
      )}
      style={{
        gridTemplateColumns: colunas
          ? `repeat(auto-fit, minmax(max(150px, calc(100% / ${colunas} - 1px)), 1fr))`
          : "repeat(auto-fit, minmax(170px, 1fr))",
        // O fio da última coluna e da última linha some por baixo da borda do
        // painel: margem negativa em vez de contar filhos.
        marginRight: 0,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Um número lido. `tom` acende a lâmpada no topo da célula quando o número pede
 * atenção; o valor só ganha a cor do tom quando é o próprio alerta
 * (`valorNoTom`), senão a faixa vira arco-íris.
 */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "neutro",
  valorNoTom,
  carregando,
  href,
  onClick,
  className,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: NomeIcone;
  tom?: Tom;
  valorNoTom?: boolean;
  carregando?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classe = cn(
    "relative -mr-px -mb-px flex min-w-0 flex-col gap-1 px-4 pt-3 pb-3 text-left",
    "before:absolute before:top-0 before:right-4 before:left-4 before:h-[2px] before:rounded-b-full",
    LAMPADA[tom],
    (href || onClick) && "transition-colors hover:bg-poco",
    className
  );
  const corpo = (
    <>
      <span className="flex items-center gap-1.5 truncate text-pequeno text-apagado">
        {icone && <Icone nome={icone} tamanho={14} />}
        <span className="truncate">{rotulo}</span>
      </span>
      {carregando ? (
        <span className="nx-esqueleto my-0.5 h-7 w-24" />
      ) : (
        <span className={cn("nx-leitura truncate text-leitura", valorNoTom ? TINTA[tom] : "text-tinta")}>
          {valor}
        </span>
      )}
      {detalhe != null &&
        (carregando ? (
          <span className="nx-esqueleto h-3.5 w-32" />
        ) : (
          <span className="truncate text-pequeno text-apagado">{detalhe}</span>
        ))}
    </>
  );
  if (href)
    return (
      <Link href={href} className={classe}>
        {corpo}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={classe}>
        {corpo}
      </button>
    );
  return <div className={classe}>{corpo}</div>;
}
