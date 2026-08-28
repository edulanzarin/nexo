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
import { useFiscalCarteira } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, num, numCompact } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import { FAIXAS_PARADA_FISCAL } from "@/lib/fiscal-carteira-tipos";
import { pctBR } from "@/lib/prod-formato";

/** Quantas empresas foram tocadas por 1, 2, 3, 4 e 5+ pessoas. */
const ROTULOS_PESSOAS = ["1 pessoa", "2 pessoas", "3 pessoas", "4 pessoas", "5 ou mais"];

export default function CarteiraFiscalPage() {
  const { qs, filtros } = useFiltros();

  const consulta = useFiscalCarteira(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const topEmpresas = useMemo<BarraItem[] | undefined>(
    () =>
      d?.empresas
        .filter((e) => e.notas > 0)
        .slice(0, 12)
        .map((e) => ({
          chave: String(e.codigo),
          nome: e.nome,
          qtd: e.notas,
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
        nome: `carteira-fiscal-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Situação", "Notas", "Entradas", "Saídas", "Pessoas",
            "Quem mais escriturou", "Valor", "Última nota", "Parada há (dias)",
          ],
          linhas: d.empresas.map((e) => [
            e.codigo,
            e.nome,
            e.ativa ? "ativa" : "baixada",
            e.notas,
            e.entradas,
            e.saidas,
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
        descricao: "Só as ativas que não receberam nenhuma nota no período",
        nome: `carteira-fiscal-sem-movimento-${periodo}`,
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Última nota", "Parada há (dias)"],
          linhas: d.empresas
            .filter((e) => e.ativa && e.notas === 0)
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
          Carteira fiscal = empresa ativa que teve nota nos últimos 12 meses · quem só faz folha ou
          contabilidade aqui fica fora da conta de cobertura
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo="fiscal" cortes={cortes} desabilitado={!d || carregando} />
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
              secundario={`da carteira fiscal (${num(d.totais.fiscal)} empresas) recebeu nota no período`}
            />
            <StatTile
              rotulo="Empresas atendidas"
              icon={<Building2 className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={num(d.totais.atendidas)}
              secundario={`${numCompact(d.totais.notas)} notas · ${brlCompact(d.totais.valor)}`}
            />
            <StatTile
              rotulo="Sem movimento"
              icon={<CircleSlash className="size-4 text-ink-2" />}
              valor={num(d.totais.paradas)}
              secundario={`de ${num(d.totais.ativas)} ativas · ${num(d.totais.semNota)} nunca tiveram nota nenhuma`}
            />
            <StatTile
              rotulo="Esquecidas"
              icon={<Briefcase className="size-4 text-ink-2" />}
              valor={num(d.totais.esquecidas)}
              secundario="da carteira fiscal, paradas entre 3 e 12 meses"
              alerta={d.totais.esquecidas > 0}
            />
            <StatTile
              rotulo="Metade do movimento"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(d.totais.metadeEm)}
              secundario="empresas concentram metade das notas do período"
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Há quanto tempo cada empresa está parada"
        subtitulo="Carteira ativa pela última nota de todos os tempos — não só a do período filtrado"
        faixas={FAIXAS_PARADA_FISCAL}
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

      <CtbCarteiraTabela
        dados={d?.empresas}
        itens={(e) => e.notas}
        faixas={FAIXAS_PARADA_FISCAL}
        rotuloItem="Notas"
        rotuloPrincipal="Quem mais escriturou"
        carregando={carregando}
        recarregando={recarregando}
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.ativas)} empresas ativas
          no escopo, {num(d.totais.fiscal)} na carteira fiscal · {num(d.totais.notas)} notas (
          {brl(d.totais.valor)})
        </p>
      )}
    </div>
  );
}
