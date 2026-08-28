"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CircleAlert, Play, RefreshCw, Square } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { useVarreduraObrigacoes } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataHoraBR, num } from "@/lib/format";

/**
 * Operação da varredura do Acessórias. Seção própria e não concedida por padrão:
 * quem consulta obrigação não administra a integração.
 *
 * A tela existe porque a varredura é longa e roda fora da vista. Sem ela, as
 * únicas informações eram "sincronizando" e o silêncio — e uma varredura que
 * morreu num restart era indistinguível de uma que está trabalhando.
 */

function duracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

export default function Conteudo() {
  const res = useVarreduraObrigacoes();
  const v = res.data;
  const qc = useQueryClient();
  const [agindo, setAgindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const rodando = v?.rodando ?? false;

  // Enquanto roda, a tela é um monitor: sem isso o progresso ficaria congelado
  // na leitura da abertura, que é justamente o que se veio ver.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["obrigacoes-varredura"] });
    }, 5_000);
    return () => clearInterval(t);
  }, [rodando, qc]);

  async function acao(metodo: "POST" | "DELETE") {
    setAgindo(true);
    setErro(null);
    try {
      const r = await mutar<{ iniciada?: boolean; motivo?: string; parada?: boolean }>(
        metodo === "POST" ? "/api/obrigacoes/sincronizar" : "/api/obrigacoes/varredura",
        metodo
      );
      if (r.iniciada === false && r.motivo) setErro(r.motivo);
      if (r.parada === false) setErro("Não havia varredura em andamento.");
      await qc.invalidateQueries({ queryKey: ["obrigacoes-varredura"] });
      await qc.invalidateQueries({ queryKey: ["obrigacoes-fila"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setAgindo(false);
    }
  }

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível ler o estado da varredura"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente."}
      />
    );
  }

  if (!v) return <div className="skeleton h-48" />;

  const pct = v.total > 0 ? Math.min(100, Math.round((v.progresso / v.total) * 100)) : 0;

  return (
    <div className="space-y-4">
      <Card as="section" padding="md" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Varredura do Acessórias</h2>
            <p className="text-[11px] text-muted">
              Percorre a carteira empresa a empresa — a API não tem consulta em lote nem
              webhook. Roda sozinha todo dia às 5h; aqui é o disparo manual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rodando ? (
              <Button variant="secondary" onClick={() => acao("DELETE")} disabled={agindo || v.cancelamentoPedido}>
                <Square className="size-4" />
                {v.cancelamentoPedido ? "Parando…" : "Parar"}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => acao("POST")} disabled={agindo}>
                <Play className="size-4" />
                {v.progresso > 0 && v.progresso < v.total ? "Retomar" : "Iniciar varredura"}
              </Button>
            )}
          </div>
        </div>

        {erro && <p className="text-xs text-critical">{erro}</p>}

        {/* Progresso: a barra é o que faltava para distinguir "trabalhando" de "morta" */}
        {v.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-ink">
                {num(v.progresso)} de {num(v.total)} empresas
                {v.retomadaDe != null && (
                  <span className="text-muted"> · retomada de {num(v.retomadaDe)}</span>
                )}
              </span>
              <span className="text-muted">
                {rodando && v.restanteSegundos != null
                  ? `~${duracao(v.restanteSegundos)} restantes`
                  : rodando
                    ? "estimando…"
                    : `${pct}%`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {rodando ? (
            <Badge tone="accent">
              <RefreshCw className="size-3 animate-spin" /> rodando
            </Badge>
          ) : v.concluidoEm ? (
            <span>Última: {dataHoraBR(v.concluidoEm)}</span>
          ) : (
            <span>Nunca rodou</span>
          )}
          <span>{num(v.entregas)} entregas coletadas</span>
          {v.falhas > 0 && (
            <Badge tone="warning">
              <CircleAlert className="size-3" /> {num(v.falhas)} empresas falharam
            </Badge>
          )}
          {v.erro && <Badge tone="warning">{v.erro}</Badge>}
        </div>
      </Card>

      {/* O que a pessoa precisa saber antes de apertar, não depois */}
      <Card as="section" padding="md" className="space-y-2 text-xs text-muted">
        <div className="flex items-center gap-2 text-ink">
          <CalendarClock className="size-4" />
          <h3 className="text-sm font-medium">Como ela se comporta</h3>
        </div>
        <p>
          Leva cerca de 45 minutos (medido: 1.575 empresas em 46 min). O ritmo se ajusta sozinho: a API recusa acima de ~45
          chamadas por minuto, e a cada recusa a varredura desacelera e volta devagar.
        </p>
        <p>
          <strong className="text-ink">Parar não perde o andado.</strong> Ela encerra no fim da
          empresa corrente, guarda até onde foi e o botão vira &quot;Retomar&quot;. O mesmo vale se
          o container reiniciar no meio — a próxima execução continua de onde parou, dentro
          de 24h.
        </p>
        <p>
          Uma varredura parcial <strong className="text-ink">não apaga</strong> o que não viu: só
          uma passagem completa e sem falhas remove da fila o que já foi entregue. Assim uma
          execução interrompida nunca produz uma fila falsamente limpa.
        </p>
      </Card>
    </div>
  );
}
