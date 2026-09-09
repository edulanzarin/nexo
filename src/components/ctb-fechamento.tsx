import clsx from "clsx";
import { Badge, type BadgeTone } from "@/components/ui";
import { mesBR } from "@/lib/format";
import type { SituacaoFechamento } from "@/lib/contabil-fechamento-tipos";

/**
 * A escada de situação do FECHAMENTO CONTÁBIL, e a fita que a mostra mês a mês.
 *
 * "Sem movimento" é NEUTRO de propósito: empresa que não escriturou nada no mês
 * não deixou trabalho por fazer, e pintá-la junto das que ninguém apurou
 * encheria o relatório de faltas falsas. "Fora do Questor" é cadastro a acertar,
 * não mês atrasado.
 */
const ESCADA: Record<SituacaoFechamento, { rotulo: string; tone: BadgeTone; cor: string }> = {
  fechada: { rotulo: "Fechada", tone: "good", cor: "bg-good" },
  aberta: { rotulo: "Em aberto", tone: "warning", cor: "bg-warning" },
  "sem-movimento": { rotulo: "Sem movimento", tone: "neutral", cor: "bg-surface-2" },
  "sem-par": { rotulo: "Fora do Questor", tone: "accent", cor: "bg-accent/40" },
};

export const SITUACOES_FECHAMENTO = Object.keys(ESCADA) as SituacaoFechamento[];

export function SeloFechamento({ situacao }: { situacao: SituacaoFechamento }) {
  const cfg = ESCADA[situacao];
  return <Badge tone={cfg.tone}>{cfg.rotulo}</Badge>;
}

/**
 * Uma coluna por competência, na ordem do período: a barra colorida diz a
 * situação, e o MÊS vai escrito embaixo.
 *
 * Nasceu como fita de quadrados sem rótulo, e a primeira pessoa a usar a tela
 * pediu exatamente o que faltava — "queria saber quais meses estão fechados".
 * Cor sozinha não responde "quais": ela mostra o padrão (três fechados, dois
 * abertos) e obriga a contar quadrados a partir da ponta para nomear o mês.
 * Escrever o mês custa 10 px de altura e devolve a pergunta respondida.
 *
 * O ano entra no rótulo só quando o período atravessa a virada — dentro de um
 * ano ele é ruído, e "jan" contra "jan/26" é a diferença entre ler e decifrar.
 */
export function FitaCompetencias({
  meses,
  situacoes,
  /** Competência de referência (a última do período); ganha marca de foco. */
  referencia,
}: {
  meses: string[];
  situacoes: SituacaoFechamento[];
  referencia?: string;
}) {
  const variosAnos = new Set(meses.map((m) => m.slice(0, 4))).size > 1;

  return (
    <div className="flex items-end gap-1">
      {meses.map((mes, i) => {
        const cfg = ESCADA[situacoes[i] ?? "sem-movimento"];
        const texto = `${mesBR(mes)}: ${cfg.rotulo}`;
        const rotulo = variosAnos ? mesBR(mes) : mesBR(mes).slice(0, 3);
        const ehRef = mes === referencia;
        return (
          <span
            key={mes}
            title={texto}
            aria-label={texto}
            className="flex flex-col items-center gap-0.5"
          >
            <span
              className={clsx(
                "h-4 w-full min-w-4 rounded-[2px] border",
                cfg.cor,
                ehRef ? "border-ink-2" : "border-hairline"
              )}
            />
            <span
              className={clsx(
                "tnum text-[10px] leading-none",
                ehRef ? "font-medium text-ink" : "text-muted"
              )}
            >
              {rotulo}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Legenda da fita. Fita sem legenda é código de cor que só o autor decifra. */
export function LegendaFechamento() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {SITUACOES_FECHAMENTO.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-3 w-2.5 rounded-[2px] border border-hairline ${ESCADA[s].cor}`} />
          {ESCADA[s].rotulo}
        </span>
      ))}
    </div>
  );
}
