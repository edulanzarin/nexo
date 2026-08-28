"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CircleAlert,
  ListChecks,
  Receipt,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { Kpi } from "@/components/kpi-conf";
import { Badge, Button, Card, Dropdown, EmptyState, ItemLista, Segmented, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { PeriodoDropdown } from "@/components/filters/periodo-dropdown";
import { useCarteiraObrigacoes, useFilaObrigacoes } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import type { EmpresaCarteira } from "@/lib/obrigacoes";
import type { EntregaFila, ObrigacaoFila, ResponsavelFila } from "@/lib/obrigacoes-tipos";

/** Recorte escolhido na tela. Vazio = tudo. */
interface EstadoFiltros {
  cnpj?: string;
  respId?: number;
  obrigacao?: string;
  prazoDe?: string;
  prazoAte?: string;
  soVencidas?: boolean;
  soMulta?: boolean;
}

/** Estado -> querystring. Só o que está setado entra, para a chave de cache
 *  não variar por campo vazio. */
function paraQuery(f: EstadoFiltros): string {
  const q = new URLSearchParams();
  if (f.cnpj) q.set("cnpj", f.cnpj);
  if (f.respId != null) q.set("respId", String(f.respId));
  if (f.obrigacao) q.set("obrigacao", f.obrigacao);
  if (f.prazoDe) q.set("prazoDe", f.prazoDe);
  if (f.prazoAte) q.set("prazoAte", f.prazoAte);
  if (f.soVencidas) q.set("soVencidas", "1");
  if (f.soMulta) q.set("soMulta", "1");
  const s = q.toString();
  return s ? `&${s}` : "";
}

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

/**
 * Consulta AO VIVO de uma empresa. Existe porque a API é rápida exatamente onde
 * a varredura é lenta: uma empresa é uma chamada, ~1s. O ranking do escritório
 * continua vindo do retrato diário — esse só existe varrendo tudo.
 *
 * O resultado também atualiza o retrato daquela empresa no banco, então a fila
 * abaixo passa a concordar com o que se acabou de ver.
 */
function ConsultaAoVivo({
  secao,
  cnpj,
  nome,
}: {
  secao: string;
  cnpj: string | undefined;
  nome: string | undefined;
}) {
  const qc = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<{ empresa: string | null; fila: EntregaFila[] } | null>(null);

  const digitos = (cnpj ?? "").replace(/\D/g, "");
  const valido = digitos.length === 14 || digitos.length === 11;

  async function consultar() {
    if (!valido) return;
    setBuscando(true);
    setErro(null);
    setRes(null);
    try {
      const r = await mutar<{ empresa: string | null; fila: EntregaFila[] }>(
        `/api/obrigacoes/empresa?secao=${encodeURIComponent(secao)}&cnpj=${digitos}`,
        "POST"
      );
      setRes(r);
      // O retrato daquela empresa mudou no banco; a fila abaixo tem que refletir.
      await qc.invalidateQueries({ queryKey: ["obrigacoes-fila"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Card as="section" padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">
            {valido ? `Consultar ${nome ?? "esta empresa"} agora` : "Consultar uma empresa agora"}
          </h3>
          <p className="text-[11px] text-muted">
            {valido
              ? "Vai no Acessórias na hora — não espera a varredura das 5h"
              : "Escolha uma empresa no filtro acima para consultar ao vivo"}
          </p>
        </div>
        <Button onClick={consultar} disabled={!valido || buscando} variant="secondary">
          {buscando ? "Consultando…" : "Consultar ao vivo"}
        </Button>
      </div>

      {erro && <p className="text-xs text-critical">{erro}</p>}

      {res && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            {res.empresa ?? "Empresa"} · consultado agora
            {res.fila.length === 0 && " · nada pendente nesta seção"}
          </p>
          {res.fila.length > 0 && (
            <Table minWidth="min-w-[720px]">
              <Thead>
                <Th>Obrigação</Th>
                <Th>Competência</Th>
                <Th>Prazo</Th>
                <Th numeric>Atraso</Th>
                <Th>Responsável</Th>
              </Thead>
              <tbody>
                {res.fila.map((e) => (
                  <Tr key={e.entId}>
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
                    <Td>{e.respNome ?? <span className="text-muted">(sem responsável)</span>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Barra de filtros da fila. Fica NA TELA, e não no shell do módulo, porque aqui
 * o filtro não dispara consulta cara (a fila já está materializada) — muda o
 * recorte de algo que já carregou, então aplica na hora, sem "Executar".
 *
 * Todo recorte vai para o SERVIDOR na querystring: filtrar no cliente faria os
 * totais no topo discordarem da tabela embaixo, porque eles são contados na
 * mesma consulta que a lista.
 */
function BarraFiltros({
  carteira,
  responsaveis,
  obrigacoes,
  valor,
  aoMudar,
}: {
  carteira: EmpresaCarteira[] | undefined;
  responsaveis: ResponsavelFila[] | null | undefined;
  obrigacoes: ObrigacaoFila[] | null | undefined;
  valor: EstadoFiltros;
  aoMudar: (v: EstadoFiltros) => void;
}) {
  const [buscaEmp, setBuscaEmp] = useState("");

  const empresasFiltradas = useMemo(() => {
    const termo = buscaEmp.trim().toLowerCase();
    const base = carteira ?? [];
    const digitos = termo.replace(/\D/g, "");
    const lista = termo
      ? base.filter(
          (e) =>
            e.razao.toLowerCase().includes(termo) ||
            (digitos.length > 0 && e.cnpj.replace(/\D/g, "").includes(digitos))
        )
      : base;
    // Quem tem fila primeiro: é o que se procura nesta tela.
    return [...lista].sort((a, b) => Number(b.temFila) - Number(a.temFila)).slice(0, 60);
  }, [carteira, buscaEmp]);

  const empresaSel = carteira?.find((e) => e.cnpj === valor.cnpj);
  const respSel = responsaveis?.find((r) => r.respId === valor.respId);
  const modo = valor.soVencidas ? "vencidas" : valor.soMulta ? "multa" : "todas";
  const limpo =
    !valor.cnpj &&
    valor.respId == null &&
    !valor.prazoDe &&
    !valor.prazoAte &&
    !valor.obrigacao &&
    !valor.soVencidas &&
    !valor.soMulta;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dropdown
        icone={<Building2 className="size-4" />}
        rotulo={empresaSel ? empresaSel.razao : "Todas as empresas"}
        ativo={!!valor.cnpj}
        largura="w-80"
      >
        {(fechar) => (
          <>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={buscaEmp}
                onChange={(e) => setBuscaEmp(e.target.value)}
                placeholder="Razão social ou CNPJ…"
                className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              <ItemLista
                selecionado={!valor.cnpj}
                onClick={() => {
                  aoMudar({ ...valor, cnpj: undefined });
                  fechar();
                }}
              >
                Todas as empresas
              </ItemLista>
              {empresasFiltradas.map((e) => (
                <ItemLista
                  key={e.cnpj}
                  selecionado={valor.cnpj === e.cnpj}
                  onClick={() => {
                    aoMudar({ ...valor, cnpj: e.cnpj });
                    fechar();
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.razao}</span>
                    <span className="block text-[11px] text-muted">{e.cnpj}</span>
                  </span>
                  {e.temFila && <Badge tone="warning">fila</Badge>}
                </ItemLista>
              ))}
              {carteira?.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted">
                  A carteira chega na primeira varredura.
                </p>
              )}
            </div>
          </>
        )}
      </Dropdown>

      <Dropdown
        icone={<UserRound className="size-4" />}
        rotulo={respSel ? respSel.respNome : "Todos os responsáveis"}
        ativo={valor.respId != null}
        largura="w-72"
      >
        {(fechar) => (
          <div className="max-h-72 overflow-y-auto">
            <ItemLista
              selecionado={valor.respId == null}
              onClick={() => {
                aoMudar({ ...valor, respId: undefined });
                fechar();
              }}
            >
              Todos os responsáveis
            </ItemLista>
            {(responsaveis ?? [])
              .filter((r) => r.respId != null)
              .map((r) => (
                <ItemLista
                  key={r.respId}
                  selecionado={valor.respId === r.respId}
                  onClick={() => {
                    aoMudar({ ...valor, respId: r.respId ?? undefined });
                    fechar();
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{r.respNome}</span>
                  <span className="text-[11px] text-muted">{num(r.total)}</span>
                </ItemLista>
              ))}
          </div>
        )}
      </Dropdown>

      <Dropdown
        icone={<ListChecks className="size-4" />}
        rotulo={valor.obrigacao ?? "Todas as obrigações"}
        ativo={!!valor.obrigacao}
        largura="w-80"
      >
        {(fechar) => (
          <div className="max-h-72 overflow-y-auto">
            <ItemLista
              selecionado={!valor.obrigacao}
              onClick={() => {
                aoMudar({ ...valor, obrigacao: undefined });
                fechar();
              }}
            >
              Todas as obrigações
            </ItemLista>
            {(obrigacoes ?? []).map((o) => (
              <ItemLista
                key={o.obrigacao}
                selecionado={valor.obrigacao === o.obrigacao}
                onClick={() => {
                  aoMudar({ ...valor, obrigacao: o.obrigacao });
                  fechar();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{o.obrigacao}</span>
                <span className="text-[11px] text-muted">{num(o.total)}</span>
              </ItemLista>
            ))}
          </div>
        )}
      </Dropdown>

      {/* Prazo é a data que define atraso — é por ela que se filtra. */}
      <PeriodoDropdown
        inicio={valor.prazoDe ?? ""}
        fim={valor.prazoAte ?? ""}
        onChange={(inicio, fim) =>
          aoMudar({ ...valor, prazoDe: inicio || undefined, prazoAte: fim || undefined })
        }
      />

      <Segmented
        aria-label="Recorte da fila"
        options={[
          { value: "todas", label: "Todas" },
          { value: "vencidas", label: "Vencidas" },
          { value: "multa", label: "Com multa" },
        ]}
        value={modo}
        onChange={(v) => aoMudar({ ...valor, soVencidas: v === "vencidas", soMulta: v === "multa" })}
      />

      {!limpo && (
        <Button variant="ghost" onClick={() => aoMudar({})}>
          Limpar
        </Button>
      )}
    </div>
  );
}

export default function Conteudo({ secao }: { secao: string }) {
  const [filtros, setFiltros] = useState<EstadoFiltros>({});
  const query = paraQuery(filtros);
  const res = useFilaObrigacoes(secao, query);
  const carteira = useCarteiraObrigacoes();
  const dados = res.data;
  const qc = useQueryClient();
  const rodando = dados?.sync.rodando ?? false;
  const empresaNome = carteira.data?.find((e) => e.cnpj === filtros.cnpj)?.razao;

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
        {/* Não depende da varredura: uma empresa se consulta a qualquer momento. */}
        <Card as="section" padding="md" className="space-y-3">
          <BarraFiltros
            carteira={carteira.data}
            responsaveis={null}
            obrigacoes={null}
            valor={filtros}
            aoMudar={setFiltros}
          />
        </Card>
        <ConsultaAoVivo key={filtros.cnpj ?? "nenhuma"} secao={secao} cnpj={filtros.cnpj} nome={empresaNome} />
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

      <Card as="section" padding="md">
        <BarraFiltros
          carteira={carteira.data}
          responsaveis={responsaveis}
          obrigacoes={obrigacoes}
          valor={filtros}
          aoMudar={setFiltros}
        />
      </Card>

      {/* A consulta ao vivo só faz sentido com uma empresa escolhida. A `key`
          remonta ao trocar de empresa: um resultado velho ao lado de outro nome
          é o tipo de tela que faz alguém decidir sobre dado errado. */}
      {filtros.cnpj && (
        <ConsultaAoVivo
          key={filtros.cnpj}
          secao={secao}
          cnpj={filtros.cnpj}
          nome={empresaNome}
        />
      )}

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
