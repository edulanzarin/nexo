"use client";

import { useEffect, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { Tecla } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { abrirSeletorEmpresa } from "./seletor-empresa";

/**
 * O topo da seção: título, a frase do que ela faz e as ações. É chegada, não
 * rótulo: diz onde a pessoa está e o que dá para fazer ali, e para. O módulo e
 * a seção já estão na trilha do topo; o título não repete o módulo.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="nx-titulo text-titulo text-tinta">{titulo}</h1>
        {descricao && <p className="mt-0.5 max-w-[72ch] text-corpo text-apagado">{descricao}</p>}
      </div>
      {/* No papel, botão não serve: a impressão leva só o título e o conteúdo. */}
      {acoes && <div className="nx-sem-papel flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

/**
 * O botão que executa a tela. Ctrl+Enter executa de qualquer lugar da tela, e
 * quando o recorte do topo mudou depois da última execução o botão diz isso.
 */
export function BotaoExecutar({
  rotulo,
  onExecutar,
  executando,
  desatualizado,
  desabilitado,
}: {
  rotulo: string;
  onExecutar: () => void;
  executando?: boolean;
  desatualizado?: boolean;
  desabilitado?: boolean;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !desabilitado) {
        e.preventDefault();
        onExecutar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onExecutar, desabilitado]);

  return (
    <div className="flex items-center gap-2">
      {desatualizado && (
        <span className="flex items-center gap-1.5 text-pequeno text-atencao">
          <Icone nome="alerta" tamanho={14} />
          Recorte mudou
        </span>
      )}
      <Botao
        variante="primario"
        icone="executar"
        onClick={onExecutar}
        carregando={executando}
        disabled={desabilitado}
        title="Ctrl+Enter"
      >
        {desatualizado ? `${rotulo} de novo` : rotulo}
      </Botao>
    </div>
  );
}

/**
 * Antes da primeira execução. Ensina o que a tela vai fazer e onde está o
 * botão; não é "nenhum resultado", porque ainda não houve pergunta.
 */
export function AguardandoExecucao({
  rotulo,
  descricao,
  onExecutar,
}: {
  rotulo: string;
  descricao?: ReactNode;
  onExecutar: () => void;
}) {
  return (
    <div className="nx-vidro rounded-painel">
      <Vazio
        icone="executar"
        titulo={`Pronto para ${rotulo.toLowerCase()}`}
        descricao={
          <>
            {descricao ?? "Confira a empresa e o período no topo."}{" "}
            <span className="inline-flex items-center gap-1 align-middle">
              <Tecla>Ctrl</Tecla>
              <Tecla>Enter</Tecla>
            </span>{" "}
            também executa.
          </>
        }
        acao={
          <Botao variante="primario" icone="executar" onClick={onExecutar}>
            {rotulo}
          </Botao>
        }
      />
    </div>
  );
}

/** Bancada sem empresa: o que falta e o atalho para escolher. */
export function EscolhaEmpresa({ descricao }: { descricao?: ReactNode }) {
  return (
    <div className="nx-vidro rounded-painel">
      <Vazio
        icone="empresa"
        titulo="Escolha a empresa"
        descricao={descricao ?? "Esta tela trabalha uma empresa por vez. A escolha vale para as outras seções do módulo."}
        acao={
          <Botao variante="secundario" icone="empresa" onClick={abrirSeletorEmpresa}>
            Escolher empresa
          </Botao>
        }
      />
    </div>
  );
}
