"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarRange, CircleAlert, History, Layers, Timer } from "lucide-react";
import { StatTile, Delta } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbEscada } from "@/components/charts/ctb-escada";
import { CtbAtrasoSerie } from "@/components/charts/ctb-atraso-serie";
import { CtbCompetencias } from "@/components/charts/ctb-competencias";
import { CtbProdHoras } from "@/components/charts/ctb-prod-horas";
import { useFiltros } from "@/hooks/use-filters";
import { useFiscalApuracao } from "@/hooks/use-api";
import { dataBR, deltaPct, mesBR, num, numCompact } from "@/lib/format";
import { FAIXAS_APURACAO, rotuloImposto, type FisApuPessoa } from "@/lib/fiscal-apuracao-tipos";
import { faixaDe } from "@/lib/prod-escala";
import { emDias, pctBR, pctDe, slug } from "@/lib/prod-formato";

const compet = (v: string | null) => (v ? mesBR(v + "-01") : "—");

const COLUNAS: ColunaRanking<FisApuPessoa>[] = [
  {
    key: "fechamentos",
    rotulo: "Fechamentos",
    titulo: "Empresa × competência fechada — o gesto, não a linha",
    valor: (p) => p.fechamentos,
  },
  {
    key: "apuracoes",
    rotulo: "Apurações",
    titulo: "Linhas: um imposto apurado dentro de um fechamento",
    valor: (p) => p.apuracoes,
  },
  {
    key: "mediana",
    rotulo: "Atraso mediano",
    titulo: "Metade do que ela fechou saiu depois disto, contado do fim da competência",
    valor: (p) => p.mediana ?? 0,
    render: (p) => emDias(p.mediana),
    // O ciclo normal vai até 30 dias; passar de 60 é competência atrasada.
    alerta: (p) => (p.mediana ?? 0) > 60,
  },
  {
    key: "p90",
    rotulo: "p90",
    titulo: "9 de cada 10 fechamentos dela saíram até este prazo",
    valor: (p) => p.p90 ?? 0,
    render: (p) => emDias(p.p90),
  },
  { key: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  {
    key: "maisVelha",
    rotulo: "Mais velha",
    titulo: "A competência mais antiga que ela fechou no período",
    // Ordena pela DATA e mostra o mês: string de mês compara certo, mas o
    // número torna a coluna ordenável junto com as outras.
    valor: (p) => (p.maisVelha ? -Date.parse(p.maisVelha + "-01") : 0),
    render: (p) => compet(p.maisVelha),
  },
];

export default function ApuracaoFiscalPage() {
  const { qs, filtros } = useFiltros();
  const [pessoaSel, setPessoaSel] = useState<number | null>(null);

  const consulta = useFiscalApuracao(qs);
  const d = consulta.data;
  const carregando = consulta.isLoading;
  const recarregando = consulta.isFetching && !consulta.isLoading;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.fechamentos })),
    [d]
  );

  /**
   * Barras de imposto pintadas pelo ATRASO MEDIANO de cada um, na escada da
   * aba. É a leitura que a tela existe para dar: não "qual imposto tem mais
   * linha", mas "em qual deles o escritório está devendo". Com uma pessoa
   * isolada a cor sai — o atraso por imposto POR PESSOA não vem no payload, e
   * herdar a cor do time diria dela uma coisa que o dado não afirma.
   */
  const impostos = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) {
      return d.impostos.map((i) => ({
        chave: i.chave,
        nome: i.nome,
        qtd: i.qtd,
        cor: FAIXAS_APURACAO[faixaDe(FAIXAS_APURACAO, i.mediana ?? 0)].cor,
        detalhe: `${emDias(i.mediana)} de atraso mediano · ${num(i.empresas)} empresa(s) · ${num(i.pessoas)} pessoa(s)${i.nomeado ? "" : " · nome não documentado no banco"}`,
      }));
    }
    return pessoa.porImposto.map((i) => ({
      chave: i.chave,
      nome: rotuloImposto(i.chave),
      qtd: i.qtd,
    }));
  }, [d, pessoa]);

  const empresas = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) return pessoa.topEmpresas.map((e) => ({ ...e }));
    return d.empresas.map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: e.qtd,
      cor: FAIXAS_APURACAO[faixaDe(FAIXAS_APURACAO, e.mediana ?? 0)].cor,
      detalhe: `${emDias(e.mediana)} de atraso mediano · mais velha: ${compet(e.maisVelha)}`,
    }));
  }, [d, pessoa]);

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) =>
      `apuracao-fiscal-${corte}-${periodo}${doTime ? "" : alvo}`;

    return [
      {
        id: "pessoas",
        rotulo: "Quem fechou",
        descricao: "Uma linha por pessoa — sempre o time inteiro",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Fechamentos", "Apurações", "Impostos",
            "Empresas", "Competências", "Dias", "Atraso mediano", "p90", "Mais velha",
            ...FAIXAS_APURACAO.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.fechamentos,
            p.apuracoes,
            p.impostos,
            p.empresas,
            p.competencias,
            p.diasAtivos,
            p.mediana ?? "",
            p.p90 ?? "",
            p.maisVelha ?? "",
            ...p.porFaixa,
          ]),
        }),
      },
      {
        id: "impostos",
        rotulo: "Por imposto",
        descricao: "Onde o escritório está devendo competência",
        nome: arquivo("impostos", true),
        montar: () => ({
          cabecalhos: [
            "Chave", "Imposto", "Nome documentado?", "Apurações", "Empresas", "Pessoas",
            "Atraso mediano", "p90", ...FAIXAS_APURACAO.map((f) => f.rotulo),
          ],
          linhas: d.impostos.map((i) => [
            i.chave,
            i.nome,
            i.nomeado ? "sim" : "não",
            i.qtd,
            i.empresas,
            i.pessoas,
            i.mediana ?? "",
            i.p90 ?? "",
            ...i.porFaixa,
          ]),
        }),
      },
      {
        id: "pessoa-imposto",
        rotulo: "Pessoa × imposto",
        descricao: "Cruzamento completo, pronto para tabela dinâmica",
        nome: arquivo("pessoa-imposto", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Imposto", "Chave", "Apurações"],
          linhas: d.ranking.flatMap((p) =>
            p.porImposto.map((i) => [p.nome, rotuloImposto(i.chave), i.chave, i.qtd])
          ),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        descricao: "Fechamentos por empresa, com o atraso de cada uma",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: pessoa
            ? ["Código", "Empresa", "Apurações"]
            : ["Código", "Empresa", "Fechamentos", "Impostos", "Atraso mediano", "Mais velha"],
          linhas: pessoa
            ? pessoa.topEmpresas.map((e) => [e.chave, e.nome, e.qtd])
            : d.empresas.map((e) => [
                e.chave,
                e.nome,
                e.qtd,
                e.impostos,
                e.mediana ?? "",
                e.maisVelha ?? "",
              ]),
        }),
      },
      {
        id: "competencias",
        rotulo: "Competências fechadas",
        descricao: "Até onde o time voltou no período",
        nome: arquivo("competencias", true),
        montar: () => ({
          cabecalhos: ["Competência", "Fechamentos", "Empresas", "Pessoas", "Atraso mediano"],
          linhas: d.competencias.map((c) => [
            c.compet,
            c.qtd,
            c.empresas,
            c.pessoas,
            c.mediana ?? "",
          ]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: arquivo("evolucao", true),
        montar: () => ({
          cabecalhos: [
            d.periodo.granularidade === "mes" ? "Mês" : "Dia",
            "Apurações",
            "Atraso mediano",
            "p90",
          ],
          linhas: d.serie.map((p) => [dataBR(p.bucket), p.total, p.mediana ?? "", p.p90 ?? ""]),
        }),
      },
    ];
  }, [d, pessoa]);

  const mediana = pessoa ? pessoa.mediana : (d?.totais.mediana ?? null);
  const p90 = pessoa ? pessoa.p90 : (d?.totais.p90 ?? null);
  const fechamentos = pessoa ? pessoa.fechamentos : (d?.totais.fechamentos ?? 0);
  const porFaixa = pessoa ? pessoa.porFaixa : d?.totais.porFaixa;
  const maisVelha = pessoa ? pessoa.maisVelha : (d?.totais.maisVelha ?? null);
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProdPessoaFiltro
          dados={opcoesPessoa}
          valor={pessoaSel}
          onMudar={setPessoaSel}
          rotuloTodos="Todo o time"
        />
        <span className="text-xs text-muted">
          {pessoa
            ? "Mostrando só o que esta pessoa fechou · o ranking segue com o time todo"
            : "Período pelo dia da APURAÇÃO · o atraso conta do fim da competência fechada"}
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
              rotulo="Fechamentos"
              icon={<Layers className="size-4 text-accent" />}
              iconTint="bg-accent/12"
              valor={numCompact(fechamentos)}
              valorCheio={num(fechamentos)}
              secundario={`${num(pessoa ? pessoa.apuracoes : d.totais.apuracoes)} apurações (uma por imposto)`}
              delta={
                pessoa ? undefined : (
                  <Delta pct={deltaPct(d.totais.fechamentos, d.anterior.fechamentos)} />
                )
              }
            />
            <StatTile
              rotulo="Atraso mediano"
              icon={<Timer className="size-4 text-ink-2" />}
              valor={emDias(mediana)}
              secundario="do fim da competência até a apuração"
              alerta={(mediana ?? 0) > 60}
            />
            <StatTile
              rotulo="p90"
              icon={<History className="size-4 text-ink-2" />}
              valor={emDias(p90)}
              secundario={`9 de cada 10 fecharam até aqui — ${escopo}`}
              alerta={(p90 ?? 0) > 180}
            />
            <StatTile
              rotulo="Dentro do ciclo"
              icon={<CalendarRange className="size-4 text-sai" />}
              iconTint="bg-sai/12"
              valor={`${pctBR(pctDe(porFaixa?.[0] ?? 0, (porFaixa ?? []).reduce((a, b) => a + b, 0)))}%`}
              secundario="apurado em até 30 dias do fim da competência"
            />
            <StatTile
              rotulo="Competência mais velha"
              icon={<Building2 className="size-4 text-ink-2" />}
              valor={compet(maisVelha)}
              secundario={`${num(pessoa ? pessoa.competencias : d.totais.competencias)} competência(s) tocada(s) · ${num(pessoa ? pessoa.empresas : d.totais.empresas)} empresa(s)`}
            />
          </>
        )}
      </div>

      <CtbEscada
        titulo="Atraso do fechamento"
        subtitulo={`Quanto tempo depois do fim da competência o imposto foi apurado — ${escopo}. Fechar o mês passado dentro do mês seguinte é o ciclo; passar de 120 dias é competência devendo.`}
        faixas={FAIXAS_APURACAO}
        valores={porFaixa}
        rotuloItem="apurações"
        carregando={carregando || !d}
      />

      <CtbRankingTabela
        titulo="Quem fechou"
        subtitulo="Clique numa pessoa para isolar o restante da tela · ordene por qualquer coluna"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="fechamentos"
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Ninguém apurou nada no período"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Por imposto"
          subtitulo={
            pessoa
              ? `Os impostos que ${pessoa.nome} apurou`
              : "Barra colorida pelo atraso mediano do imposto — onde o escritório está devendo"
          }
          dados={impostos}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Imposto"
          rotuloQtd="Apurações"
        />
        <CtbProdBarras
          titulo="Por empresa"
          subtitulo={
            pessoa ? `Empresas que ${pessoa.nome} fechou` : "Fechamentos por empresa, coloridos pelo atraso"
          }
          dados={empresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
          rotuloQtd={pessoa ? "Apurações" : "Fechamentos"}
        />
      </div>

      <CtbCompetencias
        dados={d?.competencias}
        carregando={carregando}
        recarregando={recarregando}
        faixas={FAIXAS_APURACAO}
        rotuloItem="Fechamentos"
      />

      <CtbAtrasoSerie
        dados={d?.serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        carregando={carregando}
        recarregando={recarregando}
      />

      <CtbProdHoras
        dados={pessoa ? pessoa.porHora : d?.porHora}
        carregando={carregando}
        recarregando={recarregando}
        subtitulo={`Em que hora do dia o fechamento acontece — ${escopo}`}
      />

      {/* O aviso é parte do dado, não rodapé decorativo: quem lê "Imposto 71"
          precisa saber que 71 é o código do Questor e não um nome que a tela
          escolheu esconder. */}
      {d && d.semNome > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {num(d.semNome)} tipo(s) de imposto aparecem pelo código — o Questor não guarda
            um cadastro de nome para <code className="text-ink">tipoimposto</code>. Só ICMS e
            ISS foram provados (pela alíquota e pela espécie da nota). Quem souber o que é
            &quot;Imposto 71&quot; nomeia, e vira uma linha no catálogo.
          </span>
        </p>
      )}

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(filtros.inicio)} a {dataBR(filtros.fim)} · {num(d.totais.fechamentos)} fechamentos
          e {num(d.totais.apuracoes)} apurações · {num(d.totais.pessoas)} pessoas · período pelo dia
          da apuração
        </p>
      )}
    </div>
  );
}
