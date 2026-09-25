"use client";

import { useState, type ReactNode } from "react";
import { Abas } from "@/componentes/primitivos/abas";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Par } from "@/componentes/primitivos/painel";
import { dataBR, num } from "@/lib/format";
import type { RespostaValores } from "@/lib/formularios-tipos";
import type { DesempenhoDetalhe, DesempenhoItem } from "@/lib/rh-tipos";
import { SeloEmpresaRh } from "./empresa-rh";
import { LeituraResposta } from "./experiencia-resposta";
import { GestoresSetor } from "./experiencia-situacao";
import { SeloDesempenho, SeloEncerrada, textoCobrancas } from "./desempenho-situacao";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-linha pt-4">
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

/** Por que ainda não há resposta, dito pelo estado da avaliação. */
function motivoSemResposta(i: DesempenhoItem): string {
  if (i.encerradoEm) return "A avaliação foi encerrada sem resposta. Reabra para o link voltar a aceitar.";
  if (i.gestores === 0) return "O setor não tem gestor cadastrado e o link não chegou a ninguém.";
  if (i.status !== "enviado") return "O envio não saiu. Reenvie aos gestores do setor.";
  return `O link está com ${num(i.gestores)} ${i.gestores === 1 ? "gestor" : "gestores"} do setor.`;
}

/**
 * O detalhe de uma avaliação de desempenho: sobre quem, de qual rodada, quem
 * recebe e as respostas. Cada gestor responde a sua, então há uma aba por
 * resposta, com a decisão no topo de cada uma; a linha da lista só diz quantas.
 *
 * O detalhe da rota (`?id=`) só é pedido quando há resposta: sem ela, tudo o que
 * o modal mostra já veio na linha.
 */
export function CorpoDesempenho({
  item,
  detalhe,
  erro,
  onTentar,
  confirmandoRemocao,
}: {
  item: DesempenhoItem;
  /** Indefinido enquanto carrega. */
  detalhe?: DesempenhoDetalhe;
  erro?: string | null;
  onTentar?: () => void;
  confirmandoRemocao?: boolean;
}) {
  const [aba, setAba] = useState<string | null>(null);
  const respostas = detalhe?.respostas ?? [];
  const ativa = respostas.find((r) => String(r.id) === aba) ?? respostas[0];
  const semRegistro = <span className="text-apagado">Não informado</span>;

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Par rotulo="Empresa">
          <SeloEmpresaRh codigo={item.codigoempresa} />
        </Par>
        <Par rotulo="Cargo">{item.cargo ?? semRegistro}</Par>
        <Par rotulo="Setor">{item.setor ?? semRegistro}</Par>
        <Par rotulo="Rodada">
          <span className="block truncate" title={item.rodadaTitulo}>
            {item.rodadaTitulo}
          </span>
        </Par>
        <Par rotulo="Formulário">
          <span className="block truncate" title={item.formularioNome}>
            {item.formularioNome}
          </span>
        </Par>
        <Par rotulo="Enviada">
          {item.enviadoEm ? <span className="num">{dataBR(item.enviadoEm)}</span> : <span className="text-apagado">Não saiu</span>}
        </Par>
        <Par rotulo="Situação">
          <span className="flex flex-wrap items-center gap-1.5">
            <SeloDesempenho status={item.status} />
            {item.encerradoEm && <SeloEncerrada em={item.encerradoEm} />}
          </span>
        </Par>
        <Par rotulo="Quem recebe">
          <GestoresSetor n={item.gestores} />
        </Par>
        <Par rotulo="Cobranças">
          <span className="num">{textoCobrancas(item)}</span>
        </Par>
      </dl>

      {confirmandoRemocao && (
        <Nota tom="perigo" icone="alerta">
          {item.respostas > 0
            ? `A avaliação sai da rodada com ${item.respostas === 1 ? "a resposta" : `as ${num(item.respostas)} respostas`}.`
            : "A avaliação sai da rodada."}{" "}
          Se era a última, a rodada some junto.
        </Nota>
      )}

      <Secao titulo="Respostas dos Gestores">
        {item.respostas === 0 ? (
          <div className="rounded-controle border border-linha">
            <Vazio compacto icone="pendente" titulo="Nenhum gestor respondeu ainda" descricao={motivoSemResposta(item)} />
          </div>
        ) : erro ? (
          <PainelErro titulo="Não deu para abrir as respostas" mensagem={erro} onTentar={onTentar} />
        ) : !detalhe ? (
          <div aria-busy className="flex flex-col gap-3">
            <Esqueleto className="h-9 w-64" />
            <Esqueleto className="h-12 w-full" />
            <Esqueleto className="h-24 w-full" />
          </div>
        ) : !ativa ? (
          <Vazio compacto icone="pendente" titulo="Nenhum gestor respondeu ainda" descricao={motivoSemResposta(item)} />
        ) : (
          <div className="flex flex-col gap-4">
            {respostas.length > 1 && (
              <Abas
                rotulo="Respostas por gestor"
                ativa={String(ativa.id)}
                onMudar={setAba}
                itens={respostas.map((r) => ({ chave: String(r.id), rotulo: r.nome }))}
              />
            )}
            <LeituraResposta
              key={ativa.id}
              campos={detalhe.formulario.campos}
              valores={ativa.valores as RespostaValores}
              nome={ativa.nome}
              email={ativa.email}
              em={ativa.respondidoEm}
            />
          </div>
        )}
      </Secao>
    </div>
  );
}
