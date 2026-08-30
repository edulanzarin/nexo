"use client";

import { useMemo, useState } from "react";
import { Activity, Building2, CalendarDays, CheckCircle2, Eye, Users } from "lucide-react";
import { StatTile, Delta } from "@/components/ui";
import { ProdPessoaFiltro } from "@/components/prod-pessoa-filtro";
import { ProdFaixaClasses } from "@/components/prod-faixa-classes";
import { ExportarMenu, type CorteExport } from "@/components/exportar-menu";
import { CtbRankingTabela, type ColunaRanking } from "@/components/ctb-ranking-tabela";
import { CtbProdBarras, type BarraItem } from "@/components/ctb-prod-barras";
import { CtbProdSerie } from "@/components/charts/ctb-prod-serie";
import { CtbProdHoras } from "@/components/charts/ctb-prod-horas";
import { CalendarioAtividade } from "@/components/charts/calendario-atividade";
import { dataBR, deltaPct, num, numCompact } from "@/lib/format";
import { pctBR, pctDe, pico, slug } from "@/lib/prod-formato";
import { classesDe, trabalhosDe, type AppPessoa, type ProdAppResp } from "@/lib/prod-app-tipos";
import { zeroDe, type SeriePontoGen } from "@/lib/prod-tipos";

/**
 * A TELA da aba No Nexo, inteira, servindo os DOIS módulos.
 *
 * Contábil e Fiscal leem a mesma tabela (`auditoria`) com a mesma forma de
 * resposta; o que muda entre eles é o catálogo de classes e a frase que explica
 * o que a tela está medindo. Duplicar a tela para trocar duas strings era como
 * a Produtividade do Fiscal começou — e foi o que a refundação de ago/2026
 * desfez. Aqui a tela nasce compartilhada.
 *
 * O que NÃO é compartilhado: o hook de dados. Cada módulo tem a sua rota (é a
 * fronteira de permissão), então a página de cada um chama o próprio hook e
 * entrega os dados prontos aqui.
 */

const COLUNAS: ColunaRanking<AppPessoa>[] = [
  {
    key: "producao",
    rotulo: "Concluídos",
    titulo: "Gestos que deixaram alguma coisa pronta",
    valor: (p) => p.producao,
  },
  {
    key: "leitura",
    rotulo: "Consultas",
    titulo: "Consultas, notas abertas e exportações",
    valor: (p) => p.leitura,
  },
  { key: "eventos", rotulo: "Total", valor: (p) => p.eventos },
  {
    key: "empresas",
    rotulo: "Empresas",
    titulo: "Empresas que apareceram no que a pessoa fez",
    valor: (p) => p.empresas,
  },
  { key: "diasAtivos", rotulo: "Dias", titulo: "Dias em que usou o Nexo", valor: (p) => p.diasAtivos },
  {
    key: "ultimo",
    rotulo: "Último",
    titulo: "Dia mais recente com registro",
    valor: (p) => (p.ultimo ? Date.parse(p.ultimo) : 0),
    render: (p) => (p.ultimo ? dataBR(p.ultimo) : "—"),
  },
];

/** Dia "YYYY-MM-DD" → bucket da série (o dia, ou o 1º do mês). */
const bucketDe = (d: string, g: "dia" | "mes") => (g === "mes" ? d.slice(0, 7) + "-01" : d);

/**
 * Série de UMA pessoa reprojetada nos buckets densos do time — só o TOTAL. A
 * quebra dia × classe por pessoa não vem no payload (seria um cubo), e ratear
 * pela proporção do período desenharia distribuição que o dado não sustenta;
 * por isso o gráfico entra em modo área única, como nas abas irmãs.
 */
function serieDaPessoa(
  pessoa: AppPessoa,
  base: SeriePontoGen[],
  granularidade: "dia" | "mes",
  vazio: Record<string, number>
): SeriePontoGen[] {
  const porBucket = new Map<string, number>();
  for (const d of pessoa.serie) {
    const b = bucketDe(d.d, granularidade);
    porBucket.set(b, (porBucket.get(b) ?? 0) + d.n);
  }
  return base.map((p) => ({ bucket: p.bucket, total: porBucket.get(p.bucket) ?? 0, ...vazio }));
}

export function ProdAppTela({
  dados: d,
  carregando,
  recarregando,
}: {
  dados: ProdAppResp | undefined;
  carregando: boolean;
  recarregando: boolean;
}) {
  const [pessoaSel, setPessoaSel] = useState<string | null>(null);

  const modulo = d?.modulo ?? "contabil";
  const classes = useMemo(() => classesDe(modulo), [modulo]);
  const trabalhos = useMemo(() => trabalhosDe(modulo), [modulo]);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const opcoesPessoa = useMemo(
    () => d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.eventos })),
    [d]
  );

  const corDaClasse = useMemo(() => new Map(classes.map((c) => [c.id, c.cor])), [classes]);

  /**
   * As barras de AÇÃO são o verbo cru agrupado pela classe que o pinta. É a
   * lente mais fina da tela: "Conciliação" no empilhado vira
   * `contabil.conciliacao.gerar` aqui, e verbo instrumentado sem classe aparece
   * cinza, com o identificador à mostra — que é como se descobre o que falta
   * catalogar.
   */
  const acoes = useMemo<BarraItem[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) {
      return d.acoes.map((a) => ({
        chave: a.chave,
        nome: a.nome,
        qtd: a.qtd,
        cor: corDaClasse.get(a.classe),
        detalhe: `${num(a.pessoas)} pessoa(s) fizeram isso`,
      }));
    }
    const meta = new Map(d.acoes.map((a) => [a.chave, a]));
    return pessoa.acoes.map((a) => {
      const m = meta.get(a.chave);
      return {
        chave: a.chave,
        nome: m?.nome ?? a.chave,
        qtd: a.qtd,
        cor: corDaClasse.get(m?.classe ?? "outros"),
      };
    });
  }, [d, pessoa, corDaClasse]);

  const empresas = useMemo<BarraItem[] | undefined>(
    () => (pessoa ? pessoa.topEmpresas : d?.empresas)?.map((e) => ({ ...e })),
    [d, pessoa]
  );

  const serie = useMemo(() => {
    if (!d) return undefined;
    return pessoa
      ? serieDaPessoa(pessoa, d.serie, d.periodo.granularidade, zeroDe(classes))
      : d.serie;
  }, [d, pessoa, classes]);

  const calendario = useMemo(() => {
    if (!d) return undefined;
    if (!pessoa) return d.calendario;
    return {
      inicio: d.periodo.inicio,
      fim: d.periodo.fim,
      celulas: pessoa.serie,
      total: pessoa.eventos,
      pico: pico(pessoa.serie),
    };
  }, [d, pessoa]);

  const cortes = useMemo<CorteExport[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) =>
      `no-nexo-${d.modulo}-${corte}-${periodo}${doTime ? "" : alvo}`;

    return [
      {
        id: "pessoas",
        rotulo: "Quem usou o Nexo",
        descricao: "Uma linha por pessoa — sempre o time inteiro",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Pessoa", "Situação", "Concluídos", "Consultas", "Total",
            "Empresas", "Dias", "Último dia",
            ...trabalhos.map((t) => t.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.nome,
            p.inativo ? "inativo" : "ativo",
            p.producao,
            p.leitura,
            p.eventos,
            p.empresas,
            p.diasAtivos,
            p.ultimo ?? "",
            ...trabalhos.map((t) => p.porClasse[t.id] ?? 0),
          ]),
        }),
      },
      {
        id: "pessoa-acao",
        rotulo: "Pessoa × ação",
        descricao: "Cruzamento completo, pronto para tabela dinâmica",
        nome: arquivo("pessoa-acao", true),
        montar: () => {
          const nomeAcao = new Map(d.acoes.map((a) => [a.chave, a.nome]));
          return {
            cabecalhos: ["Pessoa", "Ação", "Verbo", "Quantidade"],
            linhas: d.ranking.flatMap((p) =>
              p.acoes.map((a) => [p.nome, nomeAcao.get(a.chave) ?? a.chave, a.chave, a.qtd])
            ),
          };
        },
      },
      {
        id: "acoes",
        rotulo: pessoa ? `Ações de ${pessoa.nome}` : "Ações do time",
        descricao: "O verbo registrado na trilha, com quantas vezes aconteceu",
        nome: arquivo("acoes"),
        montar: () => ({
          cabecalhos: ["Verbo", "Ação", "Quantidade"],
          linhas: (acoes ?? []).map((a) => [a.chave, a.nome, a.qtd]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        descricao: "Onde o trabalho no app aconteceu",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Registros"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [e.chave, e.nome, e.qtd]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        descricao: d.periodo.granularidade === "mes" ? "Um mês por linha" : "Um dia por linha",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: [
            d.periodo.granularidade === "mes" ? "Mês" : "Dia",
            "Total",
            ...(pessoa ? [] : trabalhos.map((t) => t.rotulo)),
          ],
          linhas: (serie ?? []).map((p) => [
            dataBR(p.bucket),
            p.total,
            ...(pessoa ? [] : trabalhos.map((t) => (typeof p[t.id] === "number" ? p[t.id] : 0))),
          ]),
        }),
      },
      {
        id: "horas",
        rotulo: pessoa ? `Hora do dia de ${pessoa.nome}` : "Hora do dia do time",
        descricao: "Uma linha por hora, das 0h às 23h",
        nome: arquivo("horas"),
        montar: () => ({
          cabecalhos: ["Hora", "Registros"],
          linhas: (pessoa ? pessoa.porHora : d.porHora).map((qtd, hora) => [
            `${String(hora).padStart(2, "0")}h`,
            qtd,
          ]),
        }),
      },
    ];
  }, [d, pessoa, acoes, serie, trabalhos]);

  const eventos = pessoa ? pessoa.eventos : (d?.totais.eventos ?? 0);
  const producao = pessoa ? pessoa.producao : (d?.totais.producao ?? 0);
  const leitura = pessoa ? pessoa.leitura : (d?.totais.leitura ?? 0);
  const porClasse = pessoa ? pessoa.porClasse : d?.totais.porClasse;
  const escopo = pessoa ? `de ${pessoa.nome}` : "do time";

  // O módulo que não produz nada dentro do app não ganha um cartão sempre
  // zerado: no lugar dele entram os dias com registro. Zero permanente não é
  // informação, é um cartão morto no meio dos que informam.
  const temProducao = trabalhos.some((t) => t.tipo === "producao");

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
            ? "Mostrando só o que esta pessoa fez no app · o ranking segue com o time todo"
            : temProducao
              ? "O que o time rodou DENTRO do Nexo · o que rodou no Questor está nas outras abas"
              : "O Fiscal não grava nada no Nexo — aqui é o uso do app; o que o time produziu está nas outras abas"}
        </span>
        <div className="ml-auto">
          <ExportarMenu modulo={modulo} cortes={cortes} desabilitado={!d || carregando} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando || !d ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-36" />)
        ) : (
          <>
            <StatTile
              rotulo="Registros"
              icon={<Activity className="size-4 text-accent" />}
              iconTint="bg-accent/12"
              valor={numCompact(eventos)}
              valorCheio={num(eventos)}
              secundario={`${num(d.totais.diasAtivos)} dia(s) com movimento`}
              delta={
                pessoa ? undefined : (
                  <Delta pct={deltaPct(d.totais.eventos, d.anterior.eventos)} />
                )
              }
            />
            {temProducao ? (
              <StatTile
                rotulo="Concluídos"
                icon={<CheckCircle2 className="size-4 text-sai" />}
                iconTint="bg-sai/12"
                valor={numCompact(producao)}
                valorCheio={num(producao)}
                secundario={`${pctBR(pctDe(producao, eventos))}% do que foi registrado`}
                delta={
                  pessoa ? undefined : (
                    <Delta pct={deltaPct(d.totais.producao, d.anterior.producao)} />
                  )
                }
              />
            ) : (
              <StatTile
                rotulo="Dias com uso"
                icon={<CalendarDays className="size-4 text-ink-2" />}
                valor={num(pessoa ? pessoa.diasAtivos : d.totais.diasAtivos)}
                secundario={
                  d.calendario.pico
                    ? `pico em ${dataBR(d.calendario.pico.d)} (${num(d.calendario.pico.n)})`
                    : "sem movimento"
                }
              />
            )}
            <StatTile
              rotulo="Consultas"
              icon={<Eye className="size-4 text-ink-2" />}
              valor={numCompact(leitura)}
              valorCheio={num(leitura)}
              secundario="varreduras, notas abertas e exportações"
            />
            <StatTile
              rotulo="Pessoas"
              icon={<Users className="size-4 text-ink-2" />}
              valor={num(d.totais.pessoas)}
              secundario={
                pessoa
                  ? `${pctBR(pctDe(eventos, d.totais.eventos))}% do registrado é desta pessoa`
                  : `${num(d.ranking.filter((p) => p.inativo).length)} já inativa(s)`
              }
            />
            <StatTile
              rotulo="Empresas alcançadas"
              icon={<Building2 className="size-4 text-ink-2" />}
              valor={num(pessoa ? pessoa.empresas : d.totais.empresas)}
              secundario={
                <span className="line-clamp-2">
                  {(pessoa ? pessoa.topEmpresas[0] : d.empresas[0])?.nome ?? "nenhuma no período"}
                </span>
              }
            />
          </>
        )}
      </div>

      {d && porClasse && (
        <ProdFaixaClasses
          classes={classes}
          porClasse={porClasse}
          total={eventos}
          ocultarVazio={classes.map((c) => c.id)}
        />
      )}

      <CtbRankingTabela
        titulo="Quem usou o Nexo"
        subtitulo="Clique numa pessoa para isolar o restante da tela · ordene por qualquer coluna"
        dados={d?.ranking}
        colunas={COLUNAS}
        ordemInicial={temProducao ? "producao" : "eventos"}
        carregando={carregando}
        recarregando={recarregando}
        selecionado={pessoaSel}
        onSelecionar={setPessoaSel}
        vazio="Ninguém registrou nada no app neste período"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CtbProdBarras
          titulo="Por ação"
          subtitulo={`O gesto exato registrado na trilha — ${escopo}`}
          dados={acoes}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Ação"
          rotuloQtd="Registros"
        />
        <CtbProdBarras
          titulo="Por empresa"
          subtitulo={
            pessoa ? `Empresas em que ${pessoa.nome} trabalhou` : "Onde o trabalho no app aconteceu"
          }
          dados={empresas}
          carregando={carregando}
          recarregando={recarregando}
          rotuloEixo="Empresa"
          rotuloQtd="Registros"
        />
      </div>

      <CtbProdSerie
        dados={serie}
        granularidade={d?.periodo.granularidade ?? "dia"}
        classes={classes}
        soTotal={!!pessoa}
        rotuloItem="Registros"
        subtitulo={`Registros por ${d?.periodo.granularidade === "mes" ? "mês" : "dia"} — ${escopo}`}
        carregando={carregando}
        recarregando={recarregando}
      />

      <CtbProdHoras
        dados={pessoa ? pessoa.porHora : d?.porHora}
        carregando={carregando}
        recarregando={recarregando}
        subtitulo={`Em que hora do dia o app é usado — ${escopo}`}
      />

      <CalendarioAtividade
        dados={calendario}
        carregando={carregando}
        recarregando={recarregando}
        subtitulo={`Registros por dia no período — ${pessoa ? pessoa.nome : "time todo"}`}
        rotuloItem="registros"
      />

      {d && (
        <p className="text-center text-xs text-muted">
          {dataBR(d.periodo.inicio)} a {dataBR(d.periodo.fim)} · {num(d.totais.eventos)} registros na
          trilha do app · a trilha só enxerga gesto instrumentado
          {!d.nomesResolvidos && " · Questor fora do ar: empresas sem razão social"}
        </p>
      )}
    </div>
  );
}
