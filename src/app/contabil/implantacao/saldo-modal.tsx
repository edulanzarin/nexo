"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { MarcaNatureza } from "@/componentes/produto/contabil/partida";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { brl } from "@/lib/format";
import type { LinhaCasada } from "@/lib/implantacao-tipos";
import type { ContaPlano } from "@/lib/types";
import { rotuloSituacao, SITUACAO_DEPARA, VIA_DEPARA } from "./de-para";

/**
 * O detalhe de uma conta do balancete anterior: o saldo, como casou e a partida
 * que vai para o arquivo. É aqui que se troca a conta de uma linha já casada; a
 * linha sem conta tem o seletor na própria tabela.
 */
export function SaldoModal({
  linha: c,
  empresa,
  transitoria,
  onConta,
  onProxima,
  onFechar,
}: {
  linha: LinhaCasada;
  empresa: number;
  /** Conta transitória do lote: a contrapartida de todo saldo. */
  transitoria: number | null;
  onConta: (conta: number | null, dados?: ContaPlano) => void;
  onProxima?: () => void;
  onFechar: () => void;
}) {
  // Devedor debita a conta e credita a transitória; credor, o contrário.
  const lado = (qual: "D" | "C") =>
    c.natureza == null ? (
      <span className="text-apagado italic">Natureza indefinida</span>
    ) : c.natureza === qual ? (
      <ContaTexto conta={c.conta} descricao={c.contaDescr} vazio="A escolher" />
    ) : (
      <ContaTexto conta={transitoria} descricao="Transitória" vazio="Falta a transitória" />
    );

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={c.origem.descricao}
      descricao={`Conta ${c.origem.chave}${c.origem.classif ? ` · ${c.origem.classif}` : ""} no balancete anterior`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Fechar
          </Botao>
          {onProxima && (
            <Botao variante="secundario" iconeFim="seta-direita" onClick={onProxima}>
              Próxima a conferir
            </Botao>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Par rotulo="Saldo">
            <span className="flex items-center gap-1.5">
              <span className="num font-[600]">{brl(c.origem.saldo)}</span>
              {c.natureza && <MarcaNatureza natureza={c.natureza === "D" ? 1 : -1} />}
            </span>
          </Par>
          <Par rotulo="Situação">
            <Selo tom={SITUACAO_DEPARA[c.status].tom}>{rotuloSituacao(c.status, c.confianca)}</Selo>
          </Par>
          <Par rotulo="Débito no arquivo">{lado("D")}</Par>
          <Par rotulo="Crédito no arquivo">{lado("C")}</Par>
          {c.via && (
            <Par rotulo="Como casou" className="col-span-2 sm:col-span-4">
              {VIA_DEPARA[c.via]}
            </Par>
          )}
        </dl>
        <Rotulado
          rotulo="Conta no Questor"
          ajuda="A escolha fica salva para esta empresa e vale na próxima leitura."
          className="border-t border-linha pt-4"
        >
          <SeletorConta empresa={empresa} valor={c.conta} onMudar={onConta} limpavel rotuloAcessivel="Conta no Questor" />
        </Rotulado>
      </div>
    </Modal>
  );
}
