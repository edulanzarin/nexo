import { cn } from "@/lib/cn";
import type { MensagemDenuncia } from "@/lib/denuncia-tipos";
import { dataHoraBR } from "@/lib/format";

/**
 * O relato e a conversa de uma denúncia. Uma peça só serve o RH e quem
 * denunciou, trocando só quem é "você": do lado do RH, a mensagem de quem
 * denunciou leva esse nome e a do RH leva quem respondeu; do lado de quem
 * denunciou, a dele é "Você". A própria mensagem vai à direita, como em todo
 * aplicativo de conversa, para cada lado ler a sua.
 *
 * O relato fica fora da conversa porque é o que o RH lê primeiro, e a conversa
 * é o que veio depois dele.
 *
 * Só no cliente: a hora é a do fuso de quem lê (`dataHoraBR`).
 */
export function ConversaDenuncia({
  relato,
  mensagens,
  lado,
  className,
}: {
  relato: string;
  mensagens: MensagemDenuncia[];
  /** Quem está lendo: muda quem é "você" e o texto de conversa vazia. */
  lado: "rh" | "denunciante";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <section className="flex flex-col gap-1.5">
        <h3 className="text-pequeno font-[560] text-tinta-2">{lado === "rh" ? "Relato" : "Seu relato"}</h3>
        <p className="rounded-painel border border-linha bg-poco px-3.5 py-3 text-corpo whitespace-pre-wrap text-tinta [overflow-wrap:anywhere]">
          {relato}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-pequeno font-[560] text-tinta-2">Conversa</h3>
        {mensagens.length === 0 ? (
          <p className="text-corpo text-apagado italic">
            {lado === "rh" ? "Ninguém do RH respondeu ainda." : "O RH ainda não respondeu."}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {mensagens.map((m, i) => (
              <Balao key={i} mensagem={m} lado={lado} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function autorDe(m: MensagemDenuncia, lado: "rh" | "denunciante"): string {
  if (m.autor === "denunciante") return lado === "rh" ? "Quem denunciou" : "Você";
  if (lado === "rh") return m.autorNome || "RH";
  return m.autorNome ? `${m.autorNome}, do RH` : "RH";
}

function Balao({ mensagem: m, lado }: { mensagem: MensagemDenuncia; lado: "rh" | "denunciante" }) {
  const minha = (m.autor === "rh") === (lado === "rh");
  return (
    <li className={cn("flex", minha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col gap-0.5 rounded-painel border px-3 py-2",
          minha ? "border-rota/25 bg-rota-suave" : "border-linha bg-poco"
        )}
      >
        <p className="text-micro text-apagado">
          <span className="font-[600] text-tinta-2">{autorDe(m, lado)}</span>
          <span className="num"> · {dataHoraBR(m.criadoEm)}</span>
        </p>
        <p className="text-corpo whitespace-pre-wrap text-tinta [overflow-wrap:anywhere]">{m.corpo}</p>
      </div>
    </li>
  );
}
