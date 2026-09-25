"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { dataBR, dataHoraBR, documento, num } from "@/lib/format";
import type { EntregaFila } from "@/lib/obrigacoes-tipos";
import { SeloAtraso } from "./fila-atraso";
import { documentoValido, useConsultaAcessorias, type ResultadoConsulta } from "./fila-consulta";
import { nomeResponsavel } from "./fila-tabelas";

/*
 * Uma entrega aberta. A linha da fila é enxuta; aqui aparece o que ela não
 * carrega (o par no Questor, a situação que o Acessórias dá) e a pergunta que
 * quem abre costuma ter: isso ainda está pendente? A consulta da empresa
 * responde na hora e, se a entrega saiu da fila do Acessórias, diz isso em vez
 * de mostrar o retrato velho como se fosse de agora.
 */

/** O Acessórias escreve "Atrasada!"; a exclamação é dele, não um dado. */
const situacao = (s: string) => s.replace(/!+$/, "");

export function CorpoEntregaFila({
  entrega,
  resultado,
  erro,
  comSetor = true,
}: {
  entrega: EntregaFila;
  /** Resposta da consulta da empresa, quando já feita. */
  resultado?: ResultadoConsulta | null;
  erro?: string | null;
  comSetor?: boolean;
}) {
  // Depois da consulta, a ficha mostra a entrega como o Acessórias a devolveu agora.
  const agora = resultado?.fila.find((e) => e.entId === entrega.entId);
  const e = agora ?? entrega;
  const saiu = resultado != null && !agora;
  const outras = resultado ? resultado.fila.length - (agora ? 1 : 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      {erro && <PainelErro titulo="Não deu para consultar o Acessórias" mensagem={erro} />}
      {resultado && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {saiu ? (
              <Selo tom="ok" icone="ok">
                Não está mais pendente no Acessórias
              </Selo>
            ) : (
              <Selo tom="atencao" icone="relogio">
                Continua pendente no Acessórias
              </Selo>
            )}
            <span className="num text-pequeno text-apagado">Consultado em {dataHoraBR(resultado.em)}</span>
          </div>
          <Nota>
            {outras > 0 &&
              `${saiu ? "A empresa ainda tem" : "A empresa tem mais"} ${num(outras)} ${
                outras === 1 ? "entrega pendente" : "entregas pendentes"
              } nesta seção. `}
            A fila já foi atualizada com esta consulta.
          </Nota>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Par rotulo="Empresa" className="sm:col-span-2">
          {e.empresa} <span className="num text-apagado">{documento(e.cnpj)}</span>
        </Par>
        <Par rotulo="No Questor">
          {e.codigoempresa != null ? (
            <span className="num">Empresa {e.codigoempresa}</span>
          ) : (
            <span className="text-apagado">Sem par no Questor</span>
          )}
        </Par>
        {comSetor && <Par rotulo="Setor no Acessórias">{e.dptoNome}</Par>}
        <Par rotulo="Competência">
          <span className="num">{dataBR(e.competencia)}</span>
        </Par>
        <Par rotulo="Prazo">
          <span className="num">{dataBR(e.prazo)}</span>
        </Par>
        <Par rotulo="Atraso">
          <SeloAtraso dias={e.diasAtraso} />
        </Par>
        <Par rotulo="Multa">
          {e.multa ? <Selo tom="perigo">Com multa</Selo> : <span className="text-apagado">Sem multa</span>}
        </Par>
        <Par rotulo="Situação no Acessórias">{situacao(e.status)}</Par>
        <Par rotulo="Responsável">
          {nomeResponsavel(e.respNome) ?? <span className="text-apagado">Sem responsável</span>}
        </Par>
      </dl>
    </div>
  );
}

/**
 * A janela da entrega. Quem abre deve remontá-la a cada entrega (`key`): a
 * resposta da consulta é daquela empresa e não pode sobrar na próxima.
 */
export function ModalEntregaFila({
  entrega,
  secao,
  comSetor,
  onFechar,
}: {
  entrega: EntregaFila | null;
  secao: string;
  comSetor?: boolean;
  onFechar: () => void;
}) {
  const consulta = useConsultaAcessorias(secao);
  return (
    <Modal
      aberto={entrega != null}
      onFechar={onFechar}
      titulo={entrega?.obrigacao ?? ""}
      descricao={entrega?.empresa}
      rodape={
        entrega && (
          <>
            <Botao variante="fantasma" onClick={onFechar}>
              Fechar
            </Botao>
            <Botao
              variante="primario"
              icone="atualizar"
              carregando={consulta.buscando}
              disabled={!documentoValido(entrega.cnpj)}
              onClick={() => consulta.consultar(entrega.cnpj)}
            >
              Consultar no Acessórias
            </Botao>
          </>
        )
      }
    >
      {entrega && (
        <CorpoEntregaFila
          entrega={entrega}
          resultado={consulta.resultado}
          erro={consulta.erro}
          comSetor={comSetor}
        />
      )}
    </Modal>
  );
}
