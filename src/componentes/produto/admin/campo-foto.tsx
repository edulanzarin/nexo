"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/componentes/primitivos/avatar";
import { Botao } from "@/componentes/primitivos/botao";
import { AVATAR_MAX_BYTES, AVATAR_TIPOS } from "@/lib/admin-tipos";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";

/*
 * A foto de perfil de um usuário: a mesma peça no cadastro da Administração e
 * no Meu Perfil. Ela só guarda o que a pessoa PEDIU (foto nova ou remoção); quem
 * grava é a tela, no salvar, porque a foto tem rota própria e, no usuário novo,
 * só pode subir depois que o cadastro devolve o id.
 */

/** O endereço da foto. O `?v=` muda quando a foto muda, e o navegador não serve a antiga do cache. */
export function srcAvatar(id: string, versao: number | null): string | null {
  return versao != null ? `/api/avatar/${id}?v=${versao}` : null;
}

/** O que a pessoa pediu para a foto e ainda não foi gravado. */
export interface MudancaFoto {
  arquivo: File | null;
  /** Endereço local do arquivo escolhido, para a prévia. */
  previa: string | null;
  remover: boolean;
}

export const FOTO_INTACTA: MudancaFoto = { arquivo: null, previa: null, remover: false };

export const fotoMudou = (m: MudancaFoto) => m.arquivo != null || m.remover;

const FORMATOS = "PNG, JPG, WebP ou GIF";
const LIMITE = `${num(AVATAR_MAX_BYTES / (1024 * 1024))} MB`;

/**
 * A conferência do servidor, adiantada: o arquivo errado é recusado na escolha,
 * e não depois de o cadastro já ter sido gravado sem a foto.
 */
function conferir(f: File): string | null {
  if (!AVATAR_TIPOS.includes(f.type)) return `A foto precisa ser ${FORMATOS}`;
  if (f.size > AVATAR_MAX_BYTES) return `A foto passa de ${LIMITE}`;
  return null;
}

/**
 * A foto atual (ou as iniciais), a escolha de uma nova com prévia e a remoção.
 * Controlado: a mudança mora em quem salva. A prévia nasce no clique, e não num
 * efeito: no modo estrito o efeito roda duas vezes, e a limpeza revogaria o
 * endereço que a imagem ainda está mostrando.
 */
export function CampoFoto({
  nome,
  atual,
  mudanca,
  onMudar,
  desabilitado,
  tamanho = 64,
  erroInicial = null,
  className,
}: {
  /** Para as iniciais, quando não há foto. */
  nome: string;
  /** A foto gravada hoje, ou null. */
  atual: string | null;
  mudanca: MudancaFoto;
  onMudar: (m: MudancaFoto) => void;
  desabilitado?: boolean;
  tamanho?: number;
  /** No catálogo: o campo já mostrando a recusa de um arquivo. */
  erroInicial?: string | null;
  className?: string;
}) {
  const [erro, setErro] = useState<string | null>(erroInicial);

  const trocar = (m: MudancaFoto) => {
    if (mudanca.previa && mudanca.previa !== m.previa && mudanca.previa.startsWith("blob:"))
      URL.revokeObjectURL(mudanca.previa);
    onMudar(m);
  };

  const escolher = (f: File | undefined) => {
    if (!f) return;
    const recusa = conferir(f);
    setErro(recusa);
    if (!recusa) trocar({ arquivo: f, previa: URL.createObjectURL(f), remover: false });
  };

  // O seletor de arquivo nasce no clique, fora da página: um input escondido
  // dentro do modal seria o primeiro campo da janela, e levaria o foco inicial
  // e a volta do Tab para algo invisível. A referência segura o input vivo
  // enquanto a janela do sistema está aberta.
  const seletor = useRef<HTMLInputElement | null>(null);
  const abrirEscolha = () => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = AVATAR_TIPOS.join(",");
    el.onchange = () => {
      escolher(el.files?.[0]);
      seletor.current = null;
    };
    seletor.current = el;
    el.click();
  };

  const src = mudanca.previa ?? (mudanca.remover ? null : atual);
  const pendente = fotoMudou(mudanca);

  let linha: string;
  if (erro) linha = erro;
  else if (mudanca.remover) linha = "A foto sai quando você salvar";
  else if (mudanca.arquivo) linha = mudanca.arquivo.name;
  else linha = `${FORMATOS}, até ${LIMITE}`;

  return (
    <div className={cn("flex min-w-0 items-center gap-4", className)}>
      <Avatar nome={nome.trim() || "?"} src={src} tamanho={tamanho} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Botao icone="enviar" onClick={abrirEscolha} disabled={desabilitado}>
            {src ? "Trocar foto" : "Escolher foto"}
          </Botao>
          {pendente ? (
            <Botao
              variante="fantasma"
              icone="desfazer"
              disabled={desabilitado}
              onClick={() => {
                setErro(null);
                trocar({ arquivo: null, previa: null, remover: false });
              }}
            >
              Desfazer
            </Botao>
          ) : atual ? (
            <Botao
              variante="fantasma"
              icone="apagar"
              disabled={desabilitado}
              onClick={() => {
                setErro(null);
                trocar({ arquivo: null, previa: null, remover: true });
              }}
            >
              Remover foto
            </Botao>
          ) : null}
        </div>
        <p
          role={erro ? "alert" : undefined}
          className={cn("truncate text-pequeno", erro ? "text-perigo" : "text-apagado")}
          title={linha}
        >
          {linha}
        </p>
      </div>
    </div>
  );
}
