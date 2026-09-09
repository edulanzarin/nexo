"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CheckCircle2, CircleSlash, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, StatTile, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import {
  FitaCompetencias,
  LegendaFechamento,
  SeloFechamento,
} from "@/components/ctb-fechamento";
import { useFiltros } from "@/hooks/use-filters";
import { GrupoAcessoriasDropdown } from "@/components/filters/grupo-acessorias-dropdown";
import { useCarteiraAcessorias, useContabilFechamento, useGruposAcessorias } from "@/hooks/use-api";
import { mutar } from "@/hooks/mutar";
import { dataBR, dataHoraBR, mesBR, num } from "@/lib/format";
import { pctBR } from "@/lib/prod-formato";

/**
 * FECHAMENTO — quais empresas tiveram a competência apurada, e de quem elas são.
 *
 * As outras abas medem o que o time PRODUZIU; esta mede o que ele TERMINOU.
 * Fechar o mês de uma empresa é apurar o resultado, e isso deixa um rastro único
 * no Questor: um lançamento na conta de Encerramento do Exercício. Sem ele, a
 * empresa pode ter mil lançamentos e não estar fechada.
 *
 * É a única tela que cruza duas fontes: o marcador vem do Questor, o analista
 * responsável vem da carteira do Acessórias — o ERP não sabe de quem é a empresa.
 */
export default function FechamentoContabilPage() {
  const { qs, filtros } = useFiltros();
  const [gruposAcess, setGruposAcess] = useFiltroGrupo();
  const consulta = useContabilFechamento(
    gruposAcess.length ? `${qs}&grupos_acess=${gruposAcess.join(",")}` : qs
  );
  const d = consulta.data;
  const carregando = consulta.isLoading;

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const ref = d.referencia.slice(0, 7);
    return [
      {
        id: "empresas",
        rotulo: "Empresas da carteira",
        descricao: "Uma linha por empresa, com a situação na competência e quem apurou",
        nome: `fechamento-contabil-${ref}`,
        montar: () => ({
          cabecalhos: [
            "CNPJ", "Empresa", "Grupo", "Código Questor", "Analista", `Situação ${ref}`,
            "Fechada até", "Competências atrás", "Registro", "Quem fechou",
          ],
          linhas: d.empresas.map((e) => [
            e.cnpj,
            e.nome,
            e.grupos.join(" · "),
            e.codigo ?? "",
            e.analista ?? "",
            e.situacoes[e.situacoes.length - 1],
            e.ultimaCompetencia?.slice(0, 7) ?? "nunca",
            e.mesesAtras ?? "",
            e.registradoEm ?? "",
            e.fechadoPor ?? "",
          ]),
        }),
      },
      {
        id: "abertas",
        rotulo: "Só as em aberto",
        descricao: "Empresas que escrituraram na competência e ninguém apurou",
        nome: `fechamento-contabil-em-aberto-${ref}`,
        montar: () => ({
          cabecalhos: [
            "CNPJ", "Empresa", "Grupo", "Analista", "Fechada até", "Competências atrás",
          ],
          linhas: d.empresas
            .filter((e) => e.situacoes[e.situacoes.length - 1] === "aberta")
            .map((e) => [
              e.cnpj,
              e.nome,
              e.grupos.join(" · "),
              e.analista ?? "",
              e.ultimaCompetencia?.slice(0, 7) ?? "nunca",
              e.mesesAtras ?? "",
            ]),
        }),
      },
    ];
  }, [d]);

  const semCarteira = !!d && d.carteira.empresas === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="max-w-xl text-xs text-muted">
          Fechada = tem lançamento na conta de Encerramento do Exercício na competência ·
          o analista responsável vem da carteira do Acessórias, não do Questor
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* O grupo recorta a aba INTEIRA — cartões, ranking e tabela. Fica
              aqui em cima, e não sobre a tabela, para não sugerir que só a
              lista obedece a ele. */}
          <GrupoAcessoriasDropdown grupos={gruposAcess} onChange={setGruposAcess} />
          <ExportarMenu modulo="contabil" cortes={cortes} desabilitado={!d || carregando} />
        </div>
      </div>

      {gruposAcess.length > 0 && d && (
        <Card padding="sm" className="text-sm text-muted">
          Recortado por {gruposAcess.length === 1 ? "1 grupo" : `${gruposAcess.length} grupos`} do
          Acessórias: {num(d.carteira.empresas - d.carteira.foraDoGrupo)} de{" "}
          {num(d.carteira.empresas)} empresas da carteira. Todos os números desta aba falam só
          desse recorte.
        </Card>
      )}

      {d?.referenciaEmCurso && !semCarteira && (
        <Card padding="sm" className="text-sm text-muted">
          <strong className="text-ink">{mesBR(d.referencia)} ainda está em curso.</strong> O
          encerramento é lançado depois que a competência termina, em geral no mês seguinte —
          números baixos aqui são o esperado. Para cobrar fechamento, recue o período para a
          competência anterior.
        </Card>
      )}

      {!semCarteira && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {carregando || !d ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
          ) : (
            <>
              <StatTile
                rotulo={`Fechadas em ${mesBR(d.referencia)}`}
                icon={<CheckCircle2 className="size-4 text-good" />}
                iconTint="bg-good/12"
                valor={num(d.totais.fechadas)}
                secundario={`${pctBR(d.totais.pct * 100)}% da carteira medida (${num(d.totais.carteira)} empresas)`}
              />
              <StatTile
                rotulo="Em aberto"
                icon={<Clock className="size-4 text-warning" />}
                iconTint="bg-warning/12"
                valor={num(d.totais.abertas)}
                secundario="escrituraram na competência e ninguém apurou"
                alerta={d.totais.abertas > 0}
              />
              <StatTile
                rotulo="Carteira do Contábil"
                icon={<Building2 className="size-4 text-ent" />}
                iconTint="bg-ent/12"
                valor={num(d.carteira.empresas)}
                secundario={`${num(d.carteira.semPar)} sem par no Questor · ${num(d.carteira.foraDoEscopo)} fora do seu escopo`}
              />
              <StatTile
                rotulo="Sem movimento"
                icon={<CircleSlash className="size-4 text-ink-2" />}
                valor={num(d.totais.semMovimento)}
                secundario="nada escriturado na competência — não há o que apurar"
              />
              <StatTile
                rotulo="Nunca fecharam"
                icon={<TriangleAlert className="size-4 text-ink-2" />}
                valor={num(d.totais.nuncaFecharam)}
                secundario="escrituram e nunca tiveram uma apuração"
                alerta={d.totais.nuncaFecharam > 0}
              />
            </>
          )}
        </div>
      )}

      <PainelCarteira semCarteira={semCarteira} />

      {!semCarteira && (
        <>
          <Card padding="none" overflow>
            <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
              <div>
                <h2 className="text-sm font-medium text-ink">Por analista</h2>
                <p className="text-xs text-muted">
                  Responsável pelo setor Contábil no Acessórias, na competência{" "}
                  {d ? mesBR(d.referencia) : "—"}. Os nomes vêm como estão lá, marcadores de
                  fluxo inclusive (&ldquo;Entrada Empresas&rdquo;, &ldquo;Saída de
                  Empresa&rdquo;) — inventar um de-para esconderia quantas empresas estão sem
                  dono de verdade.
                </p>
              </div>
            </div>
            <Table>
              <Thead sticky>
                <Th>Analista</Th>
                <Th numeric>Carteira</Th>
                <Th numeric>Fechadas</Th>
                <Th numeric>Em aberto</Th>
                <Th numeric>Sem movimento</Th>
                <Th numeric>Fechado</Th>
              </Thead>
              <tbody>
                {(d?.porAnalista ?? []).map((a) => (
                  <Tr key={a.nome}>
                    <Td>{a.nome}</Td>
                    <Td numeric>{num(a.carteira)}</Td>
                    <Td numeric>{num(a.fechadas)}</Td>
                    <Td numeric>{num(a.abertas)}</Td>
                    <Td numeric>{num(a.semMovimento)}</Td>
                    <Td numeric>
                      <Badge tone={a.pct >= 0.9 ? "good" : a.pct >= 0.5 ? "accent" : "warning"}>
                        {pctBR(a.pct * 100)}%
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card padding="none" overflow>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
              <div>
                <h2 className="text-sm font-medium text-ink">Empresas</h2>
                <p className="text-xs text-muted">
                  O topo é o que precisa de ação: em aberto na competência, das mais atrasadas
                  para as menos. A coluna Competências mostra mês a mês o período da barra —
                  amplie o período para enxergar mais meses de uma vez.
                </p>
              </div>
              <LegendaFechamento />
            </div>
            <Table>
              <Thead sticky>
                <Th>Empresa</Th>
                <Th>Grupo</Th>
                <Th>Analista</Th>
                <Th>{d ? mesBR(d.referencia) : "Situação"}</Th>
                <Th>Competências</Th>
                <Th>Fechada até</Th>
                <Th>Registro</Th>
                <Th>Quem fechou</Th>
              </Thead>
              <tbody>
                {(d?.empresas ?? []).map((e) => (
                  <Tr key={e.cnpj}>
                    <Td>{e.nome}</Td>
                    <Td className="max-w-[180px] truncate" title={e.grupos.join(" · ")}>
                      {e.grupos.length ? e.grupos.join(" · ") : "—"}
                    </Td>
                    <Td>{e.analista ?? "—"}</Td>
                    <Td>
                      <SeloFechamento situacao={e.situacoes[e.situacoes.length - 1]} />
                    </Td>
                    <Td>
                      <FitaCompetencias
                        meses={d!.meses}
                        situacoes={e.situacoes}
                        referencia={d!.referencia}
                      />
                    </Td>
                    <Td>
                      {e.ultimaCompetencia ? (
                        <span className="tnum">
                          {mesBR(e.ultimaCompetencia)}
                          {e.mesesAtras ? (
                            <span className="ml-1 text-xs text-muted">
                              · {e.mesesAtras} atrás
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "nunca"
                      )}
                    </Td>
                    <Td>{e.registradoEm ? dataHoraBR(e.registradoEm) : "—"}</Td>
                    <Td>{e.fechadoPor ?? "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {d && (
            <p className="text-center text-xs text-muted">
              {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {d.meses.length} competência(s) ·
              carteira do Acessórias atualizada em{" "}
              {d.carteira.atualizadoEm ? dataHoraBR(d.carteira.atualizadoEm) : "nunca"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O estado da carteira do Acessórias, com o botão que a atualiza.
 *
 * Ele mora na tela, e não só num cron, por uma razão: o dado de dois minutos
 * atrás e o de três semanas atrás se parecem na tela e não valem o mesmo. Quem
 * lê o relatório precisa ver a idade da fonte antes de acreditar nela — e poder
 * corrigi-la ali mesmo, sem esperar a madrugada.
 */
function PainelCarteira({ semCarteira }: { semCarteira: boolean }) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const { data: estado } = useCarteiraAcessorias();
  const rodando = estado?.rodando ?? null;
  const estavaRodando = useRef(false);

  useEffect(() => {
    if (rodando) {
      estavaRodando.current = true;
      return;
    }
    if (!estavaRodando.current) return;
    estavaRodando.current = false;
    // A varredura terminou: o relatório inteiro depende dela, então ele recarrega
    // sozinho — pedir que a pessoa aperte Executar de novo seria esconder que o
    // que ela está vendo já é o dado velho.
    qc.invalidateQueries({ queryKey: ["contabil-fechamento"] });
    toast.success("Carteira do Acessórias atualizada");
  }, [rodando, qc]);

  async function atualizar() {
    setEnviando(true);
    try {
      const r = await mutar<{ iniciada: boolean }>(
        "/api/contabil/produtividade-fechamento-carteira",
        "POST"
      );
      if (r.iniciada) toast.success("Buscando a carteira — leva cerca de dois minutos e meio.");
      else toast.warning("Já há uma varredura em curso.");
      qc.invalidateQueries({ queryKey: ["carteira-acessorias"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao chamar o Acessórias");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">Carteira do Acessórias</h2>
          <p className="text-xs text-muted">
            De onde vem o analista responsável por cada empresa. O job noturno das Obrigações
            também a atualiza; este botão existe para não depender da madrugada.
          </p>
        </div>
        <Button
          variant={semCarteira ? "primary" : "secondary"}
          onClick={atualizar}
          disabled={enviando || !!rodando}
        >
          <RefreshCw className={`size-4 ${rodando ? "animate-spin" : ""}`} />
          {rodando ? "Buscando…" : semCarteira ? "Buscar carteira" : "Atualizar"}
        </Button>
      </div>

      {semCarteira && !rodando && (
        <p className="mt-3 text-sm text-muted">
          Sem ela o Nexo sabe quais empresas fecharam, mas não de quem elas são — o responsável
          mora no Acessórias, não no Questor. A busca percorre a carteira inteira e leva cerca de
          dois minutos e meio; depois disso o relatório monta sozinho.
        </p>
      )}

      {estado?.erro && (
        <p className="mt-3 text-sm text-critical">
          A última varredura terminou mal: {estado.erro}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Medida
          rotulo="Atualizada em"
          valor={estado?.atualizadoEm ? dataHoraBR(estado.atualizadoEm) : "nunca"}
        />
        <Medida rotulo="Empresas ativas" valor={estado ? num(estado.empresas) : "—"} />
        <Medida
          rotulo="Com par no Questor"
          valor={estado ? num(estado.casadas) : "—"}
          apoio={estado ? `${num(estado.empresas - estado.casadas)} só no Acessórias` : undefined}
        />
        <Medida
          rotulo="Com responsável"
          valor={estado ? num(estado.comResponsavel) : "—"}
          apoio="no setor Contábil"
        />
      </div>

      {rodando && (
        <p className="mt-3 text-xs text-muted">
          Página {num(rodando.paginas)} · desde {dataHoraBR(rodando.desde)}.
        </p>
      )}

      <BlocoGrupos />
    </Card>
  );
}

/**
 * Os grupos de empresa do Acessórias, dentro do mesmo painel: são o mesmo
 * assunto ("o que o Nexo sabe do Acessórias") e quem chega aqui procurando por
 * que o filtro está vazio procura num lugar só.
 *
 * A varredura é SEPARADA da carteira porque é de outro tamanho — ~13 min contra
 * ~2,5. Uma chamada por grupo: o Acessórias não devolve o grupo junto da
 * empresa, e a flag `groups` é aceita e ignorada em silêncio.
 */
function BlocoGrupos() {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const { data } = useGruposAcessorias();
  const estado = data?.estado;
  const rodando = estado?.rodando ?? null;
  const estavaRodando = useRef(false);

  useEffect(() => {
    if (rodando) {
      estavaRodando.current = true;
      return;
    }
    if (!estavaRodando.current) return;
    estavaRodando.current = false;
    qc.invalidateQueries({ queryKey: ["contabil-fechamento"] });
    toast.success("Grupos do Acessórias atualizados");
  }, [rodando, qc]);

  async function atualizar() {
    setEnviando(true);
    try {
      const r = await mutar<{ iniciada: boolean }>(
        "/api/contabil/produtividade-fechamento-grupos",
        "POST"
      );
      if (r.iniciada) toast.success("Buscando os grupos — leva cerca de treze minutos.");
      else toast.warning("Já há uma varredura de grupos em curso.");
      qc.invalidateQueries({ queryKey: ["grupos-acessorias"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao chamar o Acessórias");
    } finally {
      setEnviando(false);
    }
  }

  const semGrupos = !!estado && estado.grupos === 0;

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">Grupos de empresa</h3>
          <p className="text-xs text-muted">
            O grupo como o Acessórias o mantém — o mesmo do cadastro da empresa lá. É o que
            alimenta o filtro de grupo desta aba. Não é o grupo de Configurações do Nexo.
          </p>
        </div>
        <Button
          variant={semGrupos ? "primary" : "secondary"}
          onClick={atualizar}
          disabled={enviando || !!rodando}
        >
          <RefreshCw className={`size-4 ${rodando ? "animate-spin" : ""}`} />
          {rodando ? "Buscando…" : semGrupos ? "Buscar grupos" : "Atualizar"}
        </Button>
      </div>

      {semGrupos && !rodando && (
        <p className="mt-3 text-sm text-muted">
          Ainda não foram buscados. A empresa não carrega o grupo dela na API, então é uma
          pergunta por grupo — cerca de treze minutos para os 425 ativos. Depois disso o filtro
          fica pronto e o job noturno o mantém.
        </p>
      )}

      {estado?.erro && (
        <p className="mt-3 text-sm text-critical">
          A última varredura de grupos terminou mal: {estado.erro}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Medida
          rotulo="Atualizados em"
          valor={estado?.atualizadoEm ? dataHoraBR(estado.atualizadoEm) : "nunca"}
        />
        <Medida rotulo="Grupos" valor={estado ? num(estado.grupos) : "—"} />
        <Medida
          rotulo="Empresas em grupo"
          valor={estado ? num(estado.vinculos) : "—"}
          apoio="vínculos gravados"
        />
        <Medida
          rotulo="Fora da carteira"
          valor={estado ? num(estado.foraDaCarteira) : "—"}
          apoio="listadas no grupo e ausentes da carteira"
        />
      </div>

      {rodando && (
        <p className="mt-3 text-xs text-muted">
          Grupo {num(rodando.grupos)} de ~425 · desde {dataHoraBR(rodando.desde)}.
        </p>
      )}
    </div>
  );
}

/**
 * O filtro de grupo desta aba, guardado na URL (`grupos_acess`).
 *
 * Na URL, e não em estado de componente, porque é recorte que se compartilha:
 * "olha o fechamento do grupo X" é um link, não um passo a passo. A barra de
 * filtros preserva parâmetros que não são dela, então o Executar dela não
 * apaga este — ver `CHAVES_DA_BARRA` em [[use-filters]].
 */
function useFiltroGrupo(): [number[], (grupos: number[]) => void] {
  const pathname = usePathname();
  const sp = useSearchParams();

  const grupos = useMemo(
    () => (sp.get("grupos_acess") ?? "").split(",").filter(Boolean).map(Number),
    [sp]
  );

  const definir = useCallback(
    (novos: number[]) => {
      const params = new URLSearchParams(sp.toString());
      if (novos.length) params.set("grupos_acess", novos.join(","));
      else params.delete("grupos_acess");
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname, sp]
  );

  return [grupos, definir];
}

function Medida({
  rotulo,
  valor,
  apoio,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className="truncate text-sm font-medium text-ink">{valor}</p>
      {apoio && <p className="truncate text-xs text-muted">{apoio}</p>}
    </div>
  );
}
