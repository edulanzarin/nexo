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
 * Um quadrado por competência, na ordem do período.
 *
 * Com doze meses na linha, um selo por competência vira parede de texto e a
 * tabela deixa de ser lida. A fita mostra a SEQUÊNCIA — três meses fechados
 * seguidos de dois abertos é um padrão que se vê de longe. Cor sozinha não é
 * estado: mês e situação vão por escrito no rótulo acessível de cada quadrado.
 */
export function FitaCompetencias({
  meses,
  situacoes,
}: {
  meses: string[];
  situacoes: SituacaoFechamento[];
}) {
  return (
    <div className="flex items-center gap-0.5">
      {meses.map((mes, i) => {
        const cfg = ESCADA[situacoes[i] ?? "sem-movimento"];
        const texto = `${mesBR(mes)}: ${cfg.rotulo}`;
        return (
          <span
            key={mes}
            title={texto}
            aria-label={texto}
            className={`h-4 w-3 rounded-[2px] border border-hairline ${cfg.cor}`}
          />
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
