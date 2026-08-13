"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Repeat, UserMinus, UserPlus, Users } from "lucide-react";
import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui";
import { TurnoverSerieChart } from "@/components/charts/turnover-serie-chart";
import { RotatividadeQuebra } from "@/components/rotatividade-quebra";
import { RotatividadeBarras } from "@/components/rotatividade-barras";
import { FolhaMovimentacoes } from "@/components/folha-movimentacoes";
import { PessoasModal, type Drill } from "@/components/folha-pessoas-modal";
import { PeriodoDropdown } from "@/components/filters/periodo-dropdown";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { useTurnover } from "@/hooks/use-api";
import { useEstadoModulo } from "@/hooks/use-estado-modulo";
import { EMPRESAS_RH, nomeEmpresaRh } from "@/lib/rh";
import { deltaPct, num, hojeISO, inicioDoMesISO } from "@/lib/format";

type FiltroEmpresa = "todas" | number;

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const anos = (dias: number | null) =>
  dias == null ? "—" : `${(dias / 365).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos`;

function Delta({
  atual,
  anterior,
  sentido,
}: {
  atual: number;
  anterior: number;
  sentido: "menorMelhor" | "maiorMelhor" | "neutro";
}) {
  const d = deltaPct(atual, anterior);
  if (d === null || Math.abs(d) < 0.05) {
    return <span className="text-muted">estável vs. anterior</span>;
  }
  const subiu = d > 0;
  const bom = sentido === "neutro" ? null : sentido === "menorMelhor" ? !subiu : subiu;
  const Icone = subiu ? ArrowUp : ArrowDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-medium",
        bom === null ? "text-ink-2" : bom ? "text-good" : "text-critical"
      )}
    >
      <Icone className="size-3" />
      {Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. anterior
    </span>
  );
}

function Kpi({
  rotulo,
  icone,
  corIcone,
  estiloIcone,
  valor,
  secundario,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone?: string;
  estiloIcone?: React.CSSProperties;
  valor: string;
  secundario: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-2">{rotulo}</p>
        <span className={clsx("grid size-8 place-items-center rounded-lg", corIcone)} style={estiloIcone}>
          {icone}
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="text-xs text-muted">{secundario}</p>
    </Card>
  );
}

function Stat({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <Card padding="sm" animate="none" className="flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</p>
      <p className={clsx("text-xl font-semibold tracking-tight", cor)}>{valor}</p>
    </Card>
  );
}

export default function Conteudo() {
  const [empresa, setEmpresa] = useEstadoModulo<FiltroEmpresa>("rh/rotatividade:empresa", "todas");
  const [inicio, setInicio] = useEstadoModulo("rh/rotatividade:inicio", inicioDoMesISO());
  const [fim, setFim] = useEstadoModulo("rh/rotatividade:fim", hojeISO());

  const empresasParam = empresa === "todas" ? EMPRESAS_RH.join(",") : String(empresa);
  const qs = `inicio=${inicio}&fim=${fim}&empresas=${empresasParam}`;

  // Nada consulta até o Visualizar (padrão executar-por-botão): `qs` é o rascunho;
  // só `executar` comita para `qsAplicado`. Persiste no módulo (voltar mantém).
  const [qsAplicado, setQsAplicado] = useEstadoModulo<string | null>(
    "rh/rotatividade:qsAplicado",
    null
  );
  const queryClient = useQueryClient();

  const turnover = useTurnover(qsAplicado ?? "", qsAplicado != null, "rh");
  const d = turnover.data;
  const c = d?.consolidado;
  const carregando = turnover.isLoading;
  const recarregando = turnover.isFetching && !turnover.isLoading;

  const motivos = useMemo(() => d?.motivos, [d]);
  const tenure = useMemo(() => d?.tenure, [d]);

  const [drill, setDrill] = useState<Drill | null>(null);
  const abrirDrill = (dim: string, valor: string, rotulo: string) => setDrill({ dim, valor, rotulo });

  const empresaSeg: { valor: FiltroEmpresa; rotulo: string }[] = [
    { valor: "todas", rotulo: "Todas" },
    ...EMPRESAS_RH.map((cod) => ({ valor: cod as FiltroEmpresa, rotulo: nomeEmpresaRh(cod) })),
  ];

  const dirty = qsAplicado !== qs;
  const executar = () => {
    setQsAplicado(qs);
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[1] === "rh" &&
        ["turnover", "movimentacoes", "folha-pessoas"].includes(query.queryKey[0] as string),
    });
  };

  return (
    <>
      {/* Controles: empresa + período, alinhados à esquerda (padrão dos módulos) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {empresaSeg.map((s) => (
            <button
              key={String(s.valor)}
              onClick={() => setEmpresa(s.valor)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                empresa === s.valor ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <PeriodoDropdown
          inicio={inicio}
          fim={fim}
          onChange={(i, f) => {
            setInicio(i);
            setFim(f);
          }}
        />

        <div className="ml-auto">
          <BotaoExecutar onClick={executar} dirty={dirty} rotulo="Visualizar" />
        </div>
      </div>

      {qsAplicado == null ? (
        <FiltroPendente rotulo="Visualizar" />
      ) : (
      <>
      {turnover.error && (
        <p className="text-sm text-critical">
          {turnover.error instanceof Error ? turnover.error.message : "Falha ao carregar"}
        </p>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregando || !c ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <Kpi
              rotulo="Turnover geral"
              icone={<Repeat className="size-4" style={{ color: "var(--esp-5)" }} />}
              estiloIcone={{ backgroundColor: "color-mix(in srgb, var(--esp-5) 12%, transparent)" }}
              valor={pct(c.turnover)}
              secundario={<Delta atual={c.turnover} anterior={d!.anterior.turnover} sentido="menorMelhor" />}
            />
            <Kpi
              rotulo="Admissões"
              icone={<UserPlus className="size-4 text-good" />}
              corIcone="bg-good/12"
              valor={num(c.admissoes)}
              secundario={<Delta atual={c.admissoes} anterior={d!.anterior.admissoes} sentido="neutro" />}
            />
            <Kpi
              rotulo="Desligamentos"
              icone={<UserMinus className="size-4 text-critical" />}
              corIcone="bg-critical/12"
              valor={num(c.desligamentos)}
              secundario={
                <Delta atual={c.desligamentos} anterior={d!.anterior.desligamentos} sentido="menorMelhor" />
              }
            />
            <Kpi
              rotulo="Colaboradores ativos"
              icone={<Users className="size-4 text-ink-2" />}
              corIcone="bg-surface-2"
              valor={num(c.ativos)}
              secundario={<Delta atual={c.ativos} anterior={d!.anterior.ativos} sentido="maiorMelhor" />}
            />
          </>
        )}
      </div>

      {/* Métricas secundárias */}
      {!carregando && c && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            rotulo="Saldo de pessoal"
            valor={`${c.saldo > 0 ? "+" : ""}${num(c.saldo)}`}
            cor={c.saldo > 0 ? "text-good" : c.saldo < 0 ? "text-critical" : undefined}
          />
          <Stat rotulo="Deslig. voluntários" valor={num(c.voluntarios)} />
          <Stat rotulo="Deslig. involuntários" valor={num(c.involuntarios)} />
          <Stat rotulo="Tempo médio de casa" valor={anos(c.tempoMedioCasaDias)} />
        </div>
      )}

      {/* Tendência */}
      {(carregando || (d && d.serie.length >= 2)) && (
        <TurnoverSerieChart dados={d?.serie} carregando={carregando} recarregando={recarregando} />
      )}

      {/* Movimentações + ficha (empresa vem da linha) */}
      <FolhaMovimentacoes qs={qsAplicado ?? ""} modulo="rh" />

      {/* Desligados */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RotatividadeBarras
          titulo="Motivo do desligamento"
          subtitulo=""
          dados={motivos}
          cor="var(--critical)"
          vazio="Nenhum desligamento no período"
          carregando={carregando}
          recarregando={recarregando}
          dim="motivo"
          onDrill={abrirDrill}
        />
        <RotatividadeBarras
          titulo="Tempo de casa dos desligados"
          subtitulo=""
          dados={tenure}
          cor="var(--esp-5)"
          vazio="Nenhum desligamento no período"
          carregando={carregando}
          recarregando={recarregando}
          dim="tempoCasa"
          onDrill={abrirDrill}
        />
      </div>

      {/* Quebras */}
      <RotatividadeQuebra
        titulo="Turnover por setor"
        subtitulo=""
        rotuloColuna="Setor"
        dados={d?.organogramas}
        total={c}
        carregando={carregando}
        recarregando={recarregando}
        dim="setor"
        onDrill={abrirDrill}
      />
      <RotatividadeQuebra
        titulo="Turnover por cargo"
        subtitulo=""
        rotuloColuna="Cargo"
        dados={d?.cargos}
        total={c}
        carregando={carregando}
        recarregando={recarregando}
        dim="cargo"
        onDrill={abrirDrill}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <RotatividadeQuebra
            titulo="Turnover por faixa etária"
            subtitulo=""
            rotuloColuna="Faixa etária"
            dados={d?.faixaEtaria}
            total={c}
            carregando={carregando}
            recarregando={recarregando}
            dim="faixaEtaria"
            onDrill={abrirDrill}
            compacto
          />
        </div>
        <RotatividadeQuebra
          titulo="Turnover por estabelecimento"
          subtitulo=""
          rotuloColuna="Estabelecimento"
          dados={d?.estabelecimentos}
          total={c}
          carregando={carregando}
          recarregando={recarregando}
          dim="estab"
          onDrill={abrirDrill}
          compacto
        />
        <RotatividadeQuebra
          titulo="Turnover por sexo"
          subtitulo=""
          rotuloColuna="Sexo"
          dados={d?.sexo}
          total={c}
          carregando={carregando}
          recarregando={recarregando}
          dim="sexo"
          onDrill={abrirDrill}
          compacto
        />
        <RotatividadeQuebra
          titulo="Turnover por escolaridade"
          subtitulo=""
          rotuloColuna="Escolaridade"
          dados={d?.escolaridade}
          total={c}
          carregando={carregando}
          recarregando={recarregando}
          dim="escolaridade"
          onDrill={abrirDrill}
          compacto
        />
      </div>

      <PessoasModal qsBase={qsAplicado ?? ""} drill={drill} onFechar={() => setDrill(null)} modulo="rh" />
      </>
      )}
    </>
  );
}
