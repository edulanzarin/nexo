"use client";

import { useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { brl, brlCompact, decimal, num, pct } from "@/lib/format";
import type { Metrica, TopItem } from "@/lib/types";
import { COR_LADO, ROTULO_LADO, SeletorLado, type Lado } from "./lado";

/** Como se conta a quantidade do ranking, no singular e no plural. */
export interface Contagem {
  singular: string;
  plural: string;
}

const NOTAS: Contagem = { singular: "nota", plural: "notas" };

/** O que o painel sabe medir, para a linha, a dica e o detalhe falarem a mesma língua. */
interface Medida {
  metrica: Metrica;
  rotuloValor: string;
  rotuloQtd: string;
  contagem: Contagem;
  qtdFisica: boolean;
}

const qtdCurta = (m: Medida, n: number) => (m.qtdFisica ? decimal(n, 2) : num(n));

/** "12.345 notas", "1 item", "Qtd. 1.234,5": a quantidade com a unidade dela. */
function contar(m: Medida, n: number): string {
  if (m.qtdFisica) return `Qtd. ${decimal(n, 2)}`;
  return `${num(n)} ${n === 1 ? m.contagem.singular : m.contagem.plural}`;
}

/**
 * O corpo do detalhe de uma linha, exportado para o catálogo mostrar o modal
 * aberto com a mesma peça que a tela usa.
 */
export function CorpoItemRanking({
  item,
  posicao,
  total,
  somaLista,
  metrica = "valor",
  rotuloValor = "Valor contábil",
  rotuloQtd = "Notas",
  rotuloMedio,
  qtdFisica = false,
}: {
  item: TopItem;
  /** Posição na lista (1 é o primeiro). Sem ela, a lista é ordinal e não há "primeiro". */
  posicao?: number;
  /** Só quando a lista é o universo todo: "3º de 10" num top 10 sugere que só há dez. */
  total?: number;
  /** A soma da lista inteira, quando ela é o universo todo (faixas, frete, UF). */
  somaLista?: number;
  metrica?: Metrica;
  rotuloValor?: string;
  rotuloQtd?: string;
  /** "Ticket médio", "Valor médio por item". Sem rótulo, a média não aparece. */
  rotuloMedio?: string;
  qtdFisica?: boolean;
}) {
  const medido = metrica === "valor" ? item.valor : item.qtd;
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {posicao != null && (
        <Par rotulo="Posição">
          <span className="num">
            {num(posicao)}º{total != null && ` de ${num(total)}`}
          </span>
        </Par>
      )}
      <Par rotulo={rotuloValor}>
        <span className={metrica === "valor" ? "num font-[600]" : "num"}>{brl(item.valor)}</span>
      </Par>
      <Par rotulo={rotuloQtd}>
        <span className={metrica === "qtd" ? "num font-[600]" : "num"}>
          {qtdFisica ? decimal(item.qtd, 2) : num(item.qtd)}
        </span>
      </Par>
      {rotuloMedio && (
        <Par rotulo={rotuloMedio}>
          <span className="num">{item.qtd > 0 ? brl(item.valor / item.qtd) : "—"}</span>
        </Par>
      )}
      {somaLista != null && (
        <Par rotulo="Participação">
          <span className="num">{pct(somaLista > 0 ? (medido / somaLista) * 100 : null)}</span>
        </Par>
      )}
    </dl>
  );
}

/**
 * Um ranking do Fiscal: quem mais vendeu, que CFOP mais saiu, de que UF vêm os
 * fornecedores. A barra mede a métrica do módulo (valor ou quantidade) e a
 * outra vai ao lado dela, em miúdo, então trocar a métrica reordena sem apagar
 * o que a linha dizia. A cor é a do lado, fixa no módulo.
 *
 * Por baixo é a `PainelQuebra` da Produtividade (barras horizontais, esqueleto,
 * o "mostrando N de M"); aqui entram o seletor do lado, o erro no lugar do
 * corpo e o detalhe da linha em modal, com o valor cheio que a barra abrevia.
 */
export function PainelRanking({
  titulo,
  descricao,
  itens,
  metrica,
  lado,
  onLado,
  carregando,
  erro,
  onTentar,
  rotuloValor = "Valor contábil",
  rotuloQtd = "Notas",
  contagem = NOTAS,
  qtdFisica = false,
  rotuloMedio,
  detalhe,
  ordinal = false,
  completa = false,
  limite = 12,
  vazio,
  rodape,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  itens: TopItem[] | undefined;
  metrica: Metrica;
  lado: Lado;
  /** Sem ele o painel mede um lado fixo e não mostra o seletor. */
  onLado?: (lado: Lado) => void;
  carregando?: boolean;
  /** Mensagem do servidor. Com ela, o corpo vira o erro e o seletor continua. */
  erro?: string | null;
  onTentar?: () => void;
  rotuloValor?: string;
  rotuloQtd?: string;
  contagem?: Contagem;
  /** Quantidade física (KG, UN), com casas decimais. */
  qtdFisica?: boolean;
  rotuloMedio?: string;
  /** Troca o miúdo ao lado da barra (o padrão é a outra métrica). */
  detalhe?: (item: TopItem) => string;
  /** A ordem é o dado (faixas de valor): o detalhe não fala em posição. */
  ordinal?: boolean;
  /** A lista é o universo todo, e o detalhe mostra a participação de cada linha. */
  completa?: boolean;
  limite?: number;
  vazio?: ReactNode;
  rodape?: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState<TopItem | null>(null);
  const m: Medida = { metrica, rotuloValor, rotuloQtd, contagem, qtdFisica };
  const medir = (i: TopItem) => (metrica === "valor" ? i.valor : i.qtd);

  const seletor = onLado ? <SeletorLado lado={lado} onMudar={onLado} /> : undefined;
  if (erro)
    return (
      <div className={className}>
        <Painel titulo={titulo} descricao={descricao} acoes={seletor}>
          <PainelErro mensagem={erro} onTentar={onTentar} />
        </Painel>
      </div>
    );

  // O nome leva o complemento do item (a UF do município, a unidade do
  // produto): a linha trunca, e o modal mostra inteiro.
  const quebra: ItemQuebra[] | undefined = itens?.map((i, k) => ({
    chave: String(k),
    nome: i.detalhe ? `${i.nome} · ${i.detalhe}` : i.nome,
    qtd: medir(i),
    cor: COR_LADO[lado],
    detalhe: detalhe ? detalhe(i) : metrica === "valor" ? contar(m, i.qtd) : brlCompact(i.valor),
  }));

  const sobra = itens && itens.length > limite;
  const notas =
    sobra || rodape ? (
      <div className="flex flex-col gap-1">
        {sobra && (
          <Nota>
            Mostrando {num(limite)} de {num(itens.length)}. A lista inteira sai na exportação.
          </Nota>
        )}
        {rodape}
      </div>
    ) : undefined;

  const indice = aberto && itens ? itens.indexOf(aberto) : -1;
  const somaLista = completa && itens ? itens.reduce((s, i) => s + medir(i), 0) : undefined;

  return (
    <div className={className}>
      <PainelQuebra
        titulo={titulo}
        descricao={descricao}
        acoes={seletor}
        itens={quebra}
        formatar={(v) => (metrica === "valor" ? brlCompact(v) : qtdCurta(m, v))}
        limite={limite}
        carregando={carregando}
        vazio={vazio ?? (lado === "ent" ? "Nenhuma nota de entrada no recorte." : "Nenhuma nota de saída no recorte.")}
        aoClicar={(q) => setAberto(itens?.[Number(q.chave)] ?? null)}
        selecionado={indice >= 0 ? String(indice) : null}
        rodape={notas}
      />
      <Modal
        aberto={aberto != null}
        onFechar={() => setAberto(null)}
        titulo={aberto?.nome ?? ""}
        descricao={[aberto?.detalhe, ROTULO_LADO[lado]].filter(Boolean).join(" · ")}
        rodape={<Botao onClick={() => setAberto(null)}>Fechar</Botao>}
      >
        {aberto && (
          <CorpoItemRanking
            item={aberto}
            posicao={ordinal || indice < 0 ? undefined : indice + 1}
            total={completa ? itens?.length : undefined}
            somaLista={somaLista}
            metrica={metrica}
            rotuloValor={rotuloValor}
            rotuloQtd={rotuloQtd}
            rotuloMedio={rotuloMedio}
            qtdFisica={qtdFisica}
          />
        )}
      </Modal>
    </div>
  );
}
