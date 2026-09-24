"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, Nota, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { dataBR, num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import { classesDe, trabalhosDe, type AppPessoa, type ModuloApp, type ProdAppResp } from "@/lib/prod-app-tipos";
import type { SeriePontoGen } from "@/lib/prod-tipos";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { ComposicaoClasses } from "./composicao-classes";
import { FiltroPessoa } from "./filtro-pessoa";
import { HorasDoDia } from "./horas-do-dia";
import { ModalQuebra } from "./modal-quebra";
import { PainelCalendario } from "./painel-calendario";
import { PainelQuebra, type ItemQuebra } from "./painel-quebra";
import { RankingPessoas, type ColunaRanking } from "./ranking-pessoas";
import { calendarioDe, nomeGranularidade, rotuloBucketLongo, rotuloHora, totalPorBucket } from "./recorte";
import { SerieClasses } from "./serie-periodo";
import { Variacao } from "./variacao";

/**
 * A TELA da aba No NaveX, inteira, servindo o Contábil e o Fiscal.
 *
 * Os dois leem a mesma trilha de auditoria com a mesma forma de resposta; o
 * que muda é o catálogo de gestos e a frase do que se mede. Duplicar a tela
 * para trocar duas strings foi como a Produtividade do Fiscal começou no nexo2,
 * e foi o que a refundação desfez. O que NÃO se compartilha é a consulta: cada
 * módulo tem a sua rota (é a fronteira de permissão), e a página de cada um
 * entrega o dado pronto aqui.
 */

const COLUNAS: ColunaRanking<AppPessoa>[] = [
  { id: "producao", rotulo: "Concluídos", dica: "Gestos que deixaram alguma coisa pronta", valor: (p) => p.producao },
  { id: "leitura", rotulo: "Consultas", dica: "Consultas, notas abertas e exportações", valor: (p) => p.leitura },
  { id: "eventos", rotulo: "Total", valor: (p) => p.eventos },
  { id: "empresas", rotulo: "Empresas", dica: "Empresas que apareceram no que a pessoa fez", valor: (p) => p.empresas, secundaria: true },
  { id: "dias", rotulo: "Dias", dica: "Dias em que usou o NaveX", valor: (p) => p.diasAtivos, secundaria: true },
  {
    id: "ultimo",
    rotulo: "Último",
    dica: "Dia mais recente com registro",
    valor: (p) => (p.ultimo ? Date.parse(p.ultimo) : 0),
    celula: (p) => dataBR(p.ultimo),
    largura: "104px",
  },
];

export function TelaNoNavex({ modulo, dados: d }: { modulo: ModuloApp; dados: ProdAppResp | undefined }) {
  const [pessoaSel, setPessoaSel] = useEstadoTela<string | null>("pessoa", null);
  const [acaoAberta, setAcaoAberta] = useState<string | null>(null);

  const classes = useMemo(() => classesDe(modulo), [modulo]);
  const trabalhos = useMemo(() => trabalhosDe(modulo), [modulo]);
  // O módulo que não produz nada dentro do app não ganha um indicador sempre
  // zerado: no lugar dele entram os dias com registro.
  const temProducao = trabalhos.some((t) => t.tipo === "producao");
  const carregando = !d;

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );
  const corDaClasse = useMemo(() => new Map(classes.map((c) => [c.id, c.cor])), [classes]);

  /**
   * As barras de AÇÃO são o verbo cru agrupado pela classe que o pinta: a lente
   * mais fina da tela. Verbo instrumentado sem classe aparece cinza e com o
   * identificador à mostra, que é como se descobre o que falta catalogar.
   */
  const acoes = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa)
      return d.acoes.map((a) => ({
        chave: a.chave,
        nome: a.nome,
        qtd: a.qtd,
        cor: corDaClasse.get(a.classe),
        detalhe: `${num(a.pessoas)} ${a.pessoas === 1 ? "pessoa" : "pessoas"}`,
      }));
    const meta = new Map(d.acoes.map((a) => [a.chave, a]));
    return pessoa.acoes.map((a) => ({
      chave: a.chave,
      nome: meta.get(a.chave)?.nome ?? a.chave,
      qtd: a.qtd,
      cor: corDaClasse.get(meta.get(a.chave)?.classe ?? "outros"),
    }));
  }, [d, pessoa, corDaClasse]);

  const empresas = useMemo<ItemQuebra[] | undefined>(
    () => (pessoa ? pessoa.topEmpresas : d?.empresas)?.map((e) => ({ chave: e.chave, nome: e.nome, qtd: e.qtd })),
    [d, pessoa]
  );

  const serie = useMemo<SeriePontoGen[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) return d.serie;
    return totalPorBucket(
      pessoa.serie,
      d.serie.map((p) => p.bucket),
      d.periodo.granularidade
    );
  }, [d, pessoa]);

  const calendario = useMemo(
    () => (d ? (pessoa ? calendarioDe(d.periodo, pessoa.serie, pessoa.eventos) : d.calendario) : undefined),
    [d, pessoa]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `no-navex-${d.modulo}-${corte}-${periodo}${doTime ? "" : alvo}`;
    const escala = d.periodo.granularidade === "mes" ? "Mês" : "Dia";
    return [
      {
        id: "pessoas",
        rotulo: "Quem usou o NaveX",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Situação", "Concluídos", "Consultas", "Total", "Empresas", "Dias", "Último dia", ...trabalhos.map((t) => t.rotulo)],
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
        nome: arquivo("pessoa-acao", true),
        montar: () => {
          const nomeAcao = new Map(d.acoes.map((a) => [a.chave, a.nome]));
          return {
            cabecalhos: ["Pessoa", "Ação", "Verbo", "Quantidade"],
            linhas: d.ranking.flatMap((p) => p.acoes.map((a) => [p.nome, nomeAcao.get(a.chave) ?? a.chave, a.chave, a.qtd])),
          };
        },
      },
      {
        id: "acoes",
        rotulo: pessoa ? `Ações de ${pessoa.nome}` : "Ações do time",
        nome: arquivo("acoes"),
        montar: () => ({ cabecalhos: ["Verbo", "Ação", "Quantidade"], linhas: (acoes ?? []).map((a) => [a.chave, a.nome, a.qtd]) }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Registros"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [e.chave, e.nome, e.qtd]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: [escala, "Total", ...(pessoa ? [] : trabalhos.map((t) => t.rotulo))],
          linhas: (serie ?? []).map((p) => [
            rotuloBucketLongo(p.bucket, d.periodo.granularidade),
            p.total,
            ...(pessoa ? [] : trabalhos.map((t) => Number(p[t.id] ?? 0))),
          ]),
        }),
      },
      {
        id: "horas",
        rotulo: pessoa ? `Hora do dia de ${pessoa.nome}` : "Hora do dia do time",
        nome: arquivo("horas"),
        montar: () => ({
          cabecalhos: ["Hora", "Registros"],
          linhas: (pessoa ? pessoa.porHora : d.porHora).map((qtd, h) => [rotuloHora(h), qtd]),
        }),
      },
    ];
  }, [d, pessoa, acoes, serie, trabalhos]);

  const acaoDetalhe = acaoAberta != null ? d?.acoes.find((a) => a.chave === acaoAberta) : undefined;
  const quemFez = useMemo(
    () =>
      acaoAberta == null || !d
        ? []
        : d.ranking
            .map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.acoes.find((a) => a.chave === acaoAberta)?.qtd ?? 0 }))
            .filter((p) => p.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd),
    [d, acaoAberta]
  );

  const acoesPagina = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.eventos, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo={modulo} cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.eventos === 0)
    return (
      <>
        {acoesPagina}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="atividade"
            titulo="Ninguém registrou nada no NaveX no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  const eventos = pessoa ? pessoa.eventos : (d?.totais.eventos ?? 0);
  const producao = pessoa ? pessoa.producao : (d?.totais.producao ?? 0);
  const leitura = pessoa ? pessoa.leitura : (d?.totais.leitura ?? 0);
  const porClasse = pessoa ? pessoa.porClasse : d?.totais.porClasse;
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = d?.periodo.granularidade ?? "dia";
  const topEmpresa = (pessoa ? pessoa.topEmpresas[0] : d?.empresas[0])?.nome;

  return (
    <>
      {acoesPagina}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Registros"
          icone="atividade"
          carregando={carregando}
          valor={num(eventos)}
          detalhe={
            <>
              {!pessoa && d && <Variacao atual={d.totais.eventos} anterior={d.anterior.eventos} />}
              {!pessoa && d && d.anterior.eventos > 0 && " · "}
              {num(pessoa ? pessoa.diasAtivos : (d?.totais.diasAtivos ?? 0))} dias com movimento
            </>
          }
        />
        {temProducao ? (
          <Indicador
            rotulo="Concluídos"
            icone="ok"
            carregando={carregando}
            valor={num(producao)}
            detalhe={
              <>
                {!pessoa && d && <Variacao atual={d.totais.producao} anterior={d.anterior.producao} />}
                {!pessoa && d && d.anterior.producao > 0 && " · "}
                {pct(pctDe(producao, eventos))} do registrado
              </>
            }
          />
        ) : (
          <Indicador
            rotulo="Dias com uso"
            icone="calendario"
            carregando={carregando}
            valor={num(pessoa ? pessoa.diasAtivos : (d?.totais.diasAtivos ?? 0))}
            detalhe={
              calendario?.pico ? `Pico em ${dataBR(calendario.pico.d)} com ${num(calendario.pico.n)}` : "Sem movimento"
            }
          />
        )}
        <Indicador
          rotulo="Consultas"
          icone="ver"
          carregando={carregando}
          valor={num(leitura)}
          detalhe="Varreduras, notas abertas e exportações"
        />
        <Indicador
          rotulo="Pessoas"
          icone="pessoas"
          carregando={carregando}
          valor={num(d?.totais.pessoas ?? 0)}
          detalhe={
            pessoa
              ? `${pct(pctDe(eventos, d?.totais.eventos ?? 0))} do registrado é desta pessoa`
              : `${num(d?.ranking.filter((p) => p.inativo).length ?? 0)} já inativas`
          }
        />
        <Indicador
          rotulo="Empresas alcançadas"
          icone="empresa"
          carregando={carregando}
          valor={num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))}
          detalhe={topEmpresa ?? "Nenhuma no período"}
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>
          {temProducao
            ? "O que o time rodou dentro do NaveX. O que rodou no Questor está nas outras abas."
            : "Aqui aparece o uso do app. O que o time produz está nas outras abas."}{" "}
          A trilha só enxerga gesto instrumentado.
        </Nota>
        {d && !d.nomesResolvidos && (
          <Nota tom="atencao" icone="alerta">
            O Questor não respondeu: as empresas aparecem pelo código, sem razão social.
          </Nota>
        )}
      </div>

      <Painel titulo="Por tipo de trabalho" descricao={pessoa ? `Registros de ${pessoa.nome}` : "Registros do time"}>
        {porClasse ? (
          <ComposicaoClasses classes={classes} porClasse={porClasse} total={eventos} ocultarVazio={classes.map((c) => c.id)} />
        ) : (
          <Esqueleto className="h-20 w-full" />
        )}
      </Painel>

      <RankingPessoas
        titulo="Quem usou o NaveX"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial={temProducao ? "producao" : "eventos"}
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém registrou nada no app neste período."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Por ação"
          descricao={`O gesto exato registrado na trilha · ${escopo}`}
          itens={acoes}
          carregando={carregando}
          aoClicar={(i) => setAcaoAberta(i.chave)}
          selecionado={acaoAberta}
        />
        <PainelQuebra
          titulo="Por empresa"
          descricao={pessoa ? `Onde ${pessoa.nome} trabalhou` : "Onde o trabalho no app aconteceu"}
          itens={empresas}
          carregando={carregando}
          vazio="Nenhum registro ligado a empresa."
        />
      </div>

      <SerieClasses
        pontos={serie}
        classes={classes}
        granularidade={g}
        soTotal={!!pessoa}
        rotuloItem="Registros"
        descricao={`Registros por ${nomeGranularidade(g)} · ${escopo}`}
        carregando={carregando}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HorasDoDia
          porHora={pessoa ? pessoa.porHora : d?.porHora}
          rotuloItem="Registros"
          descricao={`Em que hora o app é usado · ${escopo}`}
          carregando={carregando}
        />
        <PainelCalendario
          calendario={calendario}
          rotuloItem="Registros"
          descricao={`Registros por dia · ${escopo}`}
          carregando={carregando}
        />
      </div>

      <ModalQuebra
        aberto={acaoDetalhe != null}
        onFechar={() => setAcaoAberta(null)}
        titulo={acaoDetalhe?.nome ?? ""}
        descricao={acaoDetalhe ? <span className="num">{acaoDetalhe.chave}</span> : undefined}
        fatos={
          acaoDetalhe && (
            <>
              <Par rotulo="Tipo">{classes.find((c) => c.id === acaoDetalhe.classe)?.rotulo ?? "Outros"}</Par>
              <Par rotulo="Registros">
                <span className="num font-[600]">{num(acaoDetalhe.qtd)}</span>
              </Par>
              <Par rotulo="Pessoas">
                <span className="num">{num(acaoDetalhe.pessoas)}</span>
              </Par>
              <Par rotulo="Do total">
                <span className="num">{pct(pctDe(acaoDetalhe.qtd, d?.totais.eventos ?? 0))}</span>
              </Par>
            </>
          )
        }
        pessoas={quemFez}
        onIsolar={setPessoaSel}
      />
    </>
  );
}
