"use client";

import Link from "next/link";
import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { CamposFormulario } from "@/componentes/produto/rh/campos-formulario";
import { ReciboDenuncia } from "@/componentes/produto/rh/denuncia-recibo";
import { CATEGORIAS_DENUNCIA, CATEGORIA_DENUNCIA_ROTULO } from "@/lib/denuncia-tipos";
import {
  validarRespostas,
  type FormularioCampo,
  type RespostaValores,
  type ValorCampo,
} from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";

/*
 * As perguntas da denúncia desenhadas pela mesma peça dos formulários do RH:
 * quem responde uma avaliação e quem denuncia vê o mesmo jeito de marcar e de
 * escrever, e o assunto vira opções grandes, fáceis de tocar no celular.
 */
const ASSUNTO = 1;
const RELATO = 2;
const SETOR = 3;

const CAMPOS: FormularioCampo[] = [
  {
    id: ASSUNTO,
    ordem: 1,
    tipo: "selecao_unica",
    rotulo: "Sobre o que é a denúncia?",
    ajuda: null,
    obrigatorio: true,
    config: { opcoes: CATEGORIAS_DENUNCIA.map((c) => CATEGORIA_DENUNCIA_ROTULO[c]) },
  },
  {
    id: RELATO,
    ordem: 2,
    tipo: "texto_longo",
    rotulo: "O que aconteceu?",
    ajuda: "Conte o que houve, quando, onde e quem estava envolvido. Se não quiser ser identificado, não escreva seu nome.",
    obrigatorio: true,
    config: {},
  },
  {
    id: SETOR,
    ordem: 3,
    tipo: "texto_curto",
    rotulo: "Setor ou área envolvida, se souber",
    ajuda: null,
    obrigatorio: false,
    config: {},
  },
];

/** O mesmo mínimo que `criarDenuncia` exige: aqui a pessoa descobre antes de enviar. */
const MIN_RELATO = 20;

const texto = (v: ValorCampo) => (typeof v === "string" ? v.trim() : "");

export function DenunciaForm() {
  const [valores, setValores] = useState<RespostaValores>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState<{ protocolo: string; senha: string } | null>(null);

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
    const es = validarRespostas(CAMPOS, valores);
    const relato = texto(valores[String(RELATO)]);
    if (!es[RELATO] && relato.length < MIN_RELATO) es[RELATO] = "Conte com mais detalhes, em pelo menos uma frase.";
    setErros(es);
    const primeiro = CAMPOS.find((c) => es[c.id]);
    if (primeiro) {
      setErroGeral("Falta completar o que está marcado.");
      document.getElementById(`campo-${primeiro.id}`)?.scrollIntoView({ block: "center" });
      return;
    }

    const assunto = texto(valores[String(ASSUNTO)]);
    const categoria = CATEGORIAS_DENUNCIA.find((c) => CATEGORIA_DENUNCIA_ROTULO[c] === assunto);
    setEnviando(true);
    try {
      const r = await mutar<{ protocolo: string; senha: string }>("/api/denuncia", "POST", {
        categoria,
        relato,
        setorEnvolvido: texto(valores[String(SETOR)]) || null,
      });
      setCriada(r);
      // O recibo é mais curto que o formulário: sem isto a pessoa cairia no meio do nada.
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErroGeral((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (criada) return <ReciboDenuncia protocolo={criada.protocolo} senha={criada.senha} />;

  return (
    <section className="nx-vidro flex flex-col rounded-painel">
      <header className="flex flex-col gap-2 border-b border-linha px-5 py-5 sm:px-6">
        <h1 className="nx-titulo text-titulo text-tinta">Canal de Denúncia</h1>
        <p className="text-corpo text-tinta-2">
          Conte o que aconteceu. Não pedimos seu nome e não registramos quem envia.
        </p>
        <p className="flex items-start gap-1.5 text-corpo text-apagado">
          <Icone nome="escudo" tamanho={16} className="mt-px text-ok" />
          <span>Ao enviar, você recebe um protocolo e uma senha para acompanhar a resposta do RH.</span>
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
        <CamposFormulario campos={CAMPOS} valores={valores} onMudar={mudar} erros={erros} />
        {erroGeral && (
          <Nota tom="perigo" icone="erro">
            {erroGeral}
          </Nota>
        )}
        <Botao type="submit" variante="primario" icone="enviar" carregando={enviando} className="w-full sm:w-auto sm:self-end">
          Enviar denúncia
        </Botao>
      </form>

      <footer className="border-t border-linha px-5 py-3.5 text-corpo text-apagado sm:px-6">
        Já fez uma denúncia?{" "}
        <Link href="/denuncia/acompanhar" className="font-[560] text-rota hover:underline">
          Acompanhar
        </Link>
      </footer>
    </section>
  );
}
