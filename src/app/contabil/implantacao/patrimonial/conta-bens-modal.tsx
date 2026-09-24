"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { brl, num } from "@/lib/format";
import type { ConferenciaConta } from "@/lib/patrimonial-conferencia";
import type { ContaBensCasada } from "@/lib/patrimonial-tipos";
import type { ContaPlano } from "@/lib/types";
import { rotuloSituacao, SITUACAO_DEPARA, VIA_DEPARA } from "../de-para";
import { diferencaDaConta } from "./diferenca";

/**
 * Uma conta do relatório de bens: onde ela entra no Questor e se a soma dos
 * bens bate com o total que o próprio relatório imprime para ela.
 */
export function ContaBensModal({
  conta: c,
  conferencia: conf,
  empresa,
  onConta,
  onVerBens,
  onFechar,
}: {
  conta: ContaBensCasada;
  conferencia: ConferenciaConta;
  empresa: number;
  onConta: (conta: number | null, dados?: ContaPlano) => void;
  onVerBens: () => void;
  onFechar: () => void;
}) {
  const dif = diferencaDaConta(conf);
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={c.descricao}
      descricao={`Conta ${c.chave}${c.classif ? ` · ${c.classif}` : ""} no relatório de bens`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Fechar
          </Botao>
          <Botao variante="secundario" icone="filtrar" onClick={onVerBens}>
            Ver os {num(conf.bens)} bens
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Par rotulo="Situação">
            <Selo tom={SITUACAO_DEPARA[c.status].tom}>{rotuloSituacao(c.status, c.confianca)}</Selo>
          </Par>
          <Par rotulo="Como casou">{c.via ? VIA_DEPARA[c.via] : "Não casou"}</Par>
          <Par rotulo="Valor dos bens">
            <span className="num font-[600]">{brl(conf.lido.valor)}</span>
            {conf.relatorio && <span className="block text-pequeno text-apagado">relatório {brl(conf.relatorio.valor)}</span>}
          </Par>
          <Par rotulo="Depreciação acumulada">
            <span className="num font-[600]">{brl(conf.lido.depreciacao)}</span>
            {conf.relatorio && (
              <span className="block text-pequeno text-apagado">relatório {brl(conf.relatorio.depreciacao)}</span>
            )}
          </Par>
          <Par rotulo="Contra o total do relatório" className="col-span-2 sm:col-span-4">
            {conf.confere === null ? (
              <span className="text-apagado">O relatório não imprime total para esta conta.</span>
            ) : conf.confere ? (
              <Selo tom="ok">Confere</Selo>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Selo tom="perigo">Difere</Selo>
                {dif && <span className="text-pequeno text-apagado italic">{dif}</span>}
              </span>
            )}
          </Par>
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
