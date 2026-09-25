"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { PainelErro } from "@/componentes/primitivos/estados";
import {
  BotaoVarredura,
  IndicadoresVarredura,
  PainelAntesDeIniciar,
  PainelVarredura,
  podeRetomar,
  situacaoVarredura,
} from "@/componentes/produto/obrigacoes/varredura";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { num } from "@/lib/format";
import type { EstadoVarredura } from "@/lib/obrigacoes";

const CHAVE = "obrigacoes-varredura";
const URL_ESTADO = "/api/obrigacoes/varredura";
/** A fila que a varredura alimenta. É a chave das quatro telas de fila. */
const CHAVE_FILA = "obrigacoes-fila";

/** De quanto em quanto tempo a tela pergunta enquanto a varredura roda. */
const BATIDA = 5_000;
/**
 * Depois de Iniciar, a tela pergunta por este tempo mesmo sem ver "rodando": a
 * rota responde antes de a varredura gravar a linha dela, e a primeira leitura
 * pode chegar cedo demais. Sem isso a tela ficaria parada no estado velho.
 */
const VIGIA_APOS_INICIAR = 30_000;

/**
 * O estado da varredura. Enquanto ela roda, a tela é um monitor: sem perguntar
 * de novo, o progresso ficaria congelado na leitura da abertura, que é o que se
 * veio ver. O intervalo sai do último estado em cache, como na carteira do
 * Fechamento: quando a resposta diz que parou, o próximo desenho já não pede.
 */
function useVarredura(vigiando: boolean) {
  const qc = useQueryClient();
  const ultimo = qc.getQueryData<EstadoVarredura>([CHAVE, URL_ESTADO]);
  return useConsulta<EstadoVarredura>(CHAVE, URL_ESTADO, {
    refetchInterval: ultimo?.rodando || vigiando ? BATIDA : false,
  });
}

/**
 * Chama o fim de uma varredura uma vez, quando o estado passa de rodando para
 * parado. A fila só fica certa no fim (é lá que sai o que já foi entregue),
 * então ela recarrega sozinha em vez de esperar alguém trocar de tela.
 */
function useAoTerminar(rodando: boolean, aoTerminar: () => void) {
  const estava = useRef(false);
  const fim = useRef(aoTerminar);
  useEffect(() => {
    fim.current = aoTerminar;
  });
  useEffect(() => {
    if (rodando) {
      estava.current = true;
      return;
    }
    if (!estava.current) return;
    estava.current = false;
    fim.current();
  }, [rodando]);
}

/**
 * Configurações do Obrigações: o andamento da varredura do Acessórias e o
 * disparo manual, para quem não quer esperar o job das 5h. Seção própria, que
 * nenhum cargo recebe por padrão: quem consulta obrigação não opera a
 * integração.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const [vigiando, setVigiando] = useState(false);
  const [agindo, setAgindo] = useState(false);
  const res = useVarredura(vigiando);
  const v = res.data;

  const invalidar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVE] }),
      qc.invalidateQueries({ queryKey: [CHAVE_FILA] }),
    ]);

  useAoTerminar(v?.rodando ?? false, () => {
    qc.invalidateQueries({ queryKey: [CHAVE_FILA] });
    if (!v) return;
    const s = situacaoVarredura(v);
    if (s === "concluida")
      avisar.ok(
        "Varredura concluída",
        `${num(v.entregas)} ${v.entregas === 1 ? "entrega coletada" : "entregas coletadas"}`
      );
    else if (s === "interrompida")
      avisar.info("Varredura parada", `${num(v.progresso)} de ${num(v.total)} empresas varridas`);
    else if (s === "falhou") avisar.erro("A varredura terminou com erro", v.erro ?? undefined);
  });

  async function iniciar() {
    if (!v) return;
    const retomando = podeRetomar(v);
    setAgindo(true);
    try {
      const r = await mutar<{ iniciada: boolean; motivo?: string }>("/api/obrigacoes/sincronizar", "POST");
      if (r.iniciada) {
        avisar.ok(retomando ? "Varredura retomada" : "Varredura iniciada", "Leva cerca de 45 minutos.");
        setVigiando(true);
        setTimeout(() => setVigiando(false), VIGIA_APOS_INICIAR);
      } else {
        avisar.info("A varredura não começou", r.motivo);
      }
      await invalidar();
    } catch (e) {
      avisar.erro("Não deu para iniciar a varredura", (e as Error).message);
    } finally {
      setAgindo(false);
    }
  }

  async function parar() {
    setAgindo(true);
    try {
      const r = await mutar<{ parada: boolean }>(URL_ESTADO, "DELETE");
      if (r.parada) avisar.ok("Parada pedida", "Ela termina a empresa atual e guarda o progresso.");
      else avisar.info("Não havia varredura rodando");
      await invalidar();
    } catch (e) {
      avisar.erro("Não deu para parar a varredura", (e as Error).message);
    } finally {
      setAgindo(false);
    }
  }

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para ler o estado da varredura"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  const botao = v ? <BotaoVarredura v={v} agindo={agindo} onIniciar={iniciar} onParar={parar} /> : null;
  // Instalação nova não tem número nenhum: a faixa de zeros só faria barulho
  // em cima do painel que ensina a começar.
  const nunca = v != null && situacaoVarredura(v) === "nunca";

  return (
    <>
      {botao && <AcoesPagina>{botao}</AcoesPagina>}
      {!nunca && <IndicadoresVarredura v={v} />}
      <PainelVarredura v={v} acaoVazio={botao} />
      <PainelAntesDeIniciar />
    </>
  );
}
