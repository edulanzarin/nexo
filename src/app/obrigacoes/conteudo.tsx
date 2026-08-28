"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CircleAlert, ListChecks, Receipt, RefreshCw } from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { Badge, Button, Card, EmptyState, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { useFilaObrigacoes } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import type { EntregaFila } from "@/lib/obrigacoes-tipos";

/**
 * A fila de entregas do Acessórias. Uma tela só, servindo as quatro seções — o
 * que muda entre elas é o SETOR, e ele vem do caminho, não de um filtro na tela.
 *
 * Todo número aqui é um retrato datado: a fila é materializada por um job (a API
 * de origem cobra uma chamada por empresa), então a tela diz de quando é o dado
 * em vez de fingir que é ao vivo.
 */

/** Atraso em dias vira um tom: o que já venceu grita, o resto informa. */
function TomAtraso({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-muted">—</span>;
  if (dias > 30) return <Badge tone="critical">{num(dias)} dias</Badge>;
  if (dias > 0) return <Badge tone="warning">{num(dias)} dias</Badge>;
  return <span className="text-muted">no prazo</span>;
}

function LinhaFila({ e }: { e: EntregaFila }) {
  return (
    <Tr>
      <Td>
        <span className="block truncate" title={e.empresa}>
          {e.empresa}
        </span>
        <span className="text-[11px] text-muted">{e.cnpj}</span>
      </Td>
      <Td>
        <span className="block truncate" title={e.obrigacao}>
          {e.obrigacao}
        </span>
        <span className="text-[11px] text-muted">{e.dptoNome}</span>
      </Td>
      <Td>{e.competencia ? dataBR(e.competencia) : "—"}</Td>
      <Td>{e.prazo ? dataBR(e.prazo) : "—"}</Td>
      <Td numeric>
        <TomAtraso dias={e.diasAtraso} />
      </Td>
      <Td>{e.multa ? <Badge tone="critical">multa</Badge> : <span className="text-muted">—</span>}</Td>
      <Td>{e.respNome ?? <span className="text-muted">(sem responsável)</span>}</Td>
    </Tr>
  );
}

/**
 * Botão de varredura manual. Não espera a varredura terminar — ela leva horas;
 * o que ele faz é INICIAR e devolver a tela ao estado "sincronizando", que se
 * resolve sozinho pelo polling.
 */
function BotaoSincronizar({ rodando }: { rodando: boolean }) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function disparar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await mutar<{ iniciada: boolean; motivo?: string }>(
        "/api/obrigacoes/sincronizar",
        "POST"
      );
      if (!r.iniciada && r.motivo) setErro(r.motivo);
      await qc.invalidateQueries({ queryKey: ["obrigacoes-fila"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={disparar} disabled={enviando || rodando} variant="secondary">
        <RefreshCw className={`size-4 ${rodando ? "animate-spin" : ""}`} />
        {rodando ? "Sincronizando…" : enviando ? "Iniciando…" : "Sincronizar agora"}
      </Button>
      {erro && <span className="text-[11px] text-critical">{erro}</span>}
    </div>
  );
}

export default function Conteudo({ secao }: { secao: string }) {
  const res = useFilaObrigacoes(secao);
  const dados = res.data;
  const qc = useQueryClient();
  const rodando = dados?.sync.rodando ?? false;

  // Enquanto a varredura roda, a tela se refaz sozinha — senão o usuário fica
  // olhando um "sincronizando" que nunca vira número sem apertar F5.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["obrigacoes-fila"] });
    }, 30_000);
    return () => clearInterval(t);
  }, [rodando, qc]);

  if (res.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6" />}
        titulo="Não foi possível carregar a fila"
        descricao={res.error instanceof Error ? res.error.message : "Tente novamente em instantes."}
      />
    );
  }

  if (!dados) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  const { sync, setores, responsaveis, obrigacoes, fila } = dados;
  // A varredura é do escritório inteiro; quem cuida de um setor não a dispara
  // (a rota também só libera `geral`, isto aqui é a conveniência da tela).
  const podeSincronizar = secao === "geral";

  // Nunca sincronizou: a tela está vazia por falta de job, não por falta de
  // trabalho. Dizer isso evita a leitura de que o escritório está em dia.
  if (!sync.concluidoEm) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          titulo={
            sync.rodando ? "A primeira varredura está rodando" : "A fila ainda não foi sincronizada"
          }
          descricao={
            sync.rodando
              ? "Ela varre a carteira empresa a empresa e leva cerca de 30 minutos. Esta tela se atualiza sozinha quando terminar."
              : "O job diário preenche esta tela às 5h. Para adiantar, dispare a varredura agora — leva cerca de 30 minutos e roda em segundo plano."
          }
        />
        {podeSincronizar && (
          <div className="flex justify-center">
            <BotaoSincronizar rodando={sync.rodando} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* De quando é o dado — antes dos números, não num rodapé */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Retrato de {dataHoraBR(sync.concluidoEm)}</span>
          <span>· {num(sync.empresas)} empresas varridas</span>
          {sync.rodando && <Badge tone="accent">sincronizando agora</Badge>}
          {sync.falhas > 0 && (
            <Badge tone="warning">
              {num(sync.falhas)} empresas falharam — a fila está incompleta
            </Badge>
          )}
        </div>
        {podeSincronizar && <BotaoSincronizar rodando={sync.rodando} />}
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          rotulo="Na fila"
          icone={<ListChecks className="size-4" />}
          corIcone="bg-accent/12 text-accent"
          valor={num(dados.total)}
          secundario="Entregas pendentes ou atrasadas"
        />
        <Kpi
          rotulo="Vencidas"
          icone={<CircleAlert className="size-4" />}
          corIcone="bg-critical/12 text-critical"
          valor={num(dados.atrasadas)}
          secundario="Prazo já passou"
          alerta={dados.atrasadas > 0}
        />
        <Kpi
          rotulo="Com multa"
          icone={<Receipt className="size-4" />}
          corIcone="bg-warning/12 text-warning"
          valor={num(dados.comMulta)}
          secundario="Atraso gera multa"
        />
        <Kpi
          rotulo="Setores com fila"
          icone={<CalendarClock className="size-4" />}
          corIcone="bg-good/12 text-good"
          valor={num(setores?.length ?? 0)}
          secundario={
            dados.semParNoQuestor > 0
              ? `${num(dados.semParNoQuestor)} sem par no Questor`
              : "Todas as empresas casam com o Questor"
          }
        />
      </section>

      {/* Quem está devendo — o recorte que o Acessórias não mostra pronto */}
      <Card as="section" overflow padding="none">
        <div className="border-b border-hairline px-4 py-3">
          <h3 className="text-sm font-medium text-ink">Por responsável</h3>
          <p className="text-[11px] text-muted">
            Quem responde pelo prazo das entregas em aberto, do pior para o melhor
          </p>
        </div>
        {!responsaveis?.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Nada na fila.</p>
        ) : (
          <Table minWidth="min-w-[560px]">
            <Thead>
              <Th>Responsável</Th>
              <Th numeric>Na fila</Th>
              <Th numeric>Vencidas</Th>
              <Th numeric>Com multa</Th>
              <Th numeric>Pior atraso</Th>
            </Thead>
            <tbody>
              {responsaveis.map((r) => (
                <Tr key={`${r.respId ?? "s"}-${r.respNome}`}>
                  <Td>{r.respNome}</Td>
                  <Td numeric>{num(r.total)}</Td>
                  <Td numeric>{r.atrasadas > 0 ? num(r.atrasadas) : "—"}</Td>
                  <Td numeric>{r.comMulta > 0 ? num(r.comMulta) : "—"}</Td>
                  <Td numeric>
                    {r.piorAtraso != null ? `${num(r.piorAtraso)} dias` : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Setor: só faz sentido onde há mais de um (a Visão geral) */}
        {setores && setores.length > 1 && (
          <Card as="section" overflow padding="none">
            <div className="border-b border-hairline px-4 py-3">
              <h3 className="text-sm font-medium text-ink">Por setor</h3>
            </div>
            <Table minWidth="min-w-[320px]">
              <Thead>
                <Th>Setor</Th>
                <Th numeric>Na fila</Th>
                <Th numeric>Vencidas</Th>
              </Thead>
              <tbody>
                {setores.map((s) => (
                  <Tr key={s.dptoId}>
                    <Td>{s.dptoNome}</Td>
                    <Td numeric>{num(s.total)}</Td>
                    <Td numeric>{s.atrasadas > 0 ? num(s.atrasadas) : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        <Card as="section" overflow padding="none">
          <div className="border-b border-hairline px-4 py-3">
            <h3 className="text-sm font-medium text-ink">Por obrigação</h3>
          </div>
          {!obrigacoes?.length ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Nada na fila.</p>
          ) : (
            <Table minWidth="min-w-[320px]">
              <Thead>
                <Th>Obrigação</Th>
                <Th numeric>Na fila</Th>
                <Th numeric>Vencidas</Th>
              </Thead>
              <tbody>
                {obrigacoes.map((o) => (
                  <Tr key={o.obrigacao}>
                    <Td>{o.obrigacao}</Td>
                    <Td numeric>{num(o.total)}</Td>
                    <Td numeric>{o.atrasadas > 0 ? num(o.atrasadas) : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>

      {/* A fila em si, do prazo mais antigo para o mais novo */}
      <Card as="section" overflow padding="none">
        <div className="border-b border-hairline px-4 py-3">
          <h3 className="text-sm font-medium text-ink">A fila</h3>
          <p className="text-[11px] text-muted">
            {fila && fila.length >= 500
              ? "As 500 mais antigas — o recorte por setor reduz a lista"
              : "Da mais antiga para a mais recente"}
          </p>
        </div>
        {!fila?.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Nada na fila.</p>
        ) : (
          <Table minWidth="min-w-[900px]">
            <Thead sticky>
              <Th>Empresa</Th>
              <Th>Obrigação</Th>
              <Th>Competência</Th>
              <Th>Prazo</Th>
              <Th numeric>Atraso</Th>
              <Th>Multa</Th>
              <Th>Responsável</Th>
            </Thead>
            <tbody>
              {fila.map((e) => (
                <LinhaFila key={e.entId} e={e} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
