"use client";

import { useMemo, useState } from "react";
import { Ban, Building2, FileText, Hand, Layers } from "lucide-react";
import { StatTile, Delta } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ProdFaixaClasses } from "@/components/prod-faixa-classes";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { FisProdTabela } from "@/components/fis-prod-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbProdSerie } from "@/components/charts/ctb-prod-serie";
import { CtbProdHoras } from "@/components/charts/ctb-prod-horas";
import { CalendarioAtividade } from "@/components/charts/calendario-atividade";
import { useFiltros } from "@/hooks/use-filters";
import { useFiscalProdutividade } from "@/hooks/use-api";
import { brl, brlCompact, dataBR, deltaPct, num, numCompact } from "@/lib/format";
import { decimalBR } from "@/lib/csv";
import { pctBR, pctDe, pico, slug } from "@/lib/prod-formato";
import {
  ESPECIES_PROD,
  NATUREZAS,
  rotuloNatureza,
  type FisPessoa,
} from "@/lib/fiscal-produtividade-tipos";
import { zeroDe, type SeriePontoGen } from "@/lib/prod-tipos";

/** Dia "YYYY-MM-DD" → bucket da série (o dia, ou o 1º do mês). */
const bucketDe = (d: string, g: "dia" | "mes") => (g === "mes" ? d.slice(0, 7) + "-01" : d);

/**
 * Série de UMA pessoa reprojetada nos buckets (densos) do time — só o TOTAL por
 * bucket. A quebra dia × espécie por pessoa não existe no payload (seria um
 * cubo), e ratear pela proporção do período desenharia uma distribuição que o
 * dado não sustenta — por isso o gráfico entra em modo área única.
 */
function serieDaPessoa(
  pessoa: FisPessoa,
  base: SeriePontoGen[],
  granularidade: "dia" | "mes"
): SeriePontoGen[] {
  const porBucket = new Map<string, number>();
  for (const d of pessoa.serie) {
    const b = bucketDe(d.d, granularidade);
    porBucket.set(b, (porBucket.get(b) ?? 0) + d.n);
  }
  return base.map((p) => ({
    bucket: p.bucket,
    total: porBucket.get(p.bucket) ?? 0,
    ...zeroDe(ESPECIES_PROD),
  }));
}

export default function ProdutividadeFiscalPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);
  const [especieSel, setEspecieSel] = useState<string | null>(null);

  const prod = useFiscalProdutividade(qs);
  const d = prod.data;
  const carregando = prod.isLoading;
  const recarregando = prod.isFetching && !prod.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.notas })),
    [d]
  );

  const corDaEspecie = useMemo(() => new Map(ESPECIES_PROD.map((c) => [c.id, c.cor])), []);
  const rotuloEspecie = useMemo(() => new Map(ESPECIES_PROD.map((c) => [c.id, c.rotulo])), []);

  // Espécies: do time ou só da pessoa isolada (o rótulo e a cor vêm do catálogo).
  const especies = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) {
      return d.especies.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.qtd,
        valor: e.valor,
        cor: corDaEspecie.get(e.chave),
        detalhe: `${num(e.pessoas)} pessoa(s) escrituraram esta espécie`,
      }));
    }
    return pessoa.especies.map((e) => ({
      chave: e.chave,
      nome: rotuloEspecie.get(e.chave) ?? e.chave,
      qtd: e.qtd,
      // Valor por espécie não é guardado por pessoa (só por empresa) — some do
      // tooltip em vez de virar um R$ 0,00 falso.
      cor: corDaEspecie.get(e.chave),
    }));
  }, [d, pessoa, corDaEspecie, rotuloEspecie]);

  const naturezas = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    const cor = new Map(NATUREZAS.map((n) => [n.id, n.cor]));
    const base = pessoa
      ? pessoa.naturezas.map((n) => ({ chave: n.chave, nome: rotuloNatureza(Number(n.chave)), qtd: n.qtd }))
      : d.naturezas;
    return base.map((n) => ({ ...n, cor: cor.get(n.chave) }));
  }, [d, pessoa]);

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
      total: pessoa.notas,
      pico: pico(pessoa.serie),
    };
  }, [d, pessoa]);

  // ── Exportação: os mesmos cortes da tela, com o recorte ativo aplicado ──
  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) =>
      `produtividade-fiscal-${corte}-${periodo}${doTime ? "" : alvo}`;
    const escala = d.periodo.granularidade === "mes" ? "Mês" : "Dia";

    return [
      {
        id: "pessoas",
        rotulo: "Ranking de pessoas",
        descricao: "Uma linha por pessoa, com a quebra por espécie — sempre o time inteiro",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Notas", "Entradas", "Saídas", "A dedo",
            "Canceladas", ...ESPECIES_PROD.map((e) => e.rotulo),
            "Rodadas", "Empresas", "Dias ativos", "Última nota", "Valor",
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.notas,
            p.entradas,
            p.saidas,
            p.aDedo,
            p.canceladas,
            ...ESPECIES_PROD.map((e) => p.porClasse[e.id] ?? 0),
            p.rodadas,
            p.empresas,
            p.diasAtivos,
            p.ultimo ? dataBR(p.ultimo) : "",
            decimalBR(p.valor),
          ]),
        }),
      },
      {
        id: "pessoa-especie",
        rotulo: "Pessoa × espécie",
        descricao: "Cruzamento completo — dá tabela dinâmica direto no Excel",
        nome: arquivo("pessoa-especie", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Espécie", "Notas"],
          linhas: d.ranking.flatMap((p) =>
            p.especies.map((e) => [p.nome, rotuloEspecie.get(e.chave) ?? e.chave, e.qtd])
          ),
        }),
      },
      {
        id: "especies",
        rotulo: pessoa ? `Espécies de ${pessoa.nome}` : "Espécies do time",
        descricao: "De que é feito o volume do período",
        nome: arquivo("especies"),
        montar: () => ({
          cabecalhos: pessoa
            ? ["Espécie", "Notas"]
            : ["Espécie", "Notas", "Pessoas", "Valor"],
          linhas: pessoa
            ? pessoa.especies.map((e) => [rotuloEspecie.get(e.chave) ?? e.chave, e.qtd])
            : d.especies.map((e) => [e.nome, e.qtd, e.pessoas, decimalBR(e.valor)]),
        }),
      },
      {
        id: "naturezas",
        rotulo: "Como as notas entraram",
        descricao: "Digitado, importado ou integração — a fatia de automação",
        nome: arquivo("origem"),
        montar: () => ({
          cabecalhos: ["Origem", "Notas"],
          linhas: (naturezas ?? []).map((n) => [n.nome, n.qtd]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        descricao: pessoa
          ? "As 25 empresas em que mais escriturou"
          : "As 200 empresas com mais notas no período",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Notas", "Valor"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [
            e.chave,
            e.nome,
            e.qtd,
            decimalBR(e.valor),
          ]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        descricao: `Um ${escala.toLowerCase()} por linha${pessoa ? " — só o total da pessoa" : ", com a quebra por espécie"}`,
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: pessoa
            ? [escala, "Notas"]
            : [escala, "Total", ...ESPECIES_PROD.map((e) => e.rotulo)],
          linhas: (serie ?? []).map((p) =>
            pessoa
              ? [dataBR(p.bucket), p.total]
              : [
                  dataBR(p.bucket),
                  p.total,
                  ...ESPECIES_PROD.map((e) => (typeof p[e.id] === "number" ? p[e.id] : 0)),
                ]
          ),
        }),
      },
      {
        id: "horas",
        rotulo: "Por hora do dia",
        descricao: "24 linhas — quando o trabalho acontece",
        nome: arquivo("horas"),
        montar: () => ({
          cabecalhos: ["Hora", "Notas"],
          linhas: (pessoa ? pessoa.porHora : d.porHora).map((n, h) => [
            `${String(h).padStart(2, "0")}h`,
            n,
          ]),
        }),
      },
    ];
  }, [d, pessoa, serie, naturezas, rotuloEspecie]);

  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const porClasse = pessoa ? pessoa.porClasse : (d?.totais.porClasse ?? zeroDe(ESPECIES_PROD));
  const aDedo = pessoa ? pessoa.aDedo : (d?.totais.aDedo ?? 0);
  const canceladas = pessoa ? pessoa.canceladas : (d?.totais.canceladas ?? 0);
  // "do time" / "de Fulano": o texto entra pronto nos subtítulos.
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      {/* Recorte por pessoa: vale para todos os blocos, menos o ranking */}
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro dados={opcoesPessoa} valor={pessoaSel} onMudar={setPessoaSel} />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só o trabalho desta pessoa · o ranking segue com o time todo"
            : "Período pela data em que a nota foi escriturada, não pela data do documento"}
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo="fiscal" cortes={cortes} desabilitado={!d || carregando} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando || !d ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <StatTile
              rotulo="Notas escrituradas"
              icon={<FileText className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={numCompact(notas)}
              valorCheio={num(notas)}
              secundario={`${brlCompact(valor)} movimentados`}
              delta={
                pessoa ? undefined : <Delta pct={deltaPct(d.totais.notas, d.anterior.notas)} />
              }
            />
            <StatTile
              rotulo="Entradas e saídas"
              icon={<Layers className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={numCompact(pessoa ? pessoa.entradas : d.totais.entradas)}
              valorCheio={num(pessoa ? pessoa.entradas : d.totais.entradas)}
              secundario={`entradas · ${num(pessoa ? pessoa.saidas : d.totais.saidas)} saídas`}
            />
            <StatTile
              rotulo="A dedo"
              icon={<Hand className="size-4 text-ink-2" />}
              valor={numCompact(aDedo)}
              valorCheio={num(aDedo)}
              secundario={`${pctBR(pctDe(aDedo, notas))}% do total · o resto veio da integração`}
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
              rotulo="Canceladas"
              icon={<Ban className="size-4 text-ink-2" />}
              valor={numCompact(canceladas)}
              valorCheio={num(canceladas)}
              secundario={`${pctBR(pctDe(canceladas, notas))}% das notas · o trabalho foi feito assim mesmo`}
            />
          </>
        )}
      </div>

      {/* Composição por espécie da nota */}
      {carregando || !d ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <ProdFaixaClasses
          classes={ESPECIES_PROD}
          porClasse={porClasse}
          total={notas}
          ocultarVazio={["OUTRAS", "NF"]}
        />
      )}

      {/* Ranking do time (sempre inteiro — é a comparação entre pessoas) */}
      <FisProdTabela
        dados={d?.ranking}
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
      />

      {/* Espécie × empresa */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Por espécie"
          subtitulo={`De que é feito o volume ${escopo}`}
          dados={especies}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Espécie da nota"
          selecionado={especieSel}
          onSelecionar={setEspecieSel}
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

      {/* Como as notas entraram — a fatia de automação */}
      <CtbProdBarras
        titulo="Como as notas entraram"
        subtitulo={`Digitado, importado ou integração — o grau de automação ${escopo}`}
        dados={naturezas}
        carregando={carregando}
        recarregando={recarregando}
        rotuloEixo="Origem do dado"
      />

      {/* Ritmo */}
      <CtbProdSerie
        dados={serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        soTotal={!!pessoa}
        classes={ESPECIES_PROD}
        rotuloItem="Notas"
        subtitulo={
          pessoa
            ? `Notas de ${pessoa.nome} por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"}`
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
          subtitulo={`Notas por hora do dia — ${pessoa ? pessoa.nome : "time todo"}`}
        />
        <CalendarioAtividade
          dados={calendario}
          carregando={carregando}
          recarregando={recarregando}
          subtitulo={`Notas por dia no período — ${pessoa ? pessoa.nome : "time todo"}`}
          rotuloItem="notas"
        />
      </div>

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.notas)} notas nos
          lctofisent/lctofissai ({brl(d.totais.valor)}) · período pela data da escrituração
        </p>
      )}
    </div>
  );
}
