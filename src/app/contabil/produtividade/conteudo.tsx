"use client";

import { useMemo, useState } from "react";
import { Building2, Clock, FileText, Layers, Users } from "lucide-react";
import { StatTile, Delta } from "@/components/ui";
import { CtbPessoaFiltro } from "@/components/ctb-pessoa-filtro";
import { CtbProdTabela } from "@/components/ctb-prod-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbProdSerie } from "@/components/charts/ctb-prod-serie";
import { CtbProdHoras } from "@/components/charts/ctb-prod-horas";
import { CalendarioAtividade } from "@/components/charts/calendario-atividade";
import { useFiltros } from "@/hooks/use-filters";
import { useContabilProdutividade } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, deltaPct, num, numCompact } from "@/lib/format";
import {
  CLASSES,
  zeroClasses,
  type CtbDia,
  type CtbPessoa,
  type CtbSeriePonto,
  type PorClasse,
} from "@/lib/contabil-produtividade-tipos";

/** Dia "YYYY-MM-DD" → bucket da série (o dia, ou o 1º do mês). */
const bucketDe = (d: string, g: "dia" | "mes") => (g === "mes" ? d.slice(0, 7) + "-01" : d);

/**
 * Série de UMA pessoa reprojetada nos buckets (densos) do time — só o TOTAL por
 * bucket. A quebra dia × natureza por pessoa não existe no payload (seria um
 * cubo), e ratear pela proporção do período desenharia uma distribuição que o
 * dado não sustenta — por isso o gráfico entra em modo área única.
 */
function serieDaPessoa(
  pessoa: CtbPessoa,
  base: CtbSeriePonto[],
  granularidade: "dia" | "mes"
): CtbSeriePonto[] {
  const porBucket = new Map<string, number>();
  for (const d of pessoa.serie) {
    const b = bucketDe(d.d, granularidade);
    porBucket.set(b, (porBucket.get(b) ?? 0) + d.n);
  }
  return base.map((p) => ({
    bucket: p.bucket,
    total: porBucket.get(p.bucket) ?? 0,
    ...zeroClasses(),
  }));
}

function pico(celulas: CtbDia[]): CtbDia | null {
  let melhor: CtbDia | null = null;
  for (const c of celulas) if (!melhor || c.n > melhor.n) melhor = c;
  return melhor;
}

/** Faixa de classes: a composição do período em quatro números, com o peso. */
function FaixaClasses({ porClasse, total }: { porClasse: PorClasse; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {CLASSES.map((c) => {
        const n = porClasse[c.id];
        if (c.id === "outros" && n === 0) return null;
        const pct = total > 0 ? (n / total) * 100 : 0;
        return (
          <StatTile
            key={c.id}
            size="mini"
            as="cell"
            rotulo={c.rotulo}
            icon={
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: c.cor }}
                aria-hidden
              />
            }
            valor={numCompact(n)}
            valorCheio={num(n)}
            secundario={`${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% · ${c.descricao}`}
          />
        );
      })}
    </div>
  );
}

export default function ProdutividadeContabilPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);
  const [origemSel, setOrigemSel] = useState<string | null>(null);

  const prod = useContabilProdutividade(qs);
  const d = prod.data;
  const carregando = prod.isLoading;
  const recarregando = prod.isFetching && !prod.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const corDaClasse = useMemo(
    () => new Map(CLASSES.map((c) => [c.id, c.cor])),
    []
  );

  // Origens: do time ou só da pessoa isolada (o rótulo/classe vem do time).
  const origens = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) {
      return d.origens.map((o) => ({
        chave: o.chave,
        nome: o.nome,
        qtd: o.qtd,
        valor: o.valor,
        cor: corDaClasse.get(o.classe),
        detalhe: `${num(o.pessoas)} pessoa(s) usaram esta origem`,
      }));
    }
    const meta = new Map(d.origens.map((o) => [o.chave, o]));
    return pessoa.origens.map((o) => {
      const m = meta.get(o.chave);
      const classe = m?.classe ?? "outros";
      return {
        chave: o.chave,
        nome: m?.nome ?? o.chave,
        qtd: o.qtd,
        // Valor por origem não é guardado por pessoa (só por empresa) — some do
        // tooltip em vez de virar um R$ 0,00 falso.
        cor: corDaClasse.get(classe),
        detalhe: CLASSES.find((c) => c.id === classe)?.rotulo,
      };
    });
  }, [d, pessoa, corDaClasse]);

  const empresas = useMemo<BarraItem[] | undefined>(() => {
    const base = pessoa ? pessoa.topEmpresas : d?.empresas;
    return base?.map((e) => ({ ...e }));
  }, [d, pessoa]);

  const serie = useMemo(() => {
    if (!d) return undefined;
    return pessoa ? serieDaPessoa(pessoa, d.serie, d.periodo.granularidade) : d.serie;
  }, [d, pessoa]);

  const calendario = useMemo(() => {
    if (!d) return undefined;
    if (!pessoa) return d.calendario;
    return {
      inicio: d.periodo.inicio,
      fim: d.periodo.fim,
      celulas: pessoa.serie,
      total: pessoa.lancamentos,
      pico: pico(pessoa.serie),
    };
  }, [d, pessoa]);

  const lancamentos = pessoa ? pessoa.lancamentos : (d?.totais.lancamentos ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const porClasse = pessoa ? pessoa.porClasse : (d?.totais.porClasse ?? zeroClasses());
  // "do time" / "de Fulano": o texto entra pronto nos subtítulos.
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      {/* Recorte por pessoa: vale para todos os blocos, menos o ranking */}
      <div className="flex flex-wrap items-center gap-2">
        <CtbPessoaFiltro dados={d?.ranking} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só o trabalho desta pessoa · o ranking segue com o time todo"
            : "Período pela data em que o lançamento foi feito, não pela data do fato"}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando || !d ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <StatTile
              rotulo="Lançamentos"
              icon={<FileText className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={numCompact(lancamentos)}
              valorCheio={num(lancamentos)}
              secundario={`${brlCompact(valor)} movimentados`}
              delta={
                pessoa ? undefined : (
                  <Delta pct={deltaPct(d.totais.lancamentos, d.anterior.lancamentos)} />
                )
              }
            />
            <StatTile
              rotulo="Digitado a dedo"
              icon={<Layers className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={numCompact(porClasse.digitado)}
              valorCheio={num(porClasse.digitado)}
              secundario={`${
                lancamentos > 0
                  ? ((porClasse.digitado / lancamentos) * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })
                  : "0"
              }% do total · o resto veio de rotina`}
            />
            <StatTile
              rotulo="Pessoas no período"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(pessoa ? 1 : d.totais.pessoas)}
              secundario={
                pessoa
                  ? `${num(pessoa.diasAtivos)} dias com lançamento`
                  : `${num(d.totais.diasAtivos)} dias com movimento`
              }
            />
            <StatTile
              rotulo="Empresas atendidas"
              icon={<Building2 className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.empresas : d.totais.empresas)}
              secundario={
                <span className="line-clamp-2">
                  {(pessoa ? pessoa.topEmpresas[0] : d.empresas[0])?.nome ?? "sem movimento"}
                </span>
              }
            />
            <StatTile
              rotulo="Rodadas"
              icon={<Clock className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.rodadas : d.totais.rodadas)}
              secundario="empresa × dia × origem"
            />
          </>
        )}
      </div>

      {/* Composição por natureza do lançamento */}
      {carregando || !d ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <FaixaClasses porClasse={porClasse} total={lancamentos} />
      )}

      {/* Ranking do time (sempre inteiro — é a comparação entre pessoas) */}
      <CtbProdTabela
        dados={d?.ranking}
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
      />

      {/* Origem × empresa */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Por origem"
          subtitulo={`De onde vieram os lançamentos ${escopo}`}
          dados={origens}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Origem do lançamento"
          selecionado={origemSel}
          onSelecionar={setOrigemSel}
        />
        <CtbProdBarras
          titulo="Por empresa"
          subtitulo={pessoa ? `Empresas atendidas por ${pessoa.nome}` : "Onde o trabalho aconteceu"}
          dados={empresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
        />
      </div>

      {/* Ritmo */}
      <CtbProdSerie
        dados={serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        soTotal={!!pessoa}
        subtitulo={
          pessoa
            ? `Lançamentos de ${pessoa.nome} por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"}`
            : undefined
        }
        carregando={carregando}
        recarregando={recarregando}
      />

      <div className="grid grid-cols-1 gap-4">
        <CtbProdHoras
          dados={pessoa ? pessoa.porHora : d?.porHora}
          carregando={carregando}
          recarregando={recarregando}
          subtitulo={`Lançamentos por hora do dia — ${pessoa ? pessoa.nome : "time todo"}`}
        />
        <CalendarioAtividade
          dados={calendario}
          carregando={carregando}
          recarregando={recarregando}
          subtitulo={`Lançamentos por dia no período — ${pessoa ? pessoa.nome : "time todo"}`}
          rotuloItem="lançamentos"
        />
      </div>

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.lancamentos)} lançamentos
          no lctoctb ({brl(d.totais.valor)}) · período pela data do lançamento
        </p>
      )}
    </div>
  );
}
