"use client";

import { useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { CamposFormulario } from "@/componentes/produto/rh/campos-formulario";
import { SeloDestinatarioEnvio } from "@/componentes/produto/rh/envio-situacao";
import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";
import type { EnvioDestinatario, EnvioDetalhe, EnvioResumo } from "@/lib/envios";
import { useConsulta } from "@/hooks/use-consulta";

/** Chave do detalhe de um envio (`/api/rh/envios?id=`). */
export const CHAVE_ENVIO = "rh-envio";

type Filtro = "todos" | "responderam" | "faltam";

const nomeDe = (d: EnvioDestinatario) => d.nome || d.email || "Sem nome";

function descricaoEnvio(envio: EnvioResumo): string {
  const quando = envio.disparadoEm
    ? `saiu em ${dataBR(envio.disparadoEm)}`
    : envio.agendadoPara
      ? `agendado para ${dataBR(envio.agendadoPara)}`
      : "ainda não saiu";
  return `${envio.formularioNome}, ${quando}`;
}

/**
 * Quem recebeu um envio e o que cada um respondeu. A resposta abre na própria
 * linha, com as perguntas do formulário em leitura: no celular um segundo
 * painel ao lado não caberia, e comparar duas respostas pede as duas abertas.
 */
export function ModalDetalheEnvio({ envio, onFechar }: { envio: EnvioResumo | null; onFechar: () => void }) {
  // Monta a cada abertura: a consulta só roda com a janela aberta.
  if (!envio) return null;
  return <JanelaDetalhe envio={envio} onFechar={onFechar} />;
}

function JanelaDetalhe({ envio, onFechar }: { envio: EnvioResumo; onFechar: () => void }) {
  // Sem manter o anterior: o detalhe de um envio nunca mostra as pessoas de outro enquanto carrega.
  const res = useConsulta<EnvioDetalhe>(CHAVE_ENVIO, `/api/rh/envios?id=${envio.id}`, { manterAnterior: false });
  let corpo: ReactNode;
  if (res.isError)
    corpo = (
      <PainelErro
        titulo="Não deu para carregar as respostas"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );
  else if (!res.data)
    corpo = (
      <div aria-busy className="flex flex-col gap-2">
        <Esqueleto className="h-controle w-72" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Esqueleto key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  else corpo = <CorpoDetalheEnvio detalhe={res.data} envioSaiu={!!envio.disparadoEm} />;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={envio.titulo}
      descricao={descricaoEnvio(envio)}
      largura="g"
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      {corpo}
    </Modal>
  );
}

/** O mesmo detalhe aberto e parado, para o catálogo. */
export function DetalheEnvioEstatico({ envio, detalhe }: { envio: EnvioResumo; detalhe: EnvioDetalhe }) {
  return (
    <PainelModal
      estatico
      largura="g"
      titulo={envio.titulo}
      descricao={descricaoEnvio(envio)}
      onFechar={() => {}}
      rodape={<Botao>Fechar</Botao>}
    >
      <CorpoDetalheEnvio detalhe={detalhe} envioSaiu={!!envio.disparadoEm} abertoInicial={detalhe.destinatarios.find((d) => d.status === "respondido")?.id} />
    </PainelModal>
  );
}

export function CorpoDetalheEnvio({
  detalhe,
  envioSaiu,
  abertoInicial,
}: {
  detalhe: EnvioDetalhe;
  envioSaiu: boolean;
  /** No catálogo: uma resposta já aberta. */
  abertoInicial?: number;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(abertoInicial != null ? [abertoInicial] : []));

  const todos = [...detalhe.destinatarios].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"));
  const responderam = todos.filter((d) => d.status === "respondido");
  const faltam = todos.filter((d) => d.status !== "respondido");
  const lista = filtro === "responderam" ? responderam : filtro === "faltam" ? faltam : todos;

  const alternar = (id: number) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (!todos.length)
    return <Vazio compacto icone="email" titulo="Este envio não tem destinatários" />;

  let vazio: ReactNode = null;
  if (!lista.length)
    vazio =
      filtro === "faltam" ? (
        <Vazio compacto icone="ok" titulo="Todos já responderam" />
      ) : (
        <Vazio
          compacto
          icone="relogio"
          titulo="Ninguém respondeu ainda"
          descricao={envioSaiu ? undefined : "O envio ainda não saiu."}
        />
      );

  return (
    <div className="flex flex-col gap-3">
      <Segmentado<Filtro>
        rotulo="Quem mostrar"
        valor={filtro}
        onMudar={setFiltro}
        className="self-start"
        opcoes={[
          { valor: "todos", rotulo: <>Todos <span className="num text-apagado">{num(todos.length)}</span></> },
          {
            valor: "responderam",
            rotulo: <>Responderam <span className="num text-apagado">{num(responderam.length)}</span></>,
          },
          { valor: "faltam", rotulo: <>Faltam <span className="num text-apagado">{num(faltam.length)}</span></> },
        ]}
      />
      {vazio ?? (
        <ul className="flex flex-col rounded-controle border border-linha">
          {lista.map((d) => {
            const respondeu = d.status === "respondido";
            const aberto = respondeu && abertos.has(d.id);
            const outraPessoa = d.respondidoPorNome && d.respondidoPorNome.trim() !== (d.nome ?? "").trim();
            const apoio = [
              d.nome ? d.email : null,
              outraPessoa ? `respondido por ${d.respondidoPorNome}` : null,
              respondeu && d.respondidoEm ? `em ${dataBR(d.respondidoEm)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const linha = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-[560] text-tinta">{nomeDe(d)}</span>
                  {apoio && <span className="block truncate text-pequeno text-apagado">{apoio}</span>}
                </span>
                <SeloDestinatarioEnvio status={d.status} envioSaiu={envioSaiu} />
                {respondeu && (
                  <Icone
                    nome="chevron-baixo"
                    tamanho={15}
                    className={cn("text-apagado transition-transform duration-200", aberto && "rotate-180")}
                  />
                )}
              </>
            );
            return (
              <li key={d.id} className="border-b border-linha last:border-0">
                {respondeu ? (
                  <button
                    type="button"
                    aria-expanded={aberto}
                    onClick={() => alternar(d.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-poco"
                  >
                    {linha}
                  </button>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 px-3 py-2">{linha}</div>
                )}
                {aberto && (
                  <div className="border-t border-linha bg-poco px-4 py-4">
                    <CamposFormulario campos={detalhe.formulario.campos} valores={d.valores ?? {}} somenteLeitura />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
