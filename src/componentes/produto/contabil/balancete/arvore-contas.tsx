"use client";

import type { ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { normalizar } from "@/componentes/primitivos/combo";
import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import { brl } from "@/lib/format";

/*
 * A árvore do plano de contas, do jeito que os dois balancetes (fiscal e
 * contábil) a desenham. O código reduzido vem primeiro e alinhado, como no
 * balancete impresso do Questor, porque é ele que o analista digita lá (a mesma
 * regra do `ContaTexto`). Depois vem a árvore, que se lê pelo recuo e pelo
 * peso: sintética em negrito, com a seta de recolher; analítica em tinta de apoio.
 */

/** O mínimo de uma linha do plano para desenhar a árvore. */
export interface LinhaPlano {
  conta: number;
  /** Classificação hierárquica ("1.1.01.002"); o nível é o número de segmentos. */
  classif: string;
  nivel: number;
  descricao: string;
  sintetica: boolean;
}

/** Recuo por nível, em px. */
const RECUO = 14;

/** A célula da conta: código, recuo, seta (sintética), classificação e descrição. */
export function CelulaConta({
  linha,
  recuar = true,
  aberta = true,
  onAlternar,
  fim,
}: {
  linha: LinhaPlano;
  /** Sem recuo quando a lista é plana (busca, só diferenças). */
  recuar?: boolean;
  aberta?: boolean;
  /** Com ela, a sintética ganha a seta de recolher e abrir as filhas. */
  onAlternar?: () => void;
  /** Marca na ponta da célula (sinal atípico, por exemplo). */
  fim?: ReactNode;
}) {
  const { classif, nivel, descricao, sintetica, conta } = linha;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* Código reduzido é identificador, não quantidade: sai sem milhar. */}
      <span className="num w-12 shrink-0 text-pequeno font-[600] text-apagado">{String(conta)}</span>
      <span
        className="flex min-w-0 flex-1 items-center gap-1.5"
        style={{ paddingLeft: recuar ? Math.max(0, nivel - 1) * RECUO : 0 }}
      >
        {onAlternar ? (
          <button
            type="button"
            aria-expanded={aberta}
            aria-label={aberta ? `Recolher ${descricao}` : `Abrir ${descricao}`}
            onClick={(e) => {
              // A linha também abre o detalhe no clique: a seta só recolhe.
              e.stopPropagation();
              onAlternar();
            }}
            className="-ml-0.5 grid size-5 shrink-0 place-items-center rounded-chip text-apagado hover:bg-poco-forte hover:text-tinta"
          >
            <Icone nome={aberta ? "chevron-baixo" : "chevron-direita"} tamanho={14} />
          </button>
        ) : recuar ? (
          <span aria-hidden className="w-[18px] shrink-0" />
        ) : null}
        <span className="num shrink-0 text-pequeno text-apagado">{classif}</span>
        <span className={cn("min-w-0 truncate", sintetica ? "font-[600] text-tinta" : "text-tinta-2")}>
          {descricao}
        </span>
      </span>
      {fim && <span className="flex shrink-0 items-center gap-1.5">{fim}</span>}
    </span>
  );
}

/**
 * Valor de balancete. Com `natureza`, o saldo sai sem sinal e com D ou C ao
 * lado, como o Questor imprime: sinal negativo num saldo credor lê-se como
 * erro. Zero vira traço, para a coluna respirar.
 */
export function ValorConta({
  valor,
  natureza,
  forte,
}: {
  valor: number;
  /** Saldo (devedor positivo, credor negativo) em vez de movimento. */
  natureza?: boolean;
  forte?: boolean;
}) {
  if (Math.abs(valor) < 0.005) return <span className="text-apagado/60">—</span>;
  return (
    <span className={cn("num", forte ? "font-[600] text-tinta" : "text-tinta-2")}>
      {brl(natureza ? Math.abs(valor) : valor)}
      {natureza && <span className="ml-1 text-micro font-normal text-apagado">{valor >= 0 ? "D" : "C"}</span>}
    </span>
  );
}

/** Corte da árvore por nível: o balancete do Questor abre no 3. */
export function SeletorNivel({
  nivelMax,
  valor,
  onMudar,
}: {
  nivelMax: number;
  valor: number;
  onMudar: (nivel: number) => void;
}) {
  const opcoes = Array.from({ length: Math.max(1, nivelMax) }, (_, i) => ({
    valor: String(i + 1),
    rotulo: String(i + 1),
  }));
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-pequeno text-apagado">
        <Icone nome="camadas" tamanho={14} />
        Nível
      </span>
      <Segmentado
        rotulo="Nível do plano de contas"
        opcoes={opcoes}
        valor={String(Math.min(valor, Math.max(1, nivelMax)))}
        onMudar={(v) => onMudar(Number(v))}
      />
    </span>
  );
}

/** A classificação é filha de alguma sintética recolhida? */
function ancestralRecolhido(classif: string, recolhidas: ReadonlySet<string>): boolean {
  const seg = classif.split(".");
  for (let k = 1; k < seg.length; k++) {
    if (recolhidas.has(seg.slice(0, k).join("."))) return true;
  }
  return false;
}

/** As linhas que aparecem com o corte de nível e as sintéticas recolhidas. */
export function recortarArvore<T extends LinhaPlano>(
  linhas: T[],
  nivel: number,
  recolhidas: ReadonlySet<string>
): T[] {
  return linhas.filter((l) => l.nivel <= nivel && (!recolhidas.size || !ancestralRecolhido(l.classif, recolhidas)));
}

/**
 * Busca no plano por classificação, código ou descrição, em qualquer nível:
 * quem procura "ICMS" quer achar a analítica do nível 5 mesmo com a árvore
 * cortada no 3.
 */
export function buscarNoPlano<T extends LinhaPlano>(linhas: T[], termo: string): T[] {
  const partes = normalizar(termo.trim()).split(/\s+/).filter(Boolean);
  if (!partes.length) return linhas;
  return linhas.filter((l) => {
    const alvo = normalizar(`${l.classif} ${l.conta} ${l.descricao}`);
    return partes.every((p) => alvo.includes(p));
  });
}

/** Liga e desliga uma classificação na lista de recolhidas. */
export function alternarRecolhida(lista: string[], classif: string): string[] {
  return lista.includes(classif) ? lista.filter((c) => c !== classif) : [...lista, classif];
}
