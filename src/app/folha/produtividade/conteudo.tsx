"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Calculator,
  FileMinus,
  LayoutDashboard,
  Plane,
  Send,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { DpRankingTabela } from "@/components/dp-ranking-tabela";
import { DpBarras } from "@/components/dp-barras";
import { DpComposicaoDonut, DpColaboradorStack } from "@/components/dp-composicao";
import { DpFuncionarioFiltro } from "@/components/dp-funcionario-filtro";
import { DpSerieChart } from "@/components/charts/dp-serie-chart";
import { Card } from "@/components/ui";
import { useFiltros } from "@/hooks/use-filters";
import { useDpProdutividade, useDpQuebra } from "@/hooks/use-api";
import { num, deltaPct } from "@/lib/format";
import {
  DP_FAMILIAS,
  infoDoTipo,
  tiposDaFamilia,
  type DpColaborador,
  type DpFamilia,
  type DpPorTipo,
  type DpTipo,
} from "@/lib/dp-tipos";
import { useProdutividadeTabs } from "./tabs";

/**
 * Cor e ícone por FAMÍLIA. Eram por trabalho, e com doze trabalhos a paleta
 * não dá — e a legenda também não. A família carrega a identidade visual; o
 * trabalho dentro dela herda.
 */
const COR: Record<DpFamilia, string> = {
  movimentacao: "var(--ent)",
  ferias: "var(--sai)",
  folha: "var(--esp-2)",
  cadastro: "var(--esp-5)",
  esocial: "var(--esp-1)",
};

const ICONE: Record<DpFamilia | "total", React.ReactNode> = {
  total: <CalendarClock className="size-4 text-ink-2" />,
  movimentacao: <UserPlus className="size-4 text-ent" />,
  ferias: <Plane className="size-4 text-sai" />,
  folha: <Calculator className="size-4" style={{ color: "var(--esp-2)" }} />,
  cadastro: <FileMinus className="size-4" style={{ color: "var(--esp-5)" }} />,
  esocial: <Send className="size-4" style={{ color: "var(--esp-1)" }} />,
};

const BG_ICONE: Record<DpFamilia | "total", string> = {
  total: "bg-surface-2",
  movimentacao: "bg-ent/12",
  ferias: "bg-sai/12",
  folha: "bg-surface-2",
  cadastro: "bg-surface-2",
  esocial: "bg-surface-2",
};

/** Soma os trabalhos de uma família numa contagem por tipo. */
const somaFamilia = (por: DpPorTipo | undefined, f: DpFamilia): number =>
  tiposDaFamilia(f).reduce((a, t) => a + (por?.[t.id] ?? 0), 0);

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const d = deltaPct(atual, anterior);
  if (d == null) return <span className="text-muted">sem base anterior</span>;
  const zero = Math.abs(d) < 0.05;
  return (
    <span className={clsx(zero ? "text-muted" : d > 0 ? "text-ent" : "text-critical")}>
      {zero ? "estável" : `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. anterior`}
    </span>
  );
}

function Kpi({
  rotulo,
  icone,
  corIcone,
  valor,
  secundario,
  rodape,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  secundario: React.ReactNode;
  /** Linha extra, menor — usada para o tamanho do lote atrás do gesto. */
  rodape?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)}>{icone}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="text-xs">{secundario}</p>
      {rodape && <p className="text-[11px] leading-snug">{rodape}</p>}
    </Card>
  );
}

/**
 * Aba de uma FAMÍLIA: um cartão por trabalho dela, e os gráficos do trabalho
 * escolhido. Os gráficos continuam por trabalho porque a quebra do servidor é
 * por trabalho (`/dp-quebra?tipo=`) — somar famílias no cliente inventaria uma
 * série que o banco não devolveu.
 */
function AbaFamilia({
  familia,
  qs,
  ranking,
  totais,
  linhas,
  anterior,
  carregandoResumo,
  usuarioSel,
  onSelecionar,
}: {
  familia: DpFamilia;
  qs: string;
  ranking: DpColaborador[] | undefined;
  totais: DpPorTipo | undefined;
  linhas: DpPorTipo | undefined;
  anterior: DpPorTipo | undefined;
  carregandoResumo: boolean;
  usuarioSel: number | null;
  onSelecionar: (codigo: number | null) => void;
}) {
  const trabalhos = tiposDaFamilia(familia);
  const [tipo, setTipo] = useState<DpTipo>(trabalhos[0].id);
  // Trocar de família reposiciona no primeiro trabalho dela — sem isto, a aba
  // Folha abriria mostrando o gráfico de "Avisos prévios" que ficou no estado.
  if (!trabalhos.some((t) => t.id === tipo)) setTipo(trabalhos[0].id);

  const info = infoDoTipo(tipo);
  const rotulo = info.rotulo;
  const cor = COR[familia];

  // Filtro por colaborador vale para série e por-empresa (não para o
  // ranking/por-colaborador, que é a comparação entre pessoas).
  const listaQs = usuarioSel != null ? `${qs}&usuario=${usuarioSel}` : qs;
  const quebra = useDpQuebra(listaQs, tipo);

  // Quebra por colaborador: sai do ranking já carregado (quem fez ESTE trabalho).
  const porColaborador = useMemo(
    () =>
      ranking
        ? ranking
            .map((c) => ({ codigo: c.codigo, nome: c.nome, qtd: c.porTipo[tipo] }))
            .filter((c) => c.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd)
        : undefined,
    [ranking, tipo]
  );

  const selNome = usuarioSel != null ? ranking?.find((c) => c.codigo === usuarioSel)?.nome : null;
  const colabTipo =
    usuarioSel != null
      ? (ranking?.find((c) => c.codigo === usuarioSel)?.porTipo[tipo] ?? 0)
      : null;

  const nColab = porColaborador?.filter((c) => c.codigo !== 0).length ?? 0;
  const totalTeam = totais?.[tipo] ?? 0;
  const totalMostrado = colabTipo != null ? colabTipo : totalTeam;
  const nEmpresas = quebra.data?.porEmpresa.length ?? 0;
  const media = nColab > 0 ? Math.round(totalTeam / nColab) : 0;
  const topEmpresa = quebra.data?.porEmpresa[0];
  const topColab = porColaborador?.[0];

  return (
    <>
      {/* Seletor de trabalho dentro da família — some quando ela tem um só */}
      {trabalhos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {trabalhos.map((t) => {
            const ativo = t.id === tipo;
            return (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                title={t.descricao}
                aria-pressed={ativo}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  ativo
                    ? "border-accent/40 bg-accent/10 font-medium text-accent"
                    : "border-hairline text-ink-2 hover:bg-surface-2"
                )}
              >
                {t.rotulo}
                <span className="ml-1.5 tabular-nums text-muted">{num(totais?.[t.id] ?? 0)}</span>
              </button>
            );
          })}
        </div>
      )}

      {info.temAutomacao && (
        <p className="text-xs text-muted">
          Parte deste trabalho é rotina automática e cai no usuário “Sistema” — ele aparece no
          ranking marcado como automático, e não some do total porque o volume é real.
        </p>
      )}

      {/* KPIs do trabalho */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregandoResumo || !totais || !anterior ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo={rotulo}
              icone={ICONE[familia]}
              corIcone={BG_ICONE[familia]}
              valor={num(totalMostrado)}
              secundario={
                colabTipo != null ? (
                  <span className="text-muted">de {selNome}</span>
                ) : (
                  <Delta atual={totalTeam} anterior={anterior[tipo]} />
                )
              }
              rodape={
                info.gesto ? (
                  <span className="text-muted">
                    {num(linhas?.[tipo] ?? 0)} linha(s) de funcionário — um{" "}
                    {info.unidade} cobre a empresa inteira
                  </span>
                ) : undefined
              }
            />
            <Kpi
              rotulo="Colaboradores"
              icone={<UserPlus className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(usuarioSel != null ? 1 : nColab)}
              secundario={
                <span className="text-muted">
                  {topColab ? `líder: ${topColab.nome}` : "ninguém no período"}
                </span>
              }
            />
            <Kpi
              rotulo="Empresas atendidas"
              icone={<CalendarClock className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={quebra.isLoading ? "…" : num(nEmpresas)}
              secundario={
                <span className="text-muted">
                  {topEmpresa ? `maior: ${topEmpresa.nome}` : "—"}
                </span>
              }
            />
            <Kpi
              rotulo="Média por colaborador"
              icone={<LayoutDashboard className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(media)}
              secundario={<span className="text-muted">registros/pessoa no time</span>}
            />
          </>
        )}
      </div>

      {/* Por colaborador (eixo principal) + por empresa */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DpBarras
          titulo="Por colaborador"
          subtitulo="Quem fez este trabalho no período · clique para isolar"
          dados={porColaborador}
          cor={cor}
          carregando={carregandoResumo}
          recarregando={false}
          rotuloEixo="Colaborador"
          selecionado={usuarioSel}
          onSelecionar={onSelecionar}
        />
        <DpBarras
          titulo="Por empresa"
          subtitulo={usuarioSel != null ? `Empresas de ${selNome}` : "Onde o trabalho aconteceu"}
          dados={quebra.data?.porEmpresa}
          cor={cor}
          carregando={quebra.isLoading}
          recarregando={quebra.isFetching && !quebra.isLoading}
          rotuloEixo="Empresa"
        />
      </div>

      {/* Evolução no tempo */}
      <DpSerieChart
        titulo="Evolução no período"
        dados={quebra.data}
        cor={cor}
        carregando={quebra.isLoading}
        recarregando={quebra.isFetching && !quebra.isLoading}
      />
    </>
  );
}

export default function ProdutividadeDpPage() {
  const { qs } = useFiltros();
  const { menu } = useProdutividadeTabs();
  const [usuarioSel, setUsuarioSel] = useState<number | null>(null);

  const resumo = useDpProdutividade(qs);
  const t = resumo.data?.totais;
  const ant = resumo.data?.anterior;
  const carregandoResumo = resumo.isLoading;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro por funcionário da Navecon — recorta o dashboard inteiro */}
      <div className="flex flex-wrap items-center gap-2">
        <DpFuncionarioFiltro
          dados={resumo.data?.ranking}
          valor={usuarioSel}
          onMudar={setUsuarioSel}
        />
        {usuarioSel != null && (
          <span className="text-xs text-muted">
            Mostrando só o trabalho deste funcionário · o ranking segue com o time todo
          </span>
        )}
      </div>

      {menu === "geral" ? (
        <>
          {/* KPIs — uma família por cartão, mais o total, com delta vs. anterior */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {carregandoResumo || !t || !ant ? (
              Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-36" />)
            ) : (
              <>
                {DP_FAMILIAS.map((f) => (
                  <Kpi
                    key={f.id}
                    rotulo={f.rotulo}
                    icone={ICONE[f.id]}
                    corIcone={BG_ICONE[f.id]}
                    valor={num(somaFamilia(t.porTipo, f.id))}
                    secundario={
                      <Delta
                        atual={somaFamilia(t.porTipo, f.id)}
                        anterior={somaFamilia(ant.porTipo, f.id)}
                      />
                    }
                  />
                ))}
                <Kpi
                  rotulo="Total no período"
                  icone={ICONE.total}
                  corIcone={BG_ICONE.total}
                  valor={num(t.total)}
                  secundario={
                    <span className="text-muted">
                      {num(resumo.data!.colaboradores)} colaboradores do DP
                    </span>
                  }
                />
              </>
            )}
          </div>

          {/* Mais dashboard: composição dos quatro trabalhos + top empilhado */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DpComposicaoDonut
              totais={t?.porTipo}
              cores={COR}
              carregando={carregandoResumo}
              recarregando={resumo.isFetching && !resumo.isLoading}
            />
            <DpColaboradorStack
              dados={resumo.data?.ranking}
              cores={COR}
              carregando={resumo.isLoading}
              recarregando={resumo.isFetching && !resumo.isLoading}
              selecionado={usuarioSel}
              onSelecionar={setUsuarioSel}
            />
          </div>

          <DpRankingTabela
            dados={resumo.data?.ranking}
            carregando={resumo.isLoading}
            recarregando={resumo.isFetching && !resumo.isLoading}
            selecionado={usuarioSel}
            onSelecionar={setUsuarioSel}
          />

          <p className="text-center text-xs text-muted">
            Clique num colaborador para recortar a tela · cada família tem aba própria com os
            trabalhos dentro dela
          </p>
        </>
      ) : (
        <AbaFamilia
          familia={menu}
          qs={qs}
          ranking={resumo.data?.ranking}
          totais={t?.porTipo}
          linhas={t?.linhas}
          anterior={ant?.porTipo}
          carregandoResumo={carregandoResumo}
          usuarioSel={usuarioSel}
          onSelecionar={setUsuarioSel}
        />
      )}
    </div>
  );
}
