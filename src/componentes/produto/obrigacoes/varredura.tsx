"use client";

import type { ReactNode } from "react";
import { BarraProporcao } from "@/componentes/primitivos/barra";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Girando, Nota, Vazio } from "@/componentes/primitivos/estados";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador, type Tom } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { dataBR, dataHoraBR, horas, num, pct } from "@/lib/format";
// Só o tipo: a lib é do servidor, e `import type` some no build.
import type { EstadoVarredura } from "@/lib/obrigacoes";

/*
 * A varredura do Acessórias vista de fora: ela percorre a carteira empresa a
 * empresa por uns 45 minutos, longe da vista. Sem esta leitura, "rodando" e
 * "morreu num restart" pareciam a mesma coisa, então cada estado tem nome,
 * selo e o que fazer com ele.
 */

export type SituacaoVarredura = "nunca" | "rodando" | "parando" | "interrompida" | "concluida" | "falhou";

/**
 * Parada no meio com progresso guardado: o próximo disparo continua dali. Quem
 * decide é a lib (a última execução parou no meio há menos de 24 h); a conta
 * pelo progresso errava depois do prazo, quando o disparo recomeça do zero.
 */
export function podeRetomar(v: EstadoVarredura): boolean {
  return v.retomavel;
}

/*
 * Os dois textos que a lib grava quando a varredura para sem ter falhado:
 * parada pedida e processo que sumiu (deploy, restart). Não são erro de quem
 * olha, então não vão para a tela em vermelho, nem crus.
 */
const PARADA_PEDIDA = /^cancelada/;
const PROCESSO_SUMIU = /^interrompida/;

export function situacaoVarredura(v: EstadoVarredura): SituacaoVarredura {
  if (v.rodando) return v.cancelamentoPedido ? "parando" : "rodando";
  if (v.id == null) return "nunca";
  // Sem fim registrado e sem batimento: o processo morreu e a lib ainda não
  // fechou a linha (fecha no próximo disparo ou no próximo Parar).
  if (podeRetomar(v) || v.concluidoEm == null) return "interrompida";
  if (v.erro) return PARADA_PEDIDA.test(v.erro) || PROCESSO_SUMIU.test(v.erro) ? "interrompida" : "falhou";
  return "concluida";
}

/** Menos de um minuto não vira "0min"; o resto sai no formato de horas do app. */
export function duracao(segundos: number): string {
  return segundos < 60 ? "menos de um minuto" : horas(segundos / 3600);
}

function segundosEntre(inicio: string, fim: string): number {
  return Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000));
}

const SELO: Record<SituacaoVarredura, { tom: Tom; rotulo: string; icone: NomeIcone }> = {
  nunca: { tom: "neutro", rotulo: "Nunca rodou", icone: "pendente" },
  rodando: { tom: "rota", rotulo: "Rodando", icone: "carregando" },
  parando: { tom: "atencao", rotulo: "Parando", icone: "carregando" },
  interrompida: { tom: "atencao", rotulo: "Interrompida", icone: "pendente" },
  concluida: { tom: "ok", rotulo: "Concluída", icone: "ok" },
  falhou: { tom: "perigo", rotulo: "Falhou", icone: "erro" },
};

export function SeloVarredura({ v }: { v: EstadoVarredura }) {
  const s = situacaoVarredura(v);
  // Concluída com empresa de fora não é o mesmo verde: a fila delas não andou.
  if (s === "concluida" && v.falhas > 0)
    return (
      <Selo tom="atencao" icone="alerta">
        Concluída com falhas
      </Selo>
    );
  const { tom, rotulo, icone } = SELO[s];
  return (
    <Selo tom={tom} icone={icone}>
      {rotulo}
    </Selo>
  );
}

/** A linha de quando, que vai na descrição do painel. */
export function quandoVarredura(v: EstadoVarredura): string {
  switch (situacaoVarredura(v)) {
    case "nunca":
      return "Nenhuma varredura registrada";
    case "rodando":
      return `Iniciada em ${dataHoraBR(v.iniciadoEm)}`;
    case "parando":
      return "Termina a empresa atual e para";
    case "interrompida":
      return v.concluidoEm ? `Parou em ${dataHoraBR(v.concluidoEm)}` : `Iniciada em ${dataHoraBR(v.iniciadoEm)}`;
    case "concluida":
      return `Concluída em ${dataHoraBR(v.concluidoEm)}`;
    case "falhou":
      return `Terminou com erro em ${dataHoraBR(v.concluidoEm)}`;
  }
}

/**
 * O botão da varredura. Iniciar é a ação da tela; com progresso guardado ele
 * vira Retomar, e enquanto roda vira Parar. Pedida a parada, fica travado em
 * Parando: a varredura só encerra no fim da empresa corrente, e um segundo
 * clique não apressa nada.
 */
export function BotaoVarredura({
  v,
  agindo,
  onIniciar,
  onParar,
}: {
  v: EstadoVarredura;
  agindo?: boolean;
  onIniciar?: () => void;
  onParar?: () => void;
}) {
  if (v.rodando && v.cancelamentoPedido)
    return (
      <Botao carregando disabled>
        Parando
      </Botao>
    );
  if (v.rodando)
    return (
      <Botao icone="parar" carregando={agindo} onClick={onParar}>
        Parar
      </Botao>
    );
  return (
    <Botao variante="primario" icone="executar" carregando={agindo} onClick={onIniciar}>
      {podeRetomar(v) ? "Retomar" : "Iniciar varredura"}
    </Botao>
  );
}

/**
 * Os números da varredura. O tempo que falta só existe enquanto ela roda; fora
 * disso a terceira célula diz quando foi a última e quanto durou.
 */
export function IndicadoresVarredura({ v }: { v?: EstadoVarredura }) {
  const carregando = !v;
  const s = v ? situacaoVarredura(v) : null;
  const rodando = s === "rodando" || s === "parando";
  const falhas = v?.falhas ?? 0;
  return (
    <FaixaIndicadores colunas={3}>
      <Indicador
        rotulo="Entregas coletadas"
        icone="fila"
        carregando={carregando}
        valor={num(v?.entregas ?? 0)}
        detalhe={rodando ? "Até agora, nesta varredura" : "Na última varredura"}
      />
      <Indicador
        rotulo="Empresas com falha"
        icone="alerta"
        carregando={carregando}
        valor={num(falhas)}
        detalhe={falhas > 0 ? "A fila delas ficou como estava" : "Nenhuma falhou"}
        tom={falhas > 0 ? "atencao" : "neutro"}
        valorNoTom
      />
      {rodando && v ? (
        <Indicador
          rotulo="Tempo restante"
          icone="relogio"
          valor={
            v.restanteSegundos == null
              ? "Estimando"
              : v.restanteSegundos < 60
                ? "Terminando"
                : duracao(v.restanteSegundos)
          }
          detalhe="Pelo ritmo até aqui"
        />
      ) : (
        // Só a data no número: data e hora no corpo da leitura não cabem na
        // célula do celular. A hora está na descrição do painel de andamento.
        <Indicador
          rotulo="Última varredura"
          icone="calendario"
          carregando={carregando}
          valor={v ? dataBR(v.concluidoEm ?? v.iniciadoEm) : ""}
          detalhe={
            v?.iniciadoEm && v.concluidoEm
              ? `Durou ${duracao(segundosEntre(v.iniciadoEm, v.concluidoEm))}`
              : "Sem fim registrado"
          }
        />
      )}
    </FaixaIndicadores>
  );
}

/** O que a última varredura deixou dito, em palavra de gente. */
function MotivoVarredura({ v }: { v: EstadoVarredura }) {
  const s = situacaoVarredura(v);
  if (s === "falhou" && v.erro)
    return (
      <Nota tom="perigo" icone="erro">
        A última varredura terminou com erro: {v.erro}
      </Nota>
    );
  if (s !== "interrompida") return null;
  let texto: string;
  if (v.erro && PARADA_PEDIDA.test(v.erro)) texto = "Parada a pedido.";
  else texto = "O processo do servidor parou no meio da varredura.";
  if (podeRetomar(v)) texto += " O que já foi varrido está guardado, e Retomar continua dali.";
  return <Nota icone="info">{texto}</Nota>;
}

/**
 * O andamento: quantas empresas de quantas, a barra e o que a interrompeu. Nunca
 * ter rodado é o estado da instalação nova, e ali o painel ensina e traz o
 * botão.
 */
export function PainelVarredura({ v, acaoVazio }: { v?: EstadoVarredura; acaoVazio?: ReactNode }) {
  const s = v ? situacaoVarredura(v) : null;
  const rodando = s === "rodando" || s === "parando";

  let corpo: ReactNode;
  if (!v)
    corpo = (
      <div aria-busy className="flex flex-col gap-3">
        <div className="flex justify-between gap-3">
          <Esqueleto className="w-48" />
          <Esqueleto className="w-12" />
        </div>
        <Esqueleto className="h-2 w-full rounded-full" />
      </div>
    );
  else if (s === "nunca")
    corpo = (
      <Vazio
        compacto
        icone="fila"
        titulo="Nenhuma varredura ainda"
        descricao="A primeira enche a fila de entregas da Visão Geral, do Contábil, do Fiscal e do DP."
        acao={acaoVazio}
      />
    );
  else {
    const fracao = v.total > 0 ? Math.min(1, v.progresso / v.total) : 0;
    const tom: Tom = rodando ? "rota" : s === "concluida" && v.falhas === 0 ? "ok" : "atencao";
    corpo = (
      <div className="flex flex-col gap-3">
        {v.total > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="num text-corpo text-tinta-2">
                <span className="font-[600] text-tinta">{num(v.progresso)}</span> de {num(v.total)} empresas
                {v.retomadaDe != null && <span className="text-apagado"> · retomada de {num(v.retomadaDe)}</span>}
              </p>
              <p className="num text-pequeno text-apagado">{pct(fracao * 100, 0)}</p>
            </div>
            <BarraProporcao valor={fracao} tom={tom} rotulo="Empresas varridas" className="h-2" />
          </>
        ) : rodando ? (
          // Antes do laço ela lista a carteira inteira, alguns minutos sem total.
          <p className="flex items-center gap-2 text-corpo text-tinta-2">
            <Girando rotulo="Lendo a carteira" />
            Lendo a carteira do Acessórias
          </p>
        ) : null}
        <MotivoVarredura v={v} />
      </div>
    );
  }

  return (
    <Painel
      titulo="Varredura do Acessórias"
      icone="atualizar"
      descricao={v ? quandoVarredura(v) : "Carregando"}
      acoes={v ? <SeloVarredura v={v} /> : undefined}
    >
      {corpo}
    </Painel>
  );
}

const AVISOS: { icone: NomeIcone; texto: string }[] = [
  { icone: "relogio", texto: "Leva cerca de 45 minutos e roda sozinha todo dia às 5h." },
  {
    icone: "reabrir",
    texto: "Parar não perde o que já foi varrido. Ela termina a empresa atual, e o botão vira Retomar.",
  },
  {
    icone: "atualizar",
    texto: "O mesmo vale se o servidor reiniciar no meio. Passadas 24 horas do início, a próxima começa do zero.",
  },
  {
    icone: "fila",
    texto: "Uma varredura parcial não apaga nada da fila. Só uma completa e sem falhas tira o que já foi entregue.",
  },
];

/** O que a pessoa precisa saber antes de apertar, e não depois. */
export function PainelAntesDeIniciar() {
  return (
    <Painel titulo="Antes de Iniciar" icone="info">
      <ul className="flex flex-col gap-2.5">
        {AVISOS.map((a) => (
          <li key={a.icone} className="flex items-start gap-2.5 text-corpo text-tinta-2">
            <Icone nome={a.icone} tamanho={15} className="mt-px text-apagado" />
            <span>{a.texto}</span>
          </li>
        ))}
      </ul>
    </Painel>
  );
}
