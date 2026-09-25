"use client";

import { cn } from "@/lib/cn";
import { dataHoraBR, num } from "@/lib/format";
import {
  escalaDoCampo,
  type FormularioCampo,
  type RespostaValores,
  type ValorCampo,
} from "@/lib/formularios-tipos";
import { CamposFormulario } from "./campos-formulario";

/*
 * A leitura de uma resposta guardada, com a decisão em destaque. O formulário
 * é montado no editor, então a "decisão" não é um campo fixo: é a pergunta que
 * o RH marcou com `config.papel === "decisao"` (Efetivar, Prorrogar, Desligar).
 * É a resposta que o RH procura primeiro, e por isso sobe para o topo; a
 * pergunta continua no lugar dela entre as outras.
 *
 * Serve a Experiência (uma resposta por marco) e o Desempenho (uma por gestor).
 */

export interface Decisao {
  pergunta: string;
  resposta: string;
}

/** O valor de um campo em texto corrido, para destaque, lista e planilha. */
function textoDoValor(campo: FormularioCampo, v: ValorCampo): string | null {
  switch (campo.tipo) {
    case "selecao_multipla":
      return Array.isArray(v) && v.length ? v.join(", ") : null;
    case "nota": {
      const rotulo = typeof v === "number" ? escalaDoCampo(campo)[v] : undefined;
      return rotulo?.trim() || null;
    }
    case "pontuacao":
      return typeof v === "number" ? num(v) : null;
    default:
      return typeof v === "string" && v.trim() ? v.trim() : null;
  }
}

/** A resposta da pergunta de decisão, ou null se o formulário não tem uma ou ela ficou em branco. */
export function decisaoDaResposta(campos: FormularioCampo[], valores: RespostaValores): Decisao | null {
  const campo = campos.find((c) => c.config.papel === "decisao");
  if (!campo) return null;
  const resposta = textoDoValor(campo, valores[String(campo.id)]);
  return resposta ? { pergunta: campo.rotulo, resposta } : null;
}

/*
 * Antes do editor de formulários (migration 012) a experiência tinha critérios
 * fixos e a recomendação ia numa coluna própria, com estes códigos. Resposta
 * nova deixa a coluna vazia e guarda tudo nos valores do formulário.
 */
const RECOMENDACAO_LEGADA: Record<string, string> = {
  prorrogar: "Prorrogar",
  nao_prorrogar: "Não prorrogar",
  efetivar: "Efetivar",
  desligar: "Desligar",
};

/** A recomendação da coluna antiga por extenso, ou null quando a resposta é do editor. */
export function rotuloRecomendacao(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return RECOMENDACAO_LEGADA[codigo] ?? codigo;
}

export function DestaqueDecisao({ decisao, className }: { decisao: Decisao; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-controle border border-rota/30 bg-rota-suave px-3 py-2",
        className
      )}
    >
      <span className="truncate text-pequeno text-apagado">{decisao.pergunta}</span>
      <span className="text-medio font-[620] text-tinta">{decisao.resposta}</span>
    </div>
  );
}

/** Uma resposta guardada: quem respondeu e quando, a decisão no topo e as perguntas em leitura. */
export function LeituraResposta({
  campos,
  valores,
  nome,
  email,
  em,
  className,
}: {
  campos: FormularioCampo[];
  valores: RespostaValores;
  nome: string | null;
  email?: string | null;
  em: string | null;
  className?: string;
}) {
  const decisao = decisaoDaResposta(campos, valores);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="text-pequeno text-apagado">
        Respondido por <span className="font-[560] text-tinta-2">{nome || "—"}</span>
        {email && <> · {email}</>}
        {em && <span className="num"> em {dataHoraBR(em)}</span>}
      </p>
      {decisao && <DestaqueDecisao decisao={decisao} />}
      <CamposFormulario campos={campos} valores={valores} somenteLeitura />
    </div>
  );
}
