"use client";

import { AreaTexto, Campo } from "@/componentes/primitivos/campo";
import { Icone } from "@/componentes/primitivos/icone";
import { cn } from "@/lib/cn";
import {
  escalaDoCampo,
  type FormularioCampo,
  type RespostaValores,
  type ValorCampo,
} from "@/lib/formularios-tipos";

/**
 * As perguntas de um formulário, desenhadas a partir da definição guardada.
 * Uma peça só serve a prévia do editor, a página pública (quem responde) e a
 * leitura de uma resposta (experiência, desempenho, clima, envios): se cada uma
 * desenhasse a sua, a prévia deixaria de mostrar o que a pessoa recebe.
 *
 * Controlada: `valores` + `onMudar`. Em `somenteLeitura` o texto vira parágrafo
 * e a escolha fica marcada sem esmaecer, porque ali o trabalho é ler.
 */
export function CamposFormulario({
  campos,
  valores,
  onMudar,
  erros = {},
  somenteLeitura = false,
  className,
}: {
  campos: FormularioCampo[];
  valores: RespostaValores;
  onMudar?: (campoId: number, valor: ValorCampo) => void;
  erros?: Record<number, string>;
  somenteLeitura?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {campos.map((campo, i) => {
        const erro = erros[campo.id];
        const idRotulo = `campo-${campo.id}`;
        return (
          <div key={campo.id} role="group" aria-labelledby={idRotulo} className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <p id={idRotulo} className="text-corpo font-[600] text-tinta">
                <span className="num mr-1.5 text-apagado">{i + 1}.</span>
                {campo.rotulo}
                {campo.obrigatorio && !somenteLeitura && (
                  <span className="ml-1 text-perigo" aria-label="obrigatória">
                    *
                  </span>
                )}
              </p>
              {campo.ajuda && <p className="text-pequeno text-apagado">{campo.ajuda}</p>}
            </div>
            <Controle
              campo={campo}
              valor={valores[String(campo.id)]}
              onMudar={(v) => onMudar?.(campo.id, v)}
              somenteLeitura={somenteLeitura}
              invalido={!!erro}
            />
            {erro && <p className="text-pequeno text-perigo">{erro}</p>}
          </div>
        );
      })}
    </div>
  );
}

function SemResposta() {
  return <p className="text-corpo text-apagado italic">Sem resposta</p>;
}

function Controle({
  campo,
  valor,
  onMudar,
  somenteLeitura,
  invalido,
}: {
  campo: FormularioCampo;
  valor: ValorCampo;
  onMudar: (v: ValorCampo) => void;
  somenteLeitura: boolean;
  invalido: boolean;
}) {
  switch (campo.tipo) {
    case "texto_curto":
    case "texto_longo": {
      const texto = typeof valor === "string" ? valor : "";
      if (somenteLeitura)
        return texto.trim() ? (
          <p className="rounded-controle border border-linha bg-poco px-2.5 py-2 text-corpo whitespace-pre-wrap text-tinta">
            {texto}
          </p>
        ) : (
          <SemResposta />
        );
      return campo.tipo === "texto_curto" ? (
        <Campo
          value={texto}
          onChange={(e) => onMudar(e.target.value)}
          placeholder="Sua resposta"
          aria-invalid={invalido}
        />
      ) : (
        <AreaTexto
          value={texto}
          onChange={(e) => onMudar(e.target.value)}
          rows={4}
          placeholder="Sua resposta"
          aria-invalid={invalido}
        />
      );
    }

    case "selecao_unica":
    case "selecao_multipla": {
      const multipla = campo.tipo === "selecao_multipla";
      const marcadas = multipla ? (Array.isArray(valor) ? valor : []) : typeof valor === "string" ? [valor] : [];
      const opcoes = campo.config.opcoes ?? [];
      if (somenteLeitura && marcadas.length === 0) return <SemResposta />;
      const alternar = (op: string) => {
        if (!multipla) return onMudar(op);
        onMudar(marcadas.includes(op) ? marcadas.filter((x) => x !== op) : [...marcadas, op]);
      };
      return (
        <div role={multipla ? "group" : "radiogroup"} className="grid gap-1.5">
          {opcoes.map((op) => {
            const sel = marcadas.includes(op);
            return (
              <button
                key={op}
                type="button"
                role={multipla ? "checkbox" : "radio"}
                aria-checked={sel}
                disabled={somenteLeitura}
                onClick={() => alternar(op)}
                className={cn(
                  "flex min-h-controle items-center gap-2.5 rounded-controle border px-2.5 py-1.5 text-left text-corpo transition-colors",
                  sel ? "border-rota bg-rota-suave text-tinta" : "border-linha text-tinta-2",
                  somenteLeitura ? "cursor-default" : !sel && "hover:border-linha-forte hover:bg-poco",
                  somenteLeitura && !sel && "opacity-60",
                  invalido && !sel && "border-perigo/50"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 shrink-0 place-items-center border",
                    multipla ? "rounded-[4px]" : "rounded-full",
                    sel ? "border-rota bg-rota text-fundo" : "border-linha-forte bg-poco"
                  )}
                >
                  {sel && (multipla ? <Icone nome="certo" tamanho={11} /> : <span className="size-1.5 rounded-full bg-fundo" />)}
                </span>
                {op}
              </button>
            );
          })}
        </div>
      );
    }

    case "nota": {
      const escala = escalaDoCampo(campo);
      const idx = typeof valor === "number" ? valor : -1;
      if (somenteLeitura && idx < 0) return <SemResposta />;
      return (
        <div role="radiogroup" className="flex flex-wrap items-start gap-1.5">
          {escala.map((rotulo, i) => {
            const sel = idx === i;
            const numero = String(i + 1);
            // Escala só de números não repete a legenda embaixo do próprio número.
            const legenda = rotulo.trim() !== numero ? rotulo : null;
            return (
              <button
                key={`${i}-${rotulo}`}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={legenda ? `${numero}, ${legenda}` : numero}
                disabled={somenteLeitura}
                onClick={() => onMudar(i)}
                className={cn("group flex w-14 flex-col items-center gap-1 sm:w-16", somenteLeitura && "cursor-default")}
              >
                <span
                  className={cn(
                    "num grid size-10 place-items-center rounded-controle border text-medio font-[620] transition-colors",
                    sel ? "border-rota bg-rota text-fundo" : "border-linha bg-poco text-tinta-2",
                    !sel && !somenteLeitura && "group-hover:border-linha-forte group-hover:text-tinta",
                    somenteLeitura && !sel && "opacity-60",
                    invalido && !sel && "border-perigo/50"
                  )}
                >
                  {numero}
                </span>
                {legenda && (
                  <span className={cn("text-center text-micro leading-tight", sel ? "text-tinta" : "text-apagado")}>
                    {legenda}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    case "pontuacao": {
      const min = campo.config.min ?? 0;
      const max = campo.config.max ?? 100;
      const n = typeof valor === "number" ? valor : null;
      if (somenteLeitura)
        return n == null ? (
          <SemResposta />
        ) : (
          <p className="text-corpo text-tinta">
            <span className="num text-medio font-[620]">{n}</span>
            <span className="text-apagado">
              {" "}
              de {min} a {max}
            </span>
          </p>
        );
      return (
        <div className="flex items-center gap-2.5">
          <Campo
            type="number"
            min={min}
            max={max}
            value={n ?? ""}
            onChange={(e) => onMudar(e.target.value === "" ? null : Number(e.target.value))}
            className="w-28"
            aria-invalid={invalido}
          />
          <span className="text-pequeno text-apagado">
            de {min} a {max}
          </span>
        </div>
      );
    }
  }
}
