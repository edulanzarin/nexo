"use client";

import { useState, useSyncExternalStore } from "react";
import { AvisoPublico } from "@/componentes/casca/casca-publica";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { CamposFormulario } from "@/componentes/produto/rh/campos-formulario";
import type { RodadaPublica } from "@/lib/clima-tipos";
import { validarRespostas, type RespostaValores, type ValorCampo } from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";

const semAssinatura = () => () => {};

function jaRespondeu(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) != null;
  } catch {
    return false;
  }
}

/**
 * O formulário da rodada, para quem responde. A resposta não leva nome nem nada
 * do aparelho; o único rastro é uma marca no próprio navegador, que só serve
 * para avisar "você já respondeu" e não impede de responder de novo (um link
 * aberto não tem como impedir, e o aviso já evita o envio em dobro por engano).
 */
export function ClimaForm({ rodada }: { rodada: RodadaPublica }) {
  const chave = `clima:${rodada.slug}`;
  const [valores, setValores] = useState<RespostaValores>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [deNovo, setDeNovo] = useState(false);

  // Lido só no navegador: no servidor não há marca, e a hidratação não quebra.
  const respondeuAntes = useSyncExternalStore(semAssinatura, () => jaRespondeu(chave), () => false);

  const mudar = (id: number, v: ValorCampo) => {
    setValores((s) => ({ ...s, [String(id)]: v }));
    setErros((e) => {
      if (!(id in e)) return e;
      const resto = { ...e };
      delete resto[id];
      return resto;
    });
  };

  async function enviar() {
    setErroGeral(null);
    const es = validarRespostas(rodada.campos, valores);
    setErros(es);
    const primeiro = rodada.campos.find((c) => es[c.id]);
    if (primeiro) {
      setErroGeral("Falta completar o que está marcado.");
      document.getElementById(`campo-${primeiro.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setEnviando(true);
    try {
      await mutar(`/api/clima/${encodeURIComponent(rodada.slug)}`, "POST", { valores });
      try {
        window.localStorage.setItem(chave, "1");
      } catch {
        /* sem armazenamento no navegador: fica sem o aviso de já respondeu */
      }
      setPronto(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErroGeral((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) return <AvisoPublico tom="ok" titulo="Avaliação enviada" texto="Obrigado pela resposta." />;

  if (respondeuAntes && !deNovo)
    return (
      <AvisoPublico titulo="Você já respondeu" texto="Este aparelho já enviou uma resposta nesta avaliação.">
        <Botao onClick={() => setDeNovo(true)}>Responder de novo</Botao>
      </AvisoPublico>
    );

  return (
    <section className="nx-vidro flex flex-col rounded-painel">
      <header className="flex flex-col gap-2 border-b border-linha px-5 py-5 sm:px-6">
        <h1 className="nx-titulo text-titulo text-tinta">{rodada.titulo}</h1>
        {rodada.descricao && <p className="text-corpo whitespace-pre-line text-tinta-2">{rodada.descricao}</p>}
        <p className="flex items-center gap-1.5 text-corpo text-apagado">
          <Icone nome="escudo" tamanho={16} className="text-ok" />
          Suas respostas são anônimas.
        </p>
      </header>

      <form
        noValidate
        className="flex flex-col gap-6 px-5 py-5 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <CamposFormulario campos={rodada.campos} valores={valores} onMudar={mudar} erros={erros} />
        {erroGeral && (
          <Nota tom="perigo" icone="erro">
            {erroGeral}
          </Nota>
        )}
        <Botao
          type="submit"
          variante="primario"
          icone="enviar"
          carregando={enviando}
          className="w-full sm:w-auto sm:self-end"
        >
          Enviar avaliação
        </Botao>
      </form>
    </section>
  );
}
