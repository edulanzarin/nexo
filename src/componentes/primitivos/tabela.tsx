"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { BotaoIcone } from "./botao";
import { Icone } from "./icone";

export interface Coluna<T> {
  id: string;
  cabecalho: ReactNode;
  celula: (linha: T, indice: number) => ReactNode;
  alinhar?: "esq" | "dir" | "centro";
  /** Largura CSS da coluna (`"120px"`, `"30%"`). Sem ela, a coluna reparte a sobra. */
  largura?: string;
  /** Valor de ordenação. Com ele, o cabeçalho vira botão de ordenar. */
  ordenar?: (linha: T) => number | string | null | undefined;
  /** Classe extra da célula (`"font-semibold text-tinta"`). */
  classe?: string;
  /** Rodapé da coluna (total). */
  rodape?: ReactNode;
  /** Some abaixo de 900px: coluna de apoio que não decide nada. */
  secundaria?: boolean;
}

export type Ordem = { coluna: string; sentido: "asc" | "desc" } | null;

const ALINHAMENTO = { esq: "text-left", dir: "text-right", centro: "text-center" } as const;

function comparar(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

/**
 * Contêiner que rola a tabela. As sombras nas bordas avisam que há coluna fora
 * da vista: no celular as últimas colunas são as que decidem (o valor), e rolar
 * sem aviso as esconde. A pista é de fundo `local`, então some sozinha quando
 * chega na ponta.
 */
export function RolagemTabela({
  children,
  alturaMax,
  className,
}: {
  children: ReactNode;
  alturaMax?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative min-w-0 overflow-auto", className)}
      style={{
        maxHeight: alturaMax,
        background:
          "linear-gradient(to right, var(--vidro-forte) 30%, transparent) left / 24px 100% no-repeat local," +
          "linear-gradient(to left, var(--vidro-forte) 30%, transparent) right / 24px 100% no-repeat local," +
          "radial-gradient(farthest-side at 0 50%, var(--linha-forte), transparent) left / 10px 100% no-repeat scroll," +
          "radial-gradient(farthest-side at 100% 50%, var(--linha-forte), transparent) right / 10px 100% no-repeat scroll",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Tabela declarativa: colunas descrevem cabeçalho, célula e ordenação; a
 * tabela cuida do resto (ordenar, linha clicável, vazio, rodapé de total).
 * Linha enxuta: o detalhe mora no modal que o clique abre.
 */
export function TabelaDados<T>({
  colunas,
  linhas,
  chave,
  onLinha,
  selecionada,
  ordemInicial = null,
  ordem: ordemControlada,
  onOrdem,
  vazio,
  alturaMax,
  className,
  rotulo,
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T, indice: number) => string;
  onLinha?: (linha: T) => void;
  selecionada?: (linha: T) => boolean;
  ordemInicial?: Ordem;
  /** Ordem controlada por fora (quando o servidor é quem ordena). */
  ordem?: Ordem;
  onOrdem?: (ordem: Ordem) => void;
  vazio?: ReactNode;
  alturaMax?: string;
  className?: string;
  rotulo?: string;
}) {
  const [ordemInterna, setOrdemInterna] = useState<Ordem>(ordemInicial);
  const ordem = ordemControlada !== undefined ? ordemControlada : ordemInterna;

  const ordenadas = useMemo(() => {
    if (!ordem || onOrdem) return linhas;
    const col = colunas.find((c) => c.id === ordem.coluna);
    if (!col?.ordenar) return linhas;
    const f = col.ordenar;
    const s = ordem.sentido === "asc" ? 1 : -1;
    return [...linhas].sort((a, b) => s * comparar(f(a), f(b)));
  }, [linhas, ordem, colunas, onOrdem]);

  const alternar = (id: string) => {
    const nova: Ordem =
      ordem?.coluna === id
        ? ordem.sentido === "desc"
          ? { coluna: id, sentido: "asc" }
          : null
        : { coluna: id, sentido: "desc" };
    if (onOrdem) onOrdem(nova);
    else setOrdemInterna(nova);
  };

  const temRodape = colunas.some((c) => c.rodape != null);

  return (
    <RolagemTabela alturaMax={alturaMax} className={className}>
      <table className="nx-tabela" aria-label={rotulo}>
        <colgroup>
          {colunas.map((c) => (
            <col key={c.id} style={{ width: c.largura }} className={c.secundaria ? "max-[900px]:hidden" : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {colunas.map((c) => {
              const ativa = ordem?.coluna === c.id;
              return (
                <th
                  key={c.id}
                  aria-sort={ativa ? (ordem!.sentido === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(ALINHAMENTO[c.alinhar ?? "esq"], c.secundaria && "max-[900px]:hidden")}
                >
                  {c.ordenar ? (
                    <button
                      type="button"
                      onClick={() => alternar(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-tinta",
                        c.alinhar === "dir" && "flex-row-reverse",
                        ativa && "text-tinta"
                      )}
                    >
                      {c.cabecalho}
                      <Icone
                        nome={ativa ? (ordem!.sentido === "asc" ? "seta-cima" : "seta-baixo") : "ordenar"}
                        tamanho={14}
                        className={cn("size-3", !ativa && "opacity-40")}
                      />
                    </button>
                  ) : (
                    c.cabecalho
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length} className="!h-auto">
                {vazio ?? <p className="py-8 text-center text-corpo text-apagado italic">Nada para mostrar.</p>}
              </td>
            </tr>
          ) : (
            ordenadas.map((l, i) => (
              <tr
                key={chave(l, i)}
                data-clicavel={onLinha ? "" : undefined}
                aria-selected={selecionada?.(l) || undefined}
                onClick={onLinha ? () => onLinha(l) : undefined}
                tabIndex={onLinha ? 0 : undefined}
                onKeyDown={
                  onLinha
                    ? (e) => {
                        if (e.key === "Enter") onLinha(l);
                      }
                    : undefined
                }
              >
                {colunas.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      ALINHAMENTO[c.alinhar ?? "esq"],
                      c.alinhar === "dir" && "num whitespace-nowrap",
                      c.secundaria && "max-[900px]:hidden",
                      c.classe
                    )}
                  >
                    {c.celula(l, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {temRodape && ordenadas.length > 0 && (
          <tfoot>
            <tr>
              {colunas.map((c) => (
                <td
                  key={c.id}
                  className={cn(
                    ALINHAMENTO[c.alinhar ?? "esq"],
                    c.alinhar === "dir" && "num whitespace-nowrap",
                    c.secundaria && "max-[900px]:hidden"
                  )}
                >
                  {c.rodape}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </RolagemTabela>
  );
}

/** Paginação de lista que o servidor corta. Diz a faixa, não só a página. */
export function Paginacao({
  pagina,
  porPagina,
  total,
  onPagina,
  className,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  onPagina: (p: number) => void;
  className?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  return (
    <div className={cn("flex items-center justify-between gap-3 text-pequeno text-apagado", className)}>
      <span className="num">
        {num(de)}–{num(ate)} de {num(total)}
      </span>
      <div className="flex items-center gap-1">
        <BotaoIcone
          icone="chevron-esquerda"
          rotulo="Página anterior"
          linha
          disabled={pagina <= 1}
          onClick={() => onPagina(pagina - 1)}
        />
        <span className="num min-w-14 text-center">
          {num(pagina)} / {num(paginas)}
        </span>
        <BotaoIcone
          icone="chevron-direita"
          rotulo="Próxima página"
          linha
          disabled={pagina >= paginas}
          onClick={() => onPagina(pagina + 1)}
        />
      </div>
    </div>
  );
}
