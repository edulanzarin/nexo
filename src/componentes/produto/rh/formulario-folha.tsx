"use client";

import { useId, useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { CamposFormulario } from "@/componentes/produto/rh/campos-formulario";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import {
  validarRespostas,
  type FormularioCampo,
  type RespostaValores,
  type ValorCampo,
} from "@/lib/formularios-tipos";

export interface RespostaFolha {
  respondidoPorNome: string;
  respondidoPorEmail: string | null;
  valores: RespostaValores;
}

/**
 * O formulário como quem responde vê: o que é e sobre quem, as perguntas, quem
 * está respondendo e o botão de enviar. É a MESMA peça na página aberta por
 * link e na prévia do editor, senão a prévia mente sobre o que chega ao gestor.
 *
 * O nome de quem responde é obrigatório porque o servidor exige: no desempenho
 * o mesmo link vai a todos os gestores do setor, e o nome é o que separa uma
 * resposta da outra. A validação é a mesma do servidor (`validarRespostas`),
 * que continua sendo a autoridade: o erro dele aparece acima do botão.
 */
export function FolhaFormulario({
  titulo,
  apoio,
  selo,
  descricao,
  mensagem,
  contexto = [],
  varias,
  campos,
  onEnviar,
  className,
}: {
  titulo: string;
  /** Linha pequena acima do título (o nome da rodada, por exemplo). */
  apoio?: string | null;
  /** Fato curto ao lado do título ("45 dias"). */
  selo?: string | null;
  descricao?: string | null;
  /** Recado de quem enviou, o mesmo do e-mail. */
  mensagem?: string | null;
  /** Ficha de quem está sendo avaliado. */
  contexto?: { rotulo: string; valor: string }[];
  /** O link aceita mais de uma resposta (desempenho). */
  varias?: boolean;
  campos: FormularioCampo[];
  /** Lança `Error` com a mensagem para mostrar; resolve quando deu certo. */
  onEnviar: (r: RespostaFolha) => Promise<void>;
  className?: string;
}) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [valores, setValores] = useState<RespostaValores>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<ReactNode>(null);
  const [enviando, setEnviando] = useState(false);

  const mudar = (campoId: number, v: ValorCampo) => {
    setValores((s) => ({ ...s, [String(campoId)]: v }));
    // O erro de uma pergunta some quando ela é mexida; os das outras ficam.
    setErros((e) => {
      if (!(campoId in e)) return e;
      const resto = { ...e };
      delete resto[campoId];
      return resto;
    });
  };

  async function enviar() {
    setErroGeral(null);
    const semNome = !nome.trim();
    const es = validarRespostas(campos, valores);
    setErroNome(semNome ? "Informe seu nome" : null);
    setErros(es);
    const faltam = Object.keys(es).length + (semNome ? 1 : 0);
    if (faltam) {
      setErroGeral(
        faltam === 1 ? "Falta 1 resposta. Ela está marcada acima." : `Faltam ${num(faltam)} respostas. Elas estão marcadas acima.`
      );
      return;
    }
    setEnviando(true);
    try {
      await onEnviar({ respondidoPorNome: nome.trim(), respondidoPorEmail: email.trim() || null, valores });
    } catch (e) {
      setErroGeral((e as Error).message || "Não deu para enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className={cn("nx-vidro flex min-w-0 flex-col rounded-painel", className)}>
      <header className="flex flex-col gap-2 border-b border-linha px-4 pt-5 pb-4 sm:px-6">
        {apoio && <p className="text-pequeno text-apagado">{apoio}</p>}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="nx-titulo min-w-0 text-[20px] leading-7 break-words text-tinta">{titulo}</h1>
          {selo && <Selo tom="rota">{selo}</Selo>}
        </div>
        {descricao && <p className="text-corpo whitespace-pre-line text-tinta-2">{descricao}</p>}
        {mensagem && (
          <p className="rounded-controle border border-linha bg-poco px-3 py-2 text-corpo whitespace-pre-line text-tinta-2">
            {mensagem}
          </p>
        )}
        {contexto.length > 0 && (
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            {contexto.map((c) => (
              <Par key={c.rotulo} rotulo={c.rotulo}>
                <span className="block truncate" title={c.valor}>
                  {c.valor}
                </span>
              </Par>
            ))}
          </dl>
        )}
      </header>

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
        {campos.length === 0 ? (
          <p className="text-corpo text-apagado italic">Este formulário ainda não tem perguntas.</p>
        ) : (
          <CamposFormulario campos={campos} valores={valores} onMudar={mudar} erros={erros} />
        )}

        <div className="flex flex-col gap-3 border-t border-linha pt-5">
          {varias && (
            <Nota icone="pessoas">O mesmo link vai para todos os gestores do setor. Cada um envia a sua resposta.</Nota>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Rotulado rotulo="Seu nome" htmlFor={`${id}-nome`} erro={erroNome}>
              <Campo
                id={`${id}-nome`}
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (erroNome) setErroNome(null);
                }}
                autoComplete="name"
                aria-invalid={!!erroNome}
              />
            </Rotulado>
            <Rotulado rotulo="Seu e-mail" htmlFor={`${id}-email`} ajuda="Opcional">
              <Campo
                id={`${id}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Rotulado>
          </div>
          {erroGeral && (
            <p role="alert" className="text-corpo text-perigo">
              {erroGeral}
            </p>
          )}
          <Botao
            variante="primario"
            icone="enviar"
            carregando={enviando}
            onClick={enviar}
            className="w-full sm:w-auto sm:self-start"
          >
            Enviar respostas
          </Botao>
        </div>
      </div>
    </article>
  );
}
