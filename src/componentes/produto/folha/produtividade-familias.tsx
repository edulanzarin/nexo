import { cn } from "@/lib/cn";
import {
  DP_FAMILIAS,
  tiposDaFamilia,
  type DpFamilia,
  type DpPorTipo,
  type DpTipoInfo,
} from "@/lib/dp-tipos";
import type { ClasseInfo } from "@/lib/prod-tipos";

/*
 * A identidade das famílias de trabalho da Produtividade do DP, usada nas seis
 * abas: a Visão Geral compõe por família e cada aba de família pinta o trabalho
 * escolhido com a cor dela.
 */

/**
 * Cor por FAMÍLIA, e o trabalho herda a da família dele. São doze trabalhos e
 * a paleta categórica tem seis cores: pintar cada trabalho repetiria cor, e
 * duas barras da mesma cor num empilhado parecem a mesma coisa.
 *
 * As cores seguem as do nexo2, com uma troca: lá o eSocial era `--esp-1`, e no
 * NaveX `--esp-1` e `--ent` são o mesmo token (`--serie-1`). Movimentação e
 * eSocial sairiam do mesmo azul, então o eSocial foi para `--esp-4`.
 */
export const COR_FAMILIA: Record<DpFamilia, string> = {
  movimentacao: "var(--ent)",
  ferias: "var(--sai)",
  folha: "var(--esp-2)",
  cadastro: "var(--esp-5)",
  esocial: "var(--esp-4)",
};

const ROTULO_FAMILIA = new Map(DP_FAMILIAS.map((f) => [f.id, f.rotulo]));

export const rotuloFamilia = (f: DpFamilia): string => ROTULO_FAMILIA.get(f) ?? f;

/** As famílias no formato que a `ComposicaoClasses` e a `Legenda` leem. */
export const CLASSES_FAMILIA: ClasseInfo[] = DP_FAMILIAS.map((f) => ({
  id: f.id,
  rotulo: f.rotulo,
  descricao: f.descricao,
  cor: COR_FAMILIA[f.id],
}));

/** Soma os trabalhos de uma família numa contagem por tipo. */
export const somaFamilia = (por: DpPorTipo | undefined, f: DpFamilia): number =>
  tiposDaFamilia(f).reduce((a, t) => a + (por?.[t.id] ?? 0), 0);

/** A contagem por tipo dobrada em contagem por família. */
export function porFamilia(por: DpPorTipo | undefined): Record<DpFamilia, number> {
  return Object.fromEntries(DP_FAMILIAS.map((f) => [f.id, somaFamilia(por, f.id)])) as Record<DpFamilia, number>;
}

/**
 * Plural da unidade do catálogo ("rescisão", "fechamento"). As doze unidades
 * seguem duas regras: "ão" vira "ões", o resto ganha "s".
 */
export function unidades(t: DpTipoInfo, n = 2): string {
  if (n === 1) return t.unidade;
  return t.unidade.endsWith("ão") ? `${t.unidade.slice(0, -2)}ões` : `${t.unidade}s`;
}

/**
 * O que um gesto é, em palavras. O catálogo guarda as colunas que o
 * identificam; a tela precisa dizer o que elas significam. Gesto novo sem
 * tradução aqui cai no genérico em vez de mostrar nome de coluna.
 */
const GESTO_DESCRITO: Record<string, string> = {
  "codigoempresa, codigopercalculo": "uma empresa num período de cálculo",
  "codigoempresa, compet": "uma empresa numa competência",
  "codigoempresa, evento, datahoralcto::date": "uma empresa, um evento e um dia",
};

export const gestoDescrito = (t: DpTipoInfo): string | null =>
  t.gesto ? (GESTO_DESCRITO[t.gesto] ?? "uma empresa por vez") : null;

/**
 * O que a quebra e a série contam num trabalho feito em lote. A consulta de
 * quebra conta linha, não gesto: com contrato, cada linha é um funcionário; o
 * eSocial transmitido não tem contrato, e a linha é um envio.
 */
export const rotuloLinhas = (t: DpTipoInfo): string => (t.porContrato ? "Linhas de funcionário" : "Envios");

/** A marca de cor da família ao lado do nome, no mesmo quadrado da legenda dos gráficos. */
export function PontoFamilia({ familia, className }: { familia: DpFamilia; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-[3px] align-middle", className)}
      style={{ background: COR_FAMILIA[familia] }}
    />
  );
}
