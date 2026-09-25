"use client";

import { PainelErro } from "@/componentes/primitivos/estados";
import {
  BotaoVarredura,
  IndicadoresVarredura,
  PainelAntesDeIniciar,
  PainelVarredura,
} from "@/componentes/produto/obrigacoes/varredura";
import type { EstadoVarredura } from "@/lib/obrigacoes";
import { Bloco, Variante } from "../bloco";

/*
 * A varredura do Acessórias, que alimenta a fila do Obrigações: o painel de
 * andamento em cada estado que a lib produz, os números, o botão e o aviso de
 * antes de apertar. Tudo com dado de mentira.
 */

const BASE: EstadoVarredura = {
  id: "c0ffee00-0000-4000-8000-000000000001",
  rodando: false,
  progresso: 0,
  total: 0,
  entregas: 0,
  falhas: 0,
  iniciadoEm: null,
  concluidoEm: null,
  erro: null,
  cancelamentoPedido: false,
  retomadaDe: null,
  restanteSegundos: null,
  retomavel: false,
};

const RODANDO: EstadoVarredura = {
  ...BASE,
  rodando: true,
  progresso: 812,
  total: 1575,
  entregas: 3214,
  iniciadoEm: "2026-09-25T09:12:00",
  restanteSegundos: 1140,
};

const V = {
  nunca: { ...BASE, id: null },
  listando: { ...BASE, rodando: true, iniciadoEm: "2026-09-25T09:12:00" },
  rodando: RODANDO,
  // Retomada há pouco: menos de cinco empresas nesta execução, a lib ainda não estima.
  retomada: { ...RODANDO, progresso: 815, entregas: 9, retomadaDe: 812, restanteSegundos: null },
  parando: { ...RODANDO, cancelamentoPedido: true },
  parada: {
    ...RODANDO,
    rodando: false,
    restanteSegundos: null,
    concluidoEm: "2026-09-25T09:36:00",
    erro: "cancelada por pedido do usuário",
    retomavel: true,
  },
  reinicio: {
    ...RODANDO,
    rodando: false,
    restanteSegundos: null,
    concluidoEm: "2026-09-25T09:41:00",
    erro: "interrompida: processo encerrado (sem batimento)",
    retomavel: true,
  },
  concluida: {
    ...BASE,
    progresso: 1575,
    total: 1575,
    entregas: 6120,
    iniciadoEm: "2026-09-25T05:00:00",
    concluidoEm: "2026-09-25T05:46:00",
  },
  comFalhas: {
    ...BASE,
    progresso: 1575,
    total: 1575,
    entregas: 6087,
    falhas: 3,
    iniciadoEm: "2026-09-25T05:00:00",
    concluidoEm: "2026-09-25T05:47:00",
  },
  falhou: {
    ...BASE,
    iniciadoEm: "2026-09-25T05:00:00",
    concluidoEm: "2026-09-25T05:01:00",
    erro: "O Acessórias recusou o token (401)",
  },
} satisfies Record<string, EstadoVarredura>;

export function BlocosObrigacoesVarredura() {
  return (
    <>
      <Bloco
        titulo="Varredura do Acessórias"
        porque="A varredura roda uns 45 minutos longe da vista, e sem este painel uma varredura trabalhando e uma que morreu num restart pareciam iguais. Cada estado da lib tem selo e frase próprios. Parada a pedido e processo que sumiu não são erro de quem olha, então saem em nota neutra dizendo que Retomar continua dali; só o erro de verdade sai em vermelho. Nunca ter rodado é o estado da instalação nova: o painel ensina e traz o botão."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Variante nome="Nunca rodou">
            <PainelVarredura v={V.nunca} acaoVazio={<BotaoVarredura v={V.nunca} />} />
          </Variante>
          <Variante nome="Lendo a carteira (ainda sem total)">
            <PainelVarredura v={V.listando} />
          </Variante>
          <Variante nome="Rodando">
            <PainelVarredura v={V.rodando} />
          </Variante>
          <Variante nome="Retomada de onde parou">
            <PainelVarredura v={V.retomada} />
          </Variante>
          <Variante nome="Parada pedida">
            <PainelVarredura v={V.parando} />
          </Variante>
          <Variante nome="Parada a pedido">
            <PainelVarredura v={V.parada} />
          </Variante>
          <Variante nome="Servidor reiniciou no meio">
            <PainelVarredura v={V.reinicio} />
          </Variante>
          <Variante nome="Concluída">
            <PainelVarredura v={V.concluida} />
          </Variante>
          <Variante nome="Concluída com falhas">
            <PainelVarredura v={V.comFalhas} />
          </Variante>
          <Variante nome="Terminou com erro">
            <PainelVarredura v={V.falhou} />
          </Variante>
          <Variante nome="Carregando">
            <PainelVarredura />
          </Variante>
          <Variante nome="Erro ao ler o estado">
            <PainelErro
              titulo="Não deu para ler o estado da varredura"
              mensagem="Banco do app fora do ar."
              onTentar={() => {}}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Números da Varredura"
        porque="Entregas e falhas são da varredura mais recente, não da fila inteira: a lib zera a contagem a cada execução. O tempo que falta só existe enquanto ela roda, pelo ritmo desta execução; parada, a terceira célula diz quando foi a última e quanto durou. Empresa com falha acende em atenção porque a fila dela ficou como estava."
      >
        <div className="flex flex-col gap-5">
          <Variante nome="Rodando">
            <IndicadoresVarredura v={V.rodando} />
          </Variante>
          <Variante nome="Concluída com falhas">
            <IndicadoresVarredura v={V.comFalhas} />
          </Variante>
          <Variante nome="Carregando">
            <IndicadoresVarredura />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Botão da Varredura"
        porque="Um botão que muda de papel com o estado. Com progresso guardado, Iniciar vira Retomar; rodando, vira Parar, sem o laranja da ação principal, porque parar não perde nada. Pedida a parada, trava em Parando até a empresa corrente acabar, e um segundo clique não apressa nada."
        palco
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <BotaoVarredura v={V.concluida} />
          <BotaoVarredura v={V.parada} />
          <BotaoVarredura v={V.rodando} />
          <BotaoVarredura v={V.parando} />
        </div>
      </Bloco>

      <Bloco
        titulo="Antes de Iniciar"
        porque="O que muda a decisão de apertar vem antes do botão: quanto leva, que ela já roda sozinha, que parar não perde nada e que uma varredura pela metade não limpa a fila. O porquê de cada regra fica no código."
      >
        <PainelAntesDeIniciar />
      </Bloco>
    </>
  );
}
