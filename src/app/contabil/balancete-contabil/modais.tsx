"use client";

import { useMemo } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { CelulaConta, ValorConta } from "@/componentes/produto/contabil/balancete/arvore-contas";
import { pct } from "@/lib/format";
import type { AnomaliaConta, BalanceteContabilLinha } from "@/lib/types";

/** A frase do sinal trocado, dita pela natureza da conta. */
export function fraseAtipica(natureza: "D" | "C"): string {
  return natureza === "D" ? "Conta devedora com saldo credor." : "Conta credora com saldo devedor.";
}

/**
 * Detalhe de uma conta do balancete. Na sintética, a composição pelas filhas
 * diretas: é a pergunta que vem logo depois de ver o total do grupo.
 */
export function ModalConta({
  linha,
  linhas,
  atipica,
  onFechar,
  onConta,
}: {
  linha: BalanceteContabilLinha | null;
  linhas: BalanceteContabilLinha[];
  atipica: boolean;
  onFechar: () => void;
  onConta: (l: BalanceteContabilLinha) => void;
}) {
  const filhas = useMemo(
    () =>
      linha?.sintetica
        ? linhas.filter((l) => l.nivel === linha.nivel + 1 && l.classif.startsWith(`${linha.classif}.`))
        : [],
    [linha, linhas]
  );
  // Participação de cada filha no saldo atual do grupo, pela magnitude: o grupo
  // pode somar filhas de sinal trocado, e a parte de cada uma é o tamanho dela.
  const baseFilhas = filhas.reduce((s, f) => s + Math.abs(f.saldoAtual), 0);

  const colunas: Coluna<BalanceteContabilLinha>[] = [
    { id: "conta", cabecalho: "Conta", celula: (l) => <CelulaConta linha={l} recuar={false} /> },
    {
      id: "debito",
      cabecalho: "Débito",
      alinhar: "dir",
      largura: "128px",
      secundaria: true,
      ordenar: (l) => l.debito,
      celula: (l) => <ValorConta valor={l.debito} />,
    },
    {
      id: "credito",
      cabecalho: "Crédito",
      alinhar: "dir",
      largura: "128px",
      secundaria: true,
      ordenar: (l) => l.credito,
      celula: (l) => <ValorConta valor={l.credito} />,
    },
    {
      id: "atual",
      cabecalho: "Saldo atual",
      alinhar: "dir",
      largura: "150px",
      ordenar: (l) => Math.abs(l.saldoAtual),
      celula: (l) => <ValorConta valor={l.saldoAtual} natureza forte={l.sintetica} />,
    },
    {
      id: "parte",
      cabecalho: "Parte",
      alinhar: "dir",
      largura: "72px",
      ordenar: (l) => Math.abs(l.saldoAtual),
      classe: "text-apagado",
      celula: (l) => (baseFilhas > 0 ? pct((Math.abs(l.saldoAtual) / baseFilhas) * 100) : "—"),
    },
  ];

  return (
    <Modal
      aberto={linha != null}
      onFechar={onFechar}
      largura={linha?.sintetica ? "g" : "m"}
      titulo={linha ? `${linha.conta} · ${linha.descricao}` : ""}
      descricao={
        linha ? (
          <span className="num">
            {linha.classif} · nível {linha.nivel} · {linha.sintetica ? "sintética" : "analítica"}
          </span>
        ) : undefined
      }
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      {linha && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Par rotulo="Saldo anterior">
              <ValorConta valor={linha.saldoAnterior} natureza />
            </Par>
            <Par rotulo="Débito do período">
              <ValorConta valor={linha.debito} />
            </Par>
            <Par rotulo="Crédito do período">
              <ValorConta valor={linha.credito} />
            </Par>
            <Par rotulo="Saldo atual">
              <ValorConta valor={linha.saldoAtual} natureza forte />
            </Par>
            <Par rotulo="Natureza">{linha.natureza === "D" ? "Devedora" : "Credora"}</Par>
            <Par rotulo="Código">
              <span className="num">{String(linha.conta)}</span>
            </Par>
          </dl>
          {atipica && (
            <div className="flex flex-wrap items-center gap-2">
              <Selo tom="atencao" icone="alerta">
                Sinal atípico
              </Selo>
              <span className="text-corpo text-tinta-2">{fraseAtipica(linha.natureza)}</span>
            </div>
          )}
          {linha.sintetica && (
            <div className="flex flex-col gap-2">
              <p className="text-pequeno font-[600] text-tinta-2">Composição pelas filhas diretas</p>
              <div className="overflow-hidden rounded-controle border border-linha">
                <TabelaDados
                  rotulo="Filhas diretas"
                  colunas={colunas}
                  linhas={filhas}
                  chave={(l) => `${l.classif}:${l.conta}`}
                  onLinha={onConta}
                  ordemInicial={{ coluna: "atual", sentido: "desc" }}
                  vazio={<p className="py-6 text-center text-corpo text-apagado italic">Nenhuma filha com saldo ou movimento.</p>}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** As contas de sinal atípico, todas, maior saldo primeiro. */
export function ModalAtipicas({
  aberto,
  atipicas,
  onFechar,
  onConta,
}: {
  aberto: boolean;
  atipicas: AnomaliaConta[];
  onFechar: () => void;
  onConta: (a: AnomaliaConta) => void;
}) {
  const colunas: Coluna<AnomaliaConta>[] = [
    {
      id: "conta",
      cabecalho: "Conta",
      celula: (a) => (
        <CelulaConta
          linha={{ conta: a.conta, classif: a.classif, descricao: a.descricao, nivel: 1, sintetica: false }}
          recuar={false}
        />
      ),
    },
    {
      id: "natureza",
      cabecalho: "Natureza",
      largura: "110px",
      ordenar: (a) => a.natureza,
      celula: (a) => <span className="text-apagado">{a.natureza === "D" ? "Devedora" : "Credora"}</span>,
    },
    {
      id: "saldo",
      cabecalho: "Saldo atual",
      alinhar: "dir",
      largura: "160px",
      ordenar: (a) => Math.abs(a.saldoFinal),
      celula: (a) => <ValorConta valor={a.saldoFinal} natureza forte />,
    },
  ];
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      largura="g"
      corpo="p-0"
      titulo="Contas com Sinal Atípico"
      descricao="Devedoras com saldo credor e credoras com saldo devedor"
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <div className="px-5 py-3">
        <Nota>Contas redutoras ficam de fora: o sinal trocado é o normal delas.</Nota>
      </div>
      <TabelaDados
        rotulo="Contas com Sinal Atípico"
        colunas={colunas}
        linhas={atipicas}
        chave={(a) => `${a.classif}:${a.conta}`}
        onLinha={onConta}
        ordemInicial={{ coluna: "saldo", sentido: "desc" }}
      />
    </Modal>
  );
}
