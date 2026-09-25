import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";

/*
 * O prazo do DP dito como a pessoa fala: "venceu há 3 dias", "vence em 5
 * dias". Rescisão a pagar e férias a conceder têm a mesma pergunta (quanto
 * falta para o limite), e um texto por tela faria uma dizer "vencida há 3d" e
 * a outra "faltam 3 dias" para o mesmo fato.
 *
 * O verbo é neutro de propósito: "venceu" serve para a rescisão, para o
 * período aquisitivo e para as férias, sem concordar gênero com cada uma.
 */

/** "1 dia", "12 dias". */
export const emDiasTexto = (n: number) => `${num(n)} ${n === 1 ? "dia" : "dias"}`;

/** O prazo em minúsculas, para ir depois de uma data ou de um ponto. `null` vira travessão. */
export function prazoRelativo(dias: number | null): string {
  if (dias == null) return "—";
  if (dias < 0) return `venceu há ${emDiasTexto(-dias)}`;
  if (dias === 0) return "vence hoje";
  return `vence em ${emDiasTexto(dias)}`;
}

/**
 * O prazo sozinho, com a cor da urgência. Vencido e "vence hoje" são perigo;
 * prazo futuro que já pede atenção é atenção; folgado fica apagado. Usado onde
 * não há selo de situação ao lado para carregar o tom (as listas dos painéis).
 */
export function TextoPrazo({
  dias,
  atencao,
  className,
}: {
  dias: number | null;
  /**
   * O prazo futuro já pede atenção. Quem decide é quem chama: a janela da
   * rescisão é a antecedência configurada, que só o servidor conhece.
   */
  atencao?: boolean;
  className?: string;
}) {
  const texto = prazoRelativo(dias);
  const tom =
    dias == null
      ? "text-apagado"
      : dias <= 0
        ? "font-[600] text-perigo"
        : atencao
          ? "text-atencao"
          : "text-apagado";
  return (
    <span className={cn("num whitespace-nowrap", tom, className)}>
      {texto.charAt(0).toUpperCase() + texto.slice(1)}
    </span>
  );
}

/**
 * A data limite e, apagado ao lado, quanto falta. Mora em tabela que já tem o
 * selo da situação: a cor fica com o selo, e o texto não a repete.
 */
export function DataComPrazo({ data, dias }: { data: string | null; dias: number | null }) {
  if (!data) return <span className="text-apagado">—</span>;
  return (
    <span className="num whitespace-nowrap">
      {dataBR(data)}
      {dias != null && <span className="text-apagado"> · {prazoRelativo(dias)}</span>}
    </span>
  );
}
