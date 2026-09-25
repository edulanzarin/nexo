"use client";

import type { ReactNode } from "react";
import { Esqueleto, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Par } from "@/componentes/primitivos/painel";
import { DataComPrazo } from "@/componentes/produto/folha/prazo-dp";
import { dataBR, dataHoraBR } from "@/lib/format";
import type { Formulario, RespostaValores } from "@/lib/formularios-tipos";
import type { ExperienciaItem } from "@/lib/rh-tipos";
import { SeloEmpresaRh } from "./empresa-rh";
import { DestaqueDecisao, LeituraResposta, rotuloRecomendacao } from "./experiencia-resposta";
import { GestoresSetor, SeloExperiencia, SeloMarco } from "./experiencia-situacao";

/**
 * O que `/api/rh/experiencia-respostas` devolve: o formulário usado no marco e
 * o que o gestor respondeu. Mesmo formato de `RespostaExperienciaDetalhe`, que
 * mora no lado servidor e não pode entrar no bundle.
 */
export interface RespostaExperiencia {
  formulario: Formulario;
  respondidoPorNome: string | null;
  respondidoEm: string | null;
  valores: RespostaValores;
}

/**
 * Resposta gravada antes do editor de formulários: a recomendação vinha numa
 * coluna própria e não há formulário para desenhar. A tela nem pede o detalhe
 * dela, porque a rota responde "não encontrada".
 */
export function ehRespostaLegada(item: ExperienciaItem): boolean {
  return !!item.resposta?.legada;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-linha pt-4">
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * O detalhe de um marco de experiência, para o modal que a linha abre: a
 * pessoa, o prazo, quem recebe e, quando respondido, a resposta do gestor em
 * leitura, com a decisão no topo.
 */
export function CorpoExperiencia({
  item,
  resposta,
  erroResposta,
  onTentarResposta,
  confirmandoRemocao,
}: {
  item: ExperienciaItem;
  /** Indefinido enquanto carrega (ou quando não há o que carregar). */
  resposta?: RespostaExperiencia;
  erroResposta?: string | null;
  onTentarResposta?: () => void;
  /** A remoção foi pedida e espera a confirmação no rodapé. */
  confirmandoRemocao?: boolean;
}) {
  const respondido = item.status === "respondido";
  const legada = respondido && ehRespostaLegada(item) ? item.resposta : null;
  const semRegistro = <span className="text-apagado">Não informado</span>;

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Par rotulo="Empresa">
          <SeloEmpresaRh codigo={item.codigoempresa} />
        </Par>
        <Par rotulo="Cargo">{item.cargo ?? semRegistro}</Par>
        <Par rotulo="Setor">{item.setor ?? semRegistro}</Par>
        <Par rotulo="Admissão">
          <span className="num">{dataBR(item.dataadm)}</span>
        </Par>
        <Par rotulo="Marco">
          <SeloMarco marco={item.marco} />
        </Par>
        <Par rotulo="Vencimento">
          {/* Respondido, o prazo não conta mais: fica só a data. */}
          <DataComPrazo data={item.vencimento} dias={respondido ? null : item.diasParaVencer} />
        </Par>
        <Par rotulo="Situação">
          <SeloExperiencia status={item.status} />
        </Par>
        <Par rotulo="Quem recebe">
          <GestoresSetor n={item.gestores} />
        </Par>
        <Par rotulo="Último envio">
          {item.ultimoLembrete ? (
            <span className="num">{dataHoraBR(item.ultimoLembrete)}</span>
          ) : (
            <span className="text-apagado">Nenhum</span>
          )}
        </Par>
      </dl>

      {confirmandoRemocao && (
        <Nota tom="perigo" icone="alerta">
          A resposta e o histórico de envios deste marco são apagados, e ele volta para a fila aguardando disparo.
        </Nota>
      )}

      {respondido ? (
        <Secao titulo="Resposta do Gestor">
          {legada ? (
            <div className="flex flex-col gap-3">
              <p className="text-pequeno text-apagado">
                Respondido por <span className="font-[560] text-tinta-2">{legada.respondidoPor || "—"}</span>
                {legada.respondidoEm && <span className="num"> em {dataHoraBR(legada.respondidoEm)}</span>}
              </p>
              <DestaqueDecisao
                decisao={{ pergunta: "Recomendação", resposta: rotuloRecomendacao(legada.recomendacao) ?? "" }}
              />
              {legada.comentarios && (
                <p className="rounded-controle border border-linha bg-poco px-2.5 py-2 text-corpo whitespace-pre-wrap text-tinta">
                  {legada.comentarios}
                </p>
              )}
              <Nota>Resposta anterior ao editor de formulários, sem as perguntas.</Nota>
            </div>
          ) : erroResposta ? (
            <PainelErro titulo="Não deu para abrir a resposta" mensagem={erroResposta} onTentar={onTentarResposta} />
          ) : !resposta ? (
            <div aria-busy className="flex flex-col gap-3">
              <Esqueleto className="h-3.5 w-56" />
              <Esqueleto className="h-12 w-full" />
              <Esqueleto className="h-24 w-full" />
            </div>
          ) : (
            <LeituraResposta
              campos={resposta.formulario.campos}
              valores={resposta.valores}
              nome={resposta.respondidoPorNome}
              em={resposta.respondidoEm}
            />
          )}
        </Secao>
      ) : (
        <Nota>O link é um só para os gestores do setor. A primeira resposta fecha a avaliação.</Nota>
      )}
    </div>
  );
}
