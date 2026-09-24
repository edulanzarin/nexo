import { Selo } from "@/componentes/primitivos/selo";
import type { Tom } from "@/componentes/primitivos/indicador";
import { cn } from "@/lib/cn";
import { mesBR } from "@/lib/format";
import type { SituacaoFechamento } from "@/lib/contabil-fechamento-tipos";

/**
 * A escada de situação do FECHAMENTO CONTÁBIL, e a fita que a mostra mês a mês.
 *
 * "Sem movimento" é neutro de propósito: empresa que não escriturou nada no mês
 * não deixou trabalho por fazer, e pintá-la junto das que ninguém apurou
 * encheria o relatório de faltas falsas. "Fora do Questor" é cadastro a
 * acertar, não mês atrasado, e por isso é azul de informação.
 */
export const SITUACOES_FECHAMENTO: Record<SituacaoFechamento, { rotulo: string; tom: Tom; fundo: string }> = {
  fechada: { rotulo: "Fechada", tom: "ok", fundo: "bg-ok" },
  aberta: { rotulo: "Em aberto", tom: "atencao", fundo: "bg-atencao" },
  "sem-movimento": { rotulo: "Sem movimento", tom: "neutro", fundo: "bg-poco-forte" },
  "sem-par": { rotulo: "Fora do Questor", tom: "rota", fundo: "bg-rota-suave" },
};

const ORDEM = Object.keys(SITUACOES_FECHAMENTO) as SituacaoFechamento[];

export function SeloFechamento({ situacao }: { situacao: SituacaoFechamento }) {
  const s = SITUACOES_FECHAMENTO[situacao];
  return <Selo tom={s.tom}>{s.rotulo}</Selo>;
}

/**
 * Uma coluna por competência, na ordem do período: a barra colorida diz a
 * situação e o MÊS vai escrito embaixo. Cor sozinha mostra o padrão (três
 * fechados, dois abertos) mas obriga a contar quadrados para nomear o mês, e a
 * pergunta de quem usa é "quais meses estão fechados".
 *
 * O ano entra no rótulo só quando o período atravessa a virada; dentro de um
 * ano ele é ruído. A competência de referência ganha contorno.
 */
export function FitaCompetencias({
  meses,
  situacoes,
  referencia,
  className,
}: {
  meses: string[];
  situacoes: SituacaoFechamento[];
  referencia?: string;
  className?: string;
}) {
  const variosAnos = new Set(meses.map((m) => m.slice(0, 4))).size > 1;
  return (
    <div className={cn("flex items-end gap-1", className)}>
      {meses.map((mes, i) => {
        const s = SITUACOES_FECHAMENTO[situacoes[i] ?? "sem-movimento"];
        const ref = mes === referencia;
        const texto = `${mesBR(mes)}: ${s.rotulo}`;
        return (
          <span key={mes} title={texto} aria-label={texto} className="flex min-w-6 flex-col items-center gap-0.5">
            <span
              className={cn(
                "h-3.5 w-full rounded-[3px] border",
                s.fundo,
                ref ? "border-tinta-2" : "border-linha"
              )}
            />
            <span className={cn("num text-micro leading-none", ref ? "font-[600] text-tinta" : "text-apagado")}>
              {variosAnos ? mesBR(mes) : mesBR(mes).slice(0, 3)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Legenda da fita. Fita sem legenda é código de cor que só o autor decifra. */
export function LegendaFechamento({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1", className)}>
      {ORDEM.map((k) => (
        <li key={k} className="flex items-center gap-1.5 text-pequeno text-tinta-2">
          <span aria-hidden className={cn("h-3 w-2.5 rounded-[3px] border border-linha", SITUACOES_FECHAMENTO[k].fundo)} />
          {SITUACOES_FECHAMENTO[k].rotulo}
        </li>
      ))}
    </ul>
  );
}
