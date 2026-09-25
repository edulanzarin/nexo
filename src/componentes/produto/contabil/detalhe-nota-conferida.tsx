"use client";

import type { ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { BlocoDetalhe, DestaqueDetalhe, legendaNota } from "@/componentes/produto/notas/bloco-detalhe";
import { TituloNota } from "@/componentes/produto/notas/detalhe-nota";
import { ItensNota } from "@/componentes/produto/notas/itens-nota";
import { brl, dataBR, num } from "@/lib/format";
import type { NotaConferida, TipoDivergencia } from "@/lib/types";
import { MarcaNatureza } from "./partida";
import { SeloSituacao } from "./situacao-nota";

const DIVERGENCIA: Record<TipoDivergencia, string> = {
  conta: "Conta fora do plano",
  faltando: "Lançamento faltando",
  valor: "Valor divergente",
  natureza: "Natureza invertida",
  extra: "Lançamento extra",
};

/** "a", "a e b", "a, b e c". */
function emLista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * O corpo do detalhe de uma nota conferida: o resumo, o fato que explica a
 * situação (duplicidade, bloco), as divergências contra o plano e os itens.
 * Serve a Conferência e a Central de Pendências. Os itens entram por fora: na
 * tela vêm da API, no catálogo vêm de mentira.
 */
export function CorpoNotaConferida({
  nota,
  itens,
  extra,
}: {
  nota: NotaConferida;
  itens: ReactNode;
  /** Algo da tela que abriu o detalhe (a triagem, na Central de Pendências). */
  extra?: ReactNode;
}) {
  const dup = nota.duplicidade;
  const cons = nota.consolidacao;
  const nomeConta = new Map((cons?.contas ?? []).map((c) => [c.conta, c.descr]));
  const conta = (c: number | null, natureza: 1 | -1) =>
    c == null ? null : (
      <span className="inline-flex min-w-0 items-center gap-1">
        <MarcaNatureza natureza={natureza} />
        <span className="num text-tinta-2">{c}</span>
        {nomeConta.get(c) && <span className="truncate">{nomeConta.get(c)}</span>}
      </span>
    );

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Par rotulo="Situação">
          <SeloSituacao situacao={nota.situacao} />
        </Par>
        <Par rotulo="Valor">
          <span className="num font-[600]">{brl(nota.valor)}</span>
        </Par>
        <Par rotulo="CFOP">
          <span className="num">{nota.cfops.join(", ") || "Sem CFOP"}</span>
        </Par>
        <Par rotulo="Lançamentos">
          <span className="num">{num(nota.lancamentos)}</span>
        </Par>
      </dl>

      {dup && (
        <DestaqueDetalhe tom="perigo" icone="copiar" titulo="Contabilizada em Duplicidade">
          Lançada <span className="num font-[600] text-tinta">{num(dup.vezes)} vezes</span> com a mesma partida, em{" "}
          <span className="num">{emLista(dup.datas.map(dataBR))}</span>.{" "}
          <span className="num font-[600] text-tinta">{brl(dup.valor)}</span> lançado a mais.
        </DestaqueDetalhe>
      )}

      {cons && (
        <DestaqueDetalhe tom="rota" icone="camadas" titulo="Contabilizada em Bloco">
          <p>Sem lançamento por nota: a venda entra na consolidação do varejo (origem MOV).</p>
          {cons.lancamentos.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {cons.lancamentos.map((l, i) => (
                <li key={i} className="flex flex-col gap-0.5 rounded-controle bg-vidro-forte px-3 py-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="num text-pequeno text-tinta-2">
                      {dataBR(l.data)} <span className="text-apagado">· {l.origem}</span>
                    </span>
                    <span className="num text-corpo font-[600] text-tinta">{brl(l.valor)}</span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 text-pequeno text-apagado">
                    {conta(l.contaDeb, 1)}
                    {conta(l.contaCred, -1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cons.qtd > cons.lancamentos.length && (
            <p className="num mt-1.5 text-pequeno text-apagado">
              Mais {num(cons.qtd - cons.lancamentos.length)} lançamentos de consolidação cobrem essas contas.
            </p>
          )}
        </DestaqueDetalhe>
      )}

      {nota.divergencias.length > 0 && (
        <BlocoDetalhe titulo={`Divergências contra o plano (${num(nota.divergencias.length)})`}>
          <ul className="flex flex-col gap-1.5">
            {nota.divergencias.map((d, i) => (
              <li key={i} className="flex items-baseline gap-2 text-corpo text-tinta-2">
                <MarcaNatureza natureza={d.natureza} className="w-3 shrink-0" />
                <span>
                  <span className="text-apagado">{DIVERGENCIA[d.tipo]}:</span> {d.detalhe}
                </span>
              </li>
            ))}
          </ul>
        </BlocoDetalhe>
      )}

      {extra}

      <BlocoDetalhe titulo="Itens da Nota">{itens}</BlocoDetalhe>
    </div>
  );
}

/**
 * Detalhe de uma nota da Conferência, no clique da linha. Os itens vêm da rota
 * do Contábil, que registra a abertura na trilha.
 */
export function DetalheNotaConferida({
  nota,
  tipo,
  empresa,
  onFechar,
  extra,
  rodape,
}: {
  nota: NotaConferida | null;
  tipo: "ent" | "sai";
  empresa: number;
  onFechar: () => void;
  extra?: ReactNode;
  /** Troca o rodapé padrão (Fechar) pelas ações de quem abriu. */
  rodape?: ReactNode;
}) {
  return (
    <Modal
      aberto={nota != null}
      onFechar={onFechar}
      largura="xg"
      titulo={nota ? <TituloNota contraparte={nota.contraparte} /> : ""}
      descricao={nota ? legendaNota(nota) : undefined}
      rodape={
        rodape ?? (
          <Botao variante="fantasma" onClick={onFechar}>
            Fechar
          </Botao>
        )
      }
    >
      {nota && (
        <CorpoNotaConferida
          nota={nota}
          extra={extra}
          itens={<ItensNota key={nota.chave} modulo="contabil" tipo={tipo} empresa={empresa} chave={nota.chave} />}
        />
      )}
    </Modal>
  );
}
