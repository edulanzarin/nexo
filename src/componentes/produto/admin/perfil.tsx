"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Esqueleto, Nota } from "@/componentes/primitivos/estados";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { SENHA_MIN } from "@/lib/admin-tipos";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { CampoFoto, FOTO_INTACTA, fotoMudou, type MudancaFoto } from "./campo-foto";

/*
 * As peças do Meu Perfil: a foto, a senha e as sessões abertas da própria
 * pessoa. Cada painel é um formulário à parte e recebe a escrita pronta de
 * quem monta a página; aqui mora só o rascunho e o estado de "salvando".
 */

/** Chave da consulta do perfil. Quem troca foto, senha ou sessão invalida por ela. */
export const CHAVE_PERFIL = "perfil";

/**
 * Volta para a tela de onde a pessoa veio. Aberta direto (link colado, aba
 * nova), não há de onde voltar: vai ao início.
 */
export function BotaoVoltar({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Botao
      variante="fantasma"
      icone="seta-esquerda"
      className={cn("-ml-2 self-start", className)}
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      Voltar
    </Botao>
  );
}

/**
 * A foto, que a pessoa troca, e o nome e o e-mail, que só a administração
 * muda. O botão de salvar só aparece com uma troca pedida.
 */
export function PainelFotoPerfil({
  nome,
  email,
  foto,
  onSalvar,
  mudancaInicial = FOTO_INTACTA,
}: {
  nome: string;
  email: string;
  /** A foto gravada hoje, ou null. */
  foto: string | null;
  onSalvar: (m: MudancaFoto) => Promise<boolean>;
  /** No catálogo: o painel já com uma troca pedida. */
  mudancaInicial?: MudancaFoto;
}) {
  const [mudanca, setMudanca] = useState(mudancaInicial);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const ok = await onSalvar(mudanca);
    setSalvando(false);
    if (ok) setMudanca(FOTO_INTACTA);
  }

  return (
    <Painel
      titulo="Foto e Dados"
      icone="usuario"
      rodape={
        fotoMudou(mudanca) ? (
          <div className="flex justify-end">
            <Botao variante="primario" icone="salvar" carregando={salvando} onClick={salvar}>
              Salvar foto
            </Botao>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <CampoFoto
          nome={nome}
          atual={foto}
          mudanca={mudanca}
          onMudar={setMudanca}
          desabilitado={salvando}
          tamanho={72}
        />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Par rotulo="Nome">{nome}</Par>
          <Par rotulo="E-mail">
            <span className="block truncate" title={email}>
              {email}
            </span>
          </Par>
        </dl>
        <Nota>Quem muda o nome e o e-mail é a administração.</Nota>
      </div>
    </Painel>
  );
}

export interface TrocaSenha {
  atual: string;
  nova: string;
  confirma: string;
}

const SENHA_VAZIA: TrocaSenha = { atual: "", nova: "", confirma: "" };

/**
 * A troca da própria senha, com a atual. Os campos limpam depois de trocar: a
 * senha digitada não fica parada na página.
 */
export function PainelSenha({
  onTrocar,
  inicial = SENHA_VAZIA,
}: {
  onTrocar: (d: TrocaSenha) => Promise<boolean>;
  /** No catálogo: o formulário já preenchido. */
  inicial?: TrocaSenha;
}) {
  const base = useId();
  const [v, setV] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  // Só acusa a confirmação quando ela já tem o tamanho da nova: antes disso a
  // pessoa ainda está digitando.
  const naoBate = v.confirma.length >= v.nova.length && v.confirma.length > 0 && v.confirma !== v.nova;
  const pronto = v.atual !== "" && v.nova.length >= SENHA_MIN && v.confirma === v.nova && !salvando;

  async function enviar() {
    if (!pronto) return;
    setSalvando(true);
    const ok = await onTrocar(v);
    setSalvando(false);
    if (ok) setV(SENHA_VAZIA);
  }

  return (
    <Painel titulo="Senha" icone="chave">
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <Rotulado rotulo="Senha atual" htmlFor={`${base}-atual`}>
          <Campo
            id={`${base}-atual`}
            type="password"
            autoComplete="current-password"
            value={v.atual}
            onChange={(e) => setV({ ...v, atual: e.target.value })}
          />
        </Rotulado>
        <Rotulado rotulo="Nova senha" htmlFor={`${base}-nova`} ajuda={`Ao menos ${SENHA_MIN} caracteres`}>
          <Campo
            id={`${base}-nova`}
            type="password"
            autoComplete="new-password"
            value={v.nova}
            onChange={(e) => setV({ ...v, nova: e.target.value })}
          />
        </Rotulado>
        <Rotulado
          rotulo="Confirmar nova senha"
          htmlFor={`${base}-confirma`}
          erro={naoBate ? "A confirmação não bate com a nova senha" : undefined}
        >
          <Campo
            id={`${base}-confirma`}
            type="password"
            autoComplete="new-password"
            aria-invalid={naoBate || undefined}
            value={v.confirma}
            onChange={(e) => setV({ ...v, confirma: e.target.value })}
          />
        </Rotulado>
        <Nota>Trocar a senha encerra as sessões abertas em outros dispositivos.</Nota>
        <div>
          {/* O laranja só quando há o que trocar: com uma foto pendente acima, dois
              primários ao mesmo tempo disputariam a ação principal da página. */}
          <Botao type="submit" variante={pronto ? "primario" : "secundario"} icone="chave" carregando={salvando} disabled={!pronto}>
            Trocar senha
          </Botao>
        </div>
      </form>
    </Painel>
  );
}

/** Onde a pessoa está conectada, contando este dispositivo, e a saída dos outros. */
export function PainelSessoes({ sessoes, onEncerrar }: { sessoes: number; onEncerrar: () => Promise<void> }) {
  const [encerrando, setEncerrando] = useState(false);
  const outras = Math.max(0, sessoes - 1);
  return (
    <Painel titulo="Sessões Ativas" icone="sistema">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-medio font-[600] text-tinta">
            {outras === 0 ? "Só este dispositivo" : `${num(sessoes)} dispositivos`}
          </p>
          {outras > 0 && <p className="text-pequeno text-apagado">Contando este</p>}
        </div>
        <Botao
          icone="sair"
          carregando={encerrando}
          disabled={outras === 0}
          onClick={async () => {
            setEncerrando(true);
            await onEncerrar();
            setEncerrando(false);
          }}
        >
          Encerrar outras sessões
        </Botao>
      </div>
    </Painel>
  );
}

/** O perfil chegando: os mesmos painéis, com o lugar de cada coisa. */
export function EsqueletoPerfil() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Painel titulo="Foto e Dados" icone="usuario">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Esqueleto className="size-18 shrink-0 rounded-full" />
            <div className="flex flex-col gap-2">
              <Esqueleto className="h-controle w-32" />
              <Esqueleto className="h-3 w-44" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Esqueleto className="h-9 w-48" />
            <Esqueleto className="h-9 w-56" />
          </div>
        </div>
      </Painel>
      <Painel titulo="Senha" icone="chave">
        <div className="flex max-w-sm flex-col gap-4">
          <Esqueleto className="h-controle" />
          <Esqueleto className="h-controle" />
          <Esqueleto className="h-controle" />
        </div>
      </Painel>
      <Painel titulo="Sessões Ativas" icone="sistema">
        <Esqueleto className="h-5 w-40" />
      </Painel>
    </div>
  );
}
