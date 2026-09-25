import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import { dataBR, num } from "@/lib/format";
import { STATUS_DESEMPENHO_ROTULO, type StatusDesempenho } from "@/lib/rh-desempenho";
import type { DesempenhoItem } from "@/lib/rh-tipos";

/*
 * A situação de uma avaliação de desempenho. "Respondido" vale desde a primeira
 * resposta: o link é um só para os gestores do setor e cada um responde a sua,
 * então quantos já responderam é outra coluna. Encerrada é à parte da situação:
 * a avaliação respondida ou não pode estar com o link fechado.
 */
export const TOM_DESEMPENHO: Record<StatusDesempenho, Tom> = {
  pendente: "neutro",
  enviado: "rota",
  respondido: "ok",
  erro: "perigo",
};

export function SeloDesempenho({ status, className }: { status: StatusDesempenho; className?: string }) {
  return (
    <Selo tom={TOM_DESEMPENHO[status]} className={className}>
      {STATUS_DESEMPENHO_ROTULO[status]}
    </Selo>
  );
}

export function SeloEncerrada({ em, className }: { em?: string | null; className?: string }) {
  return (
    <Selo icone="bloqueado" className={className} title={em ? `Encerrada em ${dataBR(em)}` : undefined}>
      Encerrada
    </Selo>
  );
}

/**
 * Dá para cobrar os gestores agora? A mesma regra da lib (`enviarLembrete`):
 * saiu, segue aberta e ninguém respondeu. Com uma resposta já não dá, porque o
 * link é do setor inteiro e não se sabe qual gestor faltou.
 */
export function cobravel(i: Pick<DesempenhoItem, "status" | "encerradoEm" | "respostas">): boolean {
  return i.status === "enviado" && !i.encerradoEm && i.respostas === 0;
}

/** "1 de 3": respostas sobre os gestores do setor hoje. */
export function textoRespostas(i: Pick<DesempenhoItem, "respostas" | "gestores">): string {
  return `${num(i.respostas)} de ${num(i.gestores)}`;
}

/** As cobranças já feitas, com a data da última. */
export function textoCobrancas(i: Pick<DesempenhoItem, "lembretes" | "ultimoLembrete">): string {
  if (i.lembretes === 0) return "Nenhuma";
  const quando = i.ultimoLembrete ? dataBR(i.ultimoLembrete) : null;
  if (i.lembretes === 1) return quando ? `1, em ${quando}` : "1";
  return quando ? `${num(i.lembretes)}, a última em ${quando}` : num(i.lembretes);
}
