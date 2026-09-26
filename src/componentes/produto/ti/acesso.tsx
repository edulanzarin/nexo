"use client";

import { create as criarQr } from "qrcode";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { BotaoIcone } from "@/componentes/primitivos/botao";
import { Icone } from "@/componentes/primitivos/icone";
import { Selo } from "@/componentes/primitivos/selo";
import { mutar } from "@/hooks/mutar";
import { useRecarregarAcessos } from "@/hooks/use-ti";
import { cn } from "@/lib/cn";
import { copiarTexto } from "@/lib/copiar";
import { dataHoraBR } from "@/lib/format";
import {
  fraseEvento,
  rotuloSegredo,
  tipoAcesso,
  type AcessoLista,
  type EventoAcesso,
  type SegredoId,
} from "@/lib/ti-acessos-tipos";

/*
 * As peças do cofre de Acessos: o tipo num quadrado, o acesso numa linha, o
 * texto que se copia com um clique, o segredo mascarado e o registro.
 */

/** O ícone do tipo num quadrado, o mesmo desenho do inventário. */
export function IconeAcesso({ tipo, className }: { tipo: string; className?: string }) {
  const t = tipoAcesso(tipo);
  return (
    <span
      className={cn("grid size-8 shrink-0 place-items-center rounded-controle bg-poco-forte text-tinta-2", className)}
      title={t.rotulo}
    >
      <Icone nome={t.icone} tamanho={16} />
    </span>
  );
}

/** O acesso numa célula: o nome em cima, o tipo e o grupo embaixo. */
export function CelulaAcesso({ a }: { a: Pick<AcessoLista, "tipo" | "nome" | "grupo"> }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 py-1">
      <IconeAcesso tipo={a.tipo} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-tinta">{a.nome}</span>
        <span className="truncate text-pequeno text-apagado">
          {[tipoAcesso(a.tipo).rotulo, a.grupo].filter(Boolean).join(" · ")}
        </span>
      </span>
    </span>
  );
}

/** Para dentro de uma linha clicável: o clique no botão não abre a ficha. */
function SemPropagar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}

/** `aviso` é a frase inteira: "Senha copiada", "Copiado: porta". O gênero muda de campo para campo. */
async function copiarComAviso(texto: string, aviso: string) {
  if (await copiarTexto(texto)) avisar.ok(aviso);
  else avisar.erro("Não deu para copiar", "Selecione o texto e copie com Ctrl+C.");
}

/**
 * Texto de cadastro que se copia com um clique: o endereço, a porta, o usuário.
 * Não é segredo, então copiar não entra no registro.
 */
export function TextoCopiavel({
  valor,
  rotulo,
  mono = true,
  className,
}: {
  valor: string | null | undefined;
  /** O que é, para o botão e o aviso ("Copiado: porta"). */
  rotulo: string;
  mono?: boolean;
  className?: string;
}) {
  if (!valor) return <span className="text-apagado">—</span>;
  return (
    <span className={cn("group/copiar inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className={cn("truncate text-tinta", mono && "num")} title={valor}>
        {valor}
      </span>
      <SemPropagar className="opacity-60 transition-opacity group-hover/copiar:opacity-100 focus-within:opacity-100">
        <BotaoIcone icone="copiar" rotulo={`Copiar ${rotulo.toLowerCase()}`} linha onClick={() => copiarComAviso(valor, `Copiado: ${rotulo.toLowerCase()}`)} />
      </SemPropagar>
    </span>
  );
}

/** Quanto tempo o segredo fica à mostra antes de voltar à máscara. */
const SEGUNDOS_A_MOSTRA = 30;

/**
 * Abre um segredo no servidor, que registra quem abriu antes de devolver. Quem
 * chama recarrega a ficha, o registro e o Painel, onde a linha nova aparece.
 */
export function useRevelarSegredo() {
  const recarregar = useRecarregarAcessos();
  return async (acessoId: number, campo: SegredoId, modo: "ver" | "copiar"): Promise<string> => {
    const r = await mutar<{ valor: string }>(`/api/ti/acessos/${acessoId}/revelar`, "POST", { campo, modo });
    recarregar();
    return r.valor;
  };
}

/**
 * O segredo mascarado, com ver e copiar. Ver mostra por trinta segundos e volta
 * à máscara sozinho: a senha não fica aberta na tela de quem levantou para um
 * café. Copiar não mostra, mas entra no registro do mesmo jeito.
 *
 * Segredo guardado com outra chave do cofre não abre: o selo diz o porquê em
 * vez de um erro na hora do clique.
 */
export function Segredo({
  acessoId,
  campo,
  guardado,
  outraChave,
  semChave,
  revelado,
}: {
  acessoId: number;
  campo: SegredoId;
  guardado: boolean;
  outraChave?: boolean;
  /** O servidor está sem a chave do cofre. */
  semChave?: boolean;
  /** Valor já aberto, para o catálogo mostrar o estado aberto. */
  revelado?: string;
}) {
  const revelar = useRevelarSegredo();
  const [valor, setValor] = useState<string | null>(revelado ?? null);
  const [restam, setRestam] = useState(0);
  // Cada abertura reinicia o relógio da máscara; 0 é fechado.
  const [abertura, setAbertura] = useState(0);
  const [ocupado, setOcupado] = useState<"ver" | "copiar" | null>(null);

  useEffect(() => {
    if (abertura === 0) return;
    const inicio = Date.now();
    const t = setInterval(() => {
      const falta = SEGUNDOS_A_MOSTRA * 1000 - (Date.now() - inicio);
      if (falta <= 0) {
        clearInterval(t);
        setValor(null);
        setRestam(0);
        setAbertura(0);
      } else setRestam(Math.ceil(falta / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [abertura]);

  if (!guardado) return <span className="text-apagado">Não guardada</span>;
  if (outraChave)
    return (
      <span className="inline-flex">
        <Selo tom="atencao" title="Guardada com outra chave do cofre: não abre com a chave de agora">
          Outra chave
        </Selo>
      </span>
    );

  const rotulo = rotuloSegredo(campo);

  function esconder() {
    setValor(null);
    setRestam(0);
    setAbertura(0);
  }

  async function abrir(modo: "ver" | "copiar") {
    setOcupado(modo);
    try {
      const v = await revelar(acessoId, campo, modo);
      if (modo === "copiar") {
        await copiarComAviso(v, `${rotulo} copiada`);
        return;
      }
      setValor(v);
      setRestam(SEGUNDOS_A_MOSTRA);
      setAbertura((n) => n + 1);
    } catch (e) {
      avisar.erro(`Não deu para abrir a ${rotulo.toLowerCase()}`, (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const aberto = valor != null;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span
        className={cn("num min-w-0 truncate", aberto ? "text-tinta select-all" : "tracking-[0.2em] text-apagado")}
        title={aberto ? undefined : `${rotulo} guardada com cifra`}
      >
        {aberto ? valor : "••••••••"}
      </span>
      <SemPropagar className="gap-0.5">
        {aberto ? (
          <BotaoIcone icone="esconder" rotulo={`Esconder a ${rotulo.toLowerCase()}`} linha onClick={esconder} />
        ) : (
          <BotaoIcone
            icone="ver"
            rotulo={`Ver a ${rotulo.toLowerCase()}`}
            linha
            disabled={semChave}
            carregando={ocupado === "ver"}
            onClick={() => abrir("ver")}
          />
        )}
        <BotaoIcone
          icone="copiar"
          rotulo={`Copiar a ${rotulo.toLowerCase()}`}
          linha
          disabled={semChave}
          carregando={ocupado === "copiar"}
          onClick={() => (aberto ? copiarComAviso(valor, `${rotulo} copiada`) : abrir("copiar"))}
        />
        {aberto && restam > 0 && (
          <span className="num w-7 text-right text-pequeno text-apagado" title="Volta à máscara sozinha">
            {restam}s
          </span>
        )}
      </SemPropagar>
    </span>
  );
}

/**
 * O QR do Wi-Fi: o celular aponta a câmera e entra na rede sem digitar a
 * senha. Preto no branco em qualquer tema, de propósito: é o contraste que a
 * câmera lê, e o QR no fundo escuro do tema falha em metade dos celulares.
 */
export function QrWifi({ texto, tamanho = 176 }: { texto: string; tamanho?: number }) {
  const qr = useMemo(() => criarQr(texto, { errorCorrectionLevel: "M" }), [texto]);
  const n = qr.modules.size;
  const margem = 2;
  const lado = n + margem * 2;
  const quadrados: string[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) quadrados.push(`M${x + margem} ${y + margem}h1v1h-1z`);
  return (
    <svg
      viewBox={`0 0 ${lado} ${lado}`}
      width={tamanho}
      height={tamanho}
      role="img"
      aria-label="QR code para entrar no Wi-Fi"
      className="rounded-controle"
      shapeRendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#fff" />
      <path d={quadrados.join("")} fill="#000" />
    </svg>
  );
}

const TOM_EVENTO: Record<EventoAcesso["acao"], string> = {
  criado: "bg-rota-suave text-rota",
  editado: "bg-poco-forte text-tinta-2",
  segredo: "bg-ok-suave text-ok",
  removido: "bg-poco-forte text-tinta-2",
  revelado: "bg-atencao-suave text-atencao",
  copiado: "bg-atencao-suave text-atencao",
  apagado: "bg-perigo-suave text-perigo",
};

/**
 * O registro de um acesso, do mais recente para trás: quem viu, copiou ou
 * trocou a senha, e quem mexeu no cadastro. É o que responde "quem sabia a
 * senha do banco antes de o prestador sair".
 */
export function HistoricoAcesso({ eventos, tipo }: { eventos: EventoAcesso[]; tipo: string }) {
  if (!eventos.length) return <p className="text-corpo text-apagado">Nada registrado ainda.</p>;
  return (
    <ol className="flex flex-col">
      {eventos.map((ev, i) => {
        const f = fraseEvento(ev, tipo);
        const ultima = i === eventos.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-3.5 last:pb-0">
            {!ultima && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-linha" />}
            <span className={cn("z-[1] grid size-7 shrink-0 place-items-center rounded-full", TOM_EVENTO[ev.acao])}>
              <Icone nome={f.icone} tamanho={14} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-corpo font-[560] text-tinta">{f.titulo}</p>
              <p className="num text-pequeno text-apagado">
                {ev.usuario ?? "Alguém sem sessão"} · {dataHoraBR(ev.em)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
