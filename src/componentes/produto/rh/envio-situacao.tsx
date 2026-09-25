import { BarraProporcao } from "@/componentes/primitivos/barra";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";
import type { EnvioResumo } from "@/lib/envios";

/*
 * Como está um envio e cada pessoa dele. As datas saem só com o dia: o banco
 * devolve o horário sem fuso (`to_char`), e mostrar a hora arriscaria três
 * horas de erro conforme o fuso do servidor do banco.
 */

/** Quando o envio saiu, ou para quando está agendado. */
export function QuandoEnvio({ envio, className }: { envio: Pick<EnvioResumo, "disparadoEm" | "agendadoPara">; className?: string }) {
  if (envio.disparadoEm) return <span className={cn("num", className)}>{dataBR(envio.disparadoEm)}</span>;
  if (envio.agendadoPara)
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
        <Selo tom="atencao" icone="relogio">
          Agendado
        </Selo>
        <span className="num">{dataBR(envio.agendadoPara)}</span>
      </span>
    );
  return <span className={cn("text-apagado", className)}>Não saiu</span>;
}

/** Quantos responderam de quantos receberam. A barra fica verde quando todos responderam. */
export function RespostasEnvio({
  respondidos,
  total,
  className,
}: {
  respondidos: number;
  total: number;
  className?: string;
}) {
  const completo = total > 0 && respondidos >= total;
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <BarraProporcao
        valor={total ? respondidos / total : 0}
        tom={completo ? "ok" : "rota"}
        className="w-14"
        rotulo={`${num(respondidos)} de ${num(total)} responderam`}
      />
      <span className="num">
        {num(respondidos)} <span className="text-apagado">de {num(total)}</span>
      </span>
    </span>
  );
}

/**
 * A situação de uma pessoa no envio. `pendente` quer dizer que o e-mail ainda
 * não saiu: num envio agendado é o esperado, num que já saiu é falha de envio.
 */
export function situacaoDestinatario(status: string, envioSaiu: boolean): { rotulo: string; tom: Tom } {
  if (status === "respondido") return { rotulo: "Respondeu", tom: "ok" };
  if (status === "erro") return { rotulo: "E-mail falhou", tom: "perigo" };
  if (status === "pendente") return envioSaiu ? { rotulo: "Não saiu", tom: "atencao" } : { rotulo: "Agendado", tom: "neutro" };
  return { rotulo: "Aguardando", tom: "neutro" };
}

export function SeloDestinatarioEnvio({
  status,
  envioSaiu = true,
  className,
}: {
  status: string;
  envioSaiu?: boolean;
  className?: string;
}) {
  const s = situacaoDestinatario(status, envioSaiu);
  return (
    <Selo tom={s.tom} className={className}>
      {s.rotulo}
    </Selo>
  );
}
