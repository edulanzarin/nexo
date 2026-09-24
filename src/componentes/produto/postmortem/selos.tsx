import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import { CRITICIDADE_ROTULO, type Criticidade, type StatusPM } from "@/lib/postmortem-tipos";

/*
 * Os selos do Post Mortem. Rampa verde, âmbar, vermelho com os tons de estado
 * do tema: o rótulo é a autoridade e a cor só reforça. A criticidade e a nota
 * de gravidade usam a mesma rampa, para o olho ler as duas escalas juntas sem
 * reaprender a cor.
 */

const TOM_CRITICIDADE: Record<Criticidade, Tom> = {
  baixa: "ok",
  media: "atencao",
  alta: "perigo",
  critica: "perigo",
};

/** Número do relatório como o setor fala dele: 0042. Só enviado tem número. */
export function numeroPM(numero: number | null): string {
  return numero == null ? "" : String(numero).padStart(4, "0");
}

/**
 * Rótulo da nota de gravidade. Só as pontas têm nome porque só elas foram
 * combinadas com o Societário. O rótulo da lib usa travessão; na tela, o ponto
 * médio separa sem parecer oração emendada.
 */
export function rotuloGravidade(n: number): string {
  if (n === 1) return "1 · Baixo";
  if (n === 5) return "5 · Gravíssimo";
  return String(n);
}

export function tomGravidade(n: number): Tom {
  return n >= 4 ? "perigo" : n === 3 ? "atencao" : "ok";
}

function SemValor() {
  return <span className="text-apagado">—</span>;
}

/** Crítica ganha o ícone de alerta para saltar da alta, que tem a mesma cor. */
export function SeloCriticidade({ nivel }: { nivel: Criticidade | null }) {
  if (!nivel) return <SemValor />;
  return (
    <Selo tom={TOM_CRITICIDADE[nivel]} icone={nivel === "critica" ? "alerta" : undefined}>
      {CRITICIDADE_ROTULO[nivel]}
    </Selo>
  );
}

/** Nota 1 a 5 do setor que a usa (Societário). O 5 ganha o alerta, como a crítica. */
export function SeloGravidade({ nota }: { nota: number | null }) {
  if (nota == null) return <SemValor />;
  return (
    <Selo tom={tomGravidade(nota)} icone={nota === 5 ? "alerta" : undefined}>
      {rotuloGravidade(nota)}
    </Selo>
  );
}

export function SeloSituacaoPM({ status }: { status: StatusPM }) {
  return status === "enviado" ? (
    <Selo tom="rota" icone="certo">
      Enviado
    </Selo>
  ) : (
    <Selo tom="neutro" icone="editar">
      Rascunho
    </Selo>
  );
}
