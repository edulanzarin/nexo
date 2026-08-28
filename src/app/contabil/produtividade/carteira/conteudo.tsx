"use client";

import { useMemo } from "react";
import { Briefcase, Building2, CircleSlash, Percent, Users } from "lucide-react";
import { StatTile } from "@/components/ui";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbCarteiraTabela } from "@/components/ctb-carteira-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbEscada } from "@/components/charts/ctb-escada";
import { CtbPareto } from "@/components/charts/ctb-pareto";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilCarteira } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, num, numCompact } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import { FAIXAS_PARADA } from "@/lib/contabil-carteira-tipos";
import { pctBR } from "@/lib/prod-formato";

/** Quantas empresas foram tocadas por 1, 2, 3, 4 e 5+ pessoas. */
const ROTULOS_PESSOAS = ["1 pessoa", "2 pessoas", "3 pessoas", "4 pessoas", "5 ou mais"];

export default function CarteiraContabilPage() {
  const { qs, filtros } = useFiltros();

  const consulta = useContabilCarteira(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const topEmpresas = useMemo<BarraItem[] | undefined>(
    () =>
      d?.empresas
        .filter((e) => e.lancamentos > 0)
        .slice(0, 12)
        .map((e) => ({
          chave: String(e.codigo),
          nome: e.nome,
          qtd: e.lancamentos,
          valor: e.valor,
          detalhe: e.principal ? `principalmente ${e.principal}` : undefined,
        })),
    [d]
  );

  const equipePorEmpresa = useMemo<BarraItem[] | undefined>(
    () =>
      d?.porPessoas.map((qtd, i) => ({
        chave: String(i + 1),
        nome: ROTULOS_PESSOAS[i],
        qtd,
      })),
    [d]
  );

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    return [
      {
        id: "carteira",
        rotulo: "Carteira inteira",
        descricao: "Uma linha por empresa, com movimento do período e tempo parada",
        nome: `carteira-contabil-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Situação", "Lançamentos", "Pessoas", "Quem mais lançou",
            "Valor", "Último lançamento", "Parada há (dias)",
          ],
          linhas: d.empresas.map((e) => [
            e.codigo,
            e.nome,
            e.ativa ? "ativa" : "baixada",
            e.lancamentos,
            e.pessoas,
            e.principal ?? "",
            decimalBR(e.valor),
            e.ultimo ?? "",
            e.diasParada ?? "",
          ]),
        }),
      },
      {
        id: "paradas",
        rotulo: "Empresas sem movimento",
        descricao: "Só as ativas que não receberam nenhum lançamento no período",
        nome: `carteira-contabil-sem-movimento-${periodo}`,
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Último lançamento", "Parada há (dias)"],
          linhas: d.empresas
            .filter((e) => e.ativa && e.lancamentos === 0)
            .sort((a, b) => (b.diasParada ?? 1e9) - (a.diasParada ?? 1e9))
            .map((e) => [e.codigo, e.nome, e.ultimo ?? "nunca teve", e.diasParada ?? ""]),
        }),
      },
    ];
  }, [d]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">
          Carteira contábil = empresa ativa que teve lançamento nos últimos 12 meses · quem só faz
          folha ou fiscal aqui fica fora da conta de cobertura
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo="contabil" cortes={cortes} desabilitado={!d || carregando} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando || !d ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <StatTile
              rotulo="Cobertura"
              icon={<Percent className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={`${pctBR(d.totais.cobertura)}%`}
              secundario={`da carteira contábil (${num(d.totais.contabil)} empresas) recebeu lançamento no período`}
            />
            <StatTile
              rotulo="Empresas atendidas"
              icon={<Building2 className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={num(d.totais.atendidas)}
              secundario={`${numCompact(d.totais.lancamentos)} lançamentos · ${brlCompact(d.totais.valor)}`}
            />
            <StatTile
              rotulo="Sem movimento"
              icon={<CircleSlash className="size-4 text-ink-2" />}
              valor={num(d.totais.paradas)}
              secundario={`de ${num(d.totais.ativas)} ativas · ${num(d.totais.semLancamento)} nunca tiveram lançamento nenhum`}
            />
            <StatTile
              rotulo="Esquecidas"
              icon={<Briefcase className="size-4 text-ink-2" />}
              valor={num(d.totais.esquecidas)}
              secundario="da carteira contábil, paradas entre 3 e 12 meses"
              alerta={d.totais.esquecidas > 0}
            />
            <StatTile
              rotulo="Metade do movimento"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(d.totais.metadeEm)}
              secundario="empresas concentram metade dos lançamentos do período"
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Há quanto tempo cada empresa está parada"
        subtitulo="Carteira ativa pelo último lançamento de todos os tempos — não só o do período filtrado"
        faixas={FAIXAS_PARADA}
        valores={d?.porFaixa}
        rotuloItem="empresas ativas"
        carregando={carregando || !d}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Empresas com mais movimento"
          subtitulo="Onde o trabalho do período se concentrou"
          dados={topEmpresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
        />
        <CtbPareto
          dados={d?.pareto}
          metadeEm={d?.totais.metadeEm ?? 0}
          carregando={carregando}
          recarregando={recarregando}
        />
      </div>

      <CtbProdBarras
        titulo="Quantas pessoas por empresa"
        subtitulo="Empresa atendida por uma pessoa só depende dela; atendida por muitas pode estar sem dono"
        dados={equipePorEmpresa}
        carregando={carregando}
        recarregando={recarregando}
        rotuloEixo="Tamanho da equipe na empresa"
        rotuloQtd="Empresas"
        corPadrao="var(--esp-5)"
        limite={5}
      />

      <CtbCarteiraTabela dados={d?.empresas} carregando={carregando} recarregando={recarregando} />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.ativas)} empresas ativas
          no escopo, {num(d.totais.contabil)} na carteira contábil · {num(d.totais.lancamentos)}{" "}
          lançamentos ({brl(d.totais.valor)})
        </p>
      )}
    </div>
  );
}
