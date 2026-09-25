"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { ROTULO_TIPO } from "@/componentes/produto/contabil/regra-extrato";
import { FichaFolha } from "@/componentes/produto/contabil/selo-folha";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { cn } from "@/lib/cn";
import { brl, dataBR } from "@/lib/format";
import type { LancamentoGerado } from "@/lib/regras-extrato";
import type { RegraExtratoDTO } from "@/lib/types";

/** A conta do outro lado do banco: a da regra, ou a escolhida à mão na linha pendente. */
export function contrapartida(l: LancamentoGerado, ajuste: number | null): number | null {
  return (l.sentido === "pagamento" ? l.contaDebito : l.contaCredito) ?? ajuste;
}

/**
 * Débito e crédito do lançamento. Dinheiro que entra debita o banco e credita a
 * contrapartida; dinheiro que sai faz o inverso. O ajuste à mão entra no lado
 * que a contrapartida ocupa.
 */
export function partida(l: LancamentoGerado, ajuste: number | null) {
  const contra = contrapartida(l, ajuste);
  return l.sentido === "pagamento"
    ? { debito: contra, credito: l.contaCredito }
    : { debito: l.contaDebito, credito: contra };
}

/** Uma fonte só para a linha, o detalhe e a planilha exportada. */
export function situacaoLancamento(l: LancamentoGerado, ajuste: number | null): { rotulo: string; tom: Tom } {
  if (l.pendencia && ajuste == null) {
    return l.pendencia === "sem_regra"
      ? { rotulo: "Sem regra", tom: "atencao" }
      : { rotulo: "Regra sem conta", tom: "atencao" };
  }
  if (l.pendencia) return { rotulo: "À mão", tom: "rota" };
  return { rotulo: "Casada", tom: "ok" };
}

/**
 * O detalhe de uma linha do extrato: a partida inteira, de onde veio a conta e
 * quem é o favorecido na folha. Na linha pendente, é também onde se escolhe a
 * contrapartida e se cria a regra; "Próxima pendente" percorre o extrato sem
 * voltar à tabela.
 */
export function LancamentoModal({
  lancamento: l,
  ajuste,
  regra,
  empresa,
  banco,
  onAjustar,
  onCriarRegra,
  onEditarRegra,
  onProxima,
  onFechar,
}: {
  lancamento: LancamentoGerado;
  ajuste: number | null;
  /** A regra que casou a linha, quando casou. */
  regra?: RegraExtratoDTO;
  empresa: number;
  banco: { conta: number; descricao: string | null };
  onAjustar: (conta: number | null) => void;
  onCriarRegra: () => void;
  onEditarRegra: (regra: RegraExtratoDTO) => void;
  onProxima?: () => void;
  onFechar: () => void;
}) {
  const recebimento = l.sentido === "recebimento";
  const p = partida(l, ajuste);
  const descrContra = regra ? (recebimento ? regra.descrRecebimento : regra.descrPagamento) : null;
  const descr = (conta: number | null) =>
    conta == null ? null : conta === banco.conta ? banco.descricao : descrContra;
  const situacao = situacaoLancamento(l, ajuste);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={l.descricao}
      descricao={`${dataBR(l.data)} · ${recebimento ? "Recebimento" : "Pagamento"}`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Fechar
          </Botao>
          {onProxima && (
            <Botao variante="secundario" iconeFim="seta-direita" onClick={onProxima}>
              Próxima pendente
            </Botao>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Par rotulo="Valor">
            <span className={cn("num font-[600]", recebimento ? "text-ok" : "text-tinta")}>
              {recebimento ? "+" : "−"} {brl(l.valor)}
            </span>
          </Par>
          <Par rotulo="Débito">
            <ContaTexto conta={p.debito} descricao={descr(p.debito)} vazio="A escolher" />
          </Par>
          <Par rotulo="Crédito">
            <ContaTexto conta={p.credito} descricao={descr(p.credito)} vazio="A escolher" />
          </Par>
          <Par rotulo="Situação">
            <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
          </Par>
          {l.complemento && (
            <Par rotulo="Complemento no extrato" className="col-span-2 sm:col-span-4">
              {l.complemento}
            </Par>
          )}
          <Par rotulo="Histórico no arquivo" className="col-span-2 sm:col-span-4">
            {l.historico}
          </Par>
        </dl>

        {l.pendencia ? (
          <section className="flex flex-col gap-3 border-t border-linha pt-4">
            <Rotulado
              rotulo={recebimento ? "Contrapartida do recebimento" : "Contrapartida do pagamento"}
              ajuda="Vale só para esta importação. Para as próximas, crie a regra."
            >
              <SeletorConta
                empresa={empresa}
                valor={ajuste}
                onMudar={(c) => onAjustar(c)}
                limpavel
                rotuloAcessivel="Contrapartida"
              />
            </Rotulado>
            <div>
              <Botao variante="secundario" icone="aprender" onClick={onCriarRegra}>
                Criar regra com esta descrição
              </Botao>
            </div>
          </section>
        ) : regra ? (
          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-4">
            <div className="min-w-0">
              <p className="text-pequeno text-apagado">Casou pela regra</p>
              <p className="truncate text-corpo text-tinta">
                {regra.termoOriginal}
                <span className="text-apagado"> · {ROTULO_TIPO[regra.tipo].toLowerCase()}</span>
              </p>
            </div>
            <Botao variante="fantasma" icone="editar" onClick={() => onEditarRegra(regra)}>
              Editar regra
            </Botao>
          </section>
        ) : null}

        {l.ambiguo && (
          <Nota tom="atencao" icone="alerta">
            Outra regra casa com esta descrição com a mesma força. Confira o cadastro da conta.
          </Nota>
        )}

        {l.pessoa && (
          <section className="flex flex-col gap-2 border-t border-linha pt-4">
            <p className="text-pequeno font-[560] text-tinta-2">Favorecido na folha</p>
            <FichaFolha selo={l.pessoa} />
          </section>
        )}
      </div>
    </Modal>
  );
}
