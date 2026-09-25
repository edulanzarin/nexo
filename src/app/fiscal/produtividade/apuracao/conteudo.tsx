"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { CaixaGrafico, EscadaFaixas, GraficoBarrasCor, Legenda } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { HorasDoDia } from "@/componentes/produto/produtividade/horas-do-dia";
import { CorpoQuebra } from "@/componentes/produto/produtividade/modal-quebra";
import { PainelCalendario } from "@/componentes/produto/produtividade/painel-calendario";
import { PainelEscada } from "@/componentes/produto/produtividade/painel-escada";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { calendarioDe, nomeGranularidade, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { mesBR, num, numCompact, pct } from "@/lib/format";
import { emDias, pctDe, slug } from "@/lib/prod-formato";
import { faixaDe } from "@/lib/prod-escala";
import {
  FAIXAS_APURACAO,
  rotuloImposto,
  type FiscalApuracaoResp,
  type FisApuPessoa,
} from "@/lib/fiscal-apuracao-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

/** "2026-05" vira "mai/26". */
const compet = (v: string | null) => (v ? mesBR(`${v}-01`) : "—");

/**
 * O ciclo normal é fechar o mês passado dentro do mês seguinte. Mediana acima
 * de 60 dias é competência atrasada; p90 acima de 180 é cauda que ninguém
 * está fechando.
 */
const ATRASO_ALERTA = 60;
const P90_ALERTA = 180;

/** Um ano de competências já enche o eixo; o resto vive na exportação. */
const TETO_COMPETENCIAS = 24;

/** Impostos são poucos (uma dúzia no escritório inteiro): a lista vai toda. */
const LIMITE_IMPOSTOS = 20;

const corDoAtraso = (dias: number | null) => FAIXAS_APURACAO[faixaDe(FAIXAS_APURACAO, dias ?? 0)].cor;

const COR_MEDIANA = "var(--serie-1)";
const COR_P90 = "var(--atencao)";
const COR_VOLUME = "var(--linha-forte)";

/** De onde vem o código: movimento ("M1") ou retenção ("R20"), cada um com a sua tabela. */
const origemImposto = (chave: string) =>
  chave.startsWith("R") ? `Retenção, tipo ${chave.slice(1)} do Questor` : `Tipo ${chave.slice(1)} do Questor`;

const COLUNAS: ColunaRanking<FisApuPessoa>[] = [
  { id: "fechamentos", rotulo: "Fechamentos", dica: "Empresa × competência apurada", valor: (p) => p.fechamentos },
  { id: "apuracoes", rotulo: "Apurações", dica: "Cada imposto apurado dentro de um fechamento", valor: (p) => p.apuracoes },
  {
    id: "mediana",
    rotulo: "Atraso mediano",
    dica: "Metade do que a pessoa apurou saiu depois disso, contado do fim da competência",
    valor: (p) => p.mediana ?? 0,
    celula: (p) => emDias(p.mediana),
    alerta: (p) => (p.mediana ?? 0) > ATRASO_ALERTA,
  },
  { id: "p90", rotulo: "p90", dica: "9 em cada 10 apurações saíram até esse prazo", valor: (p) => p.p90 ?? 0, celula: (p) => emDias(p.p90) },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "impostos", rotulo: "Impostos", dica: "Tipos de imposto apurados", valor: (p) => p.impostos, secundaria: true },
  {
    id: "maisVelha",
    rotulo: "Mais velha",
    dica: "A competência mais antiga que apurou no período",
    // Ordena pela data sem virar texto: a mais antiga é o maior negativo.
    valor: (p) => (p.maisVelha ? -Number(p.maisVelha.replace("-", "")) : 0),
    celula: (p) => compet(p.maisVelha),
    secundaria: true,
  },
];

/**
 * Apuração: o FECHAMENTO mensal, o trabalho mais pesado do Fiscal. Quem apurou
 * qual imposto de qual empresa, em que competência e com quanto atraso, lido de
 * `periodoapuradofis` e `periodoapuradofisretido`.
 *
 * Duas contagens convivem: fechamento é o gesto (empresa × competência) e
 * apuração é a linha (um imposto dentro dele). Contar só linhas inflaria o
 * trabalho, porque um fechamento grava vários impostos juntos; o ranking ordena
 * por fechamento e a quebra por imposto usa as linhas, que é o grão dela.
 *
 * A fonte não tem espécie de nota, então esta aba não oferece o filtro de
 * espécie.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<FiscalApuracaoResp>(
    "fiscal-produtividade-apuracao",
    qs == null ? null : `/api/fiscal/produtividade-apuracao?${qs}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);
  const [impostoAberto, setImpostoAberto] = useState<string | null>(null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  // A cor da barra é o atraso mediano do imposto: a pergunta é em qual deles o
  // escritório está devendo. Com uma pessoa isolada a cor sai, porque o atraso
  // por imposto de cada pessoa não vem no payload, e herdar a cor do time diria
  // dela o que o dado não afirma.
  const impostos = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa)
      return d.impostos.map((i) => ({
        chave: i.chave,
        nome: i.nome,
        qtd: i.qtd,
        cor: corDoAtraso(i.mediana),
        detalhe: `mediana ${emDias(i.mediana)} · ${num(i.empresas)} ${i.empresas === 1 ? "empresa" : "empresas"}`,
      }));
    return pessoa.porImposto.map((i) => ({ chave: i.chave, nome: rotuloImposto(i.chave), qtd: i.qtd }));
  }, [d, pessoa]);

  // Do time, a barra conta fechamentos e pinta pelo atraso; da pessoa, conta as
  // apurações dela em cada empresa (é o que ela carrega) e fica sem cor.
  const empresas = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (pessoa) return pessoa.topEmpresas.map((e) => ({ chave: e.chave, nome: e.nome, qtd: e.qtd }));
    return d.empresas.map((e) => ({
      chave: e.chave,
      nome: e.nome,
      qtd: e.qtd,
      cor: corDoAtraso(e.mediana),
      detalhe: `mediana ${emDias(e.mediana)} · desde ${compet(e.maisVelha)}`,
    }));
  }, [d, pessoa]);

  const competencias = useMemo(
    () =>
      (d?.competencias ?? []).slice(-TETO_COMPETENCIAS).map((c) => ({
        rotulo: compet(c.compet),
        qtd: c.qtd,
        mediana: c.mediana,
        empresas: c.empresas,
        pessoas: c.pessoas,
      })),
    [d]
  );

  const calendario = useMemo(
    () => (d ? (pessoa ? calendarioDe(d.periodo, pessoa.serie, pessoa.apuracoes) : d.calendario) : undefined),
    [d, pessoa]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `apuracao-fiscal-${corte}-${periodo}${doTime ? "" : alvo}`;
    const g = d.periodo.granularidade;
    return [
      {
        id: "pessoas",
        rotulo: "Quem apurou",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Fechamentos", "Apurações", "Impostos", "Empresas", "Competências",
            "Dias", "Atraso mediano (dias)", "p90 (dias)", "Mais velha", ...FAIXAS_APURACAO.map((f) => f.rotulo),
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
        rotulo: pessoa ? `Impostos de ${pessoa.nome}` : "Por imposto",
        nome: arquivo("impostos"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Chave", "Imposto", "Apurações"],
                linhas: pessoa.porImposto.map((i) => [i.chave, rotuloImposto(i.chave), i.qtd]),
              }
            : {
                cabecalhos: [
                  "Chave", "Imposto", "Nome no Questor", "Apurações", "Empresas", "Pessoas", "Atraso mediano (dias)",
                  "p90 (dias)", ...FAIXAS_APURACAO.map((f) => f.rotulo),
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
              },
      },
      {
        id: "pessoa-imposto",
        rotulo: "Pessoa × imposto",
        nome: arquivo("pessoa-imposto", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Imposto", "Chave", "Apurações"],
          linhas: d.ranking.flatMap((p) => p.porImposto.map((i) => [p.nome, rotuloImposto(i.chave), i.chave, i.qtd])),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        nome: arquivo("empresas"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Empresa", "Apurações"],
                linhas: pessoa.topEmpresas.map((e) => [e.chave, e.nome, e.qtd]),
              }
            : {
                cabecalhos: ["Código", "Empresa", "Fechamentos", "Impostos", "Atraso mediano (dias)", "Mais velha"],
                linhas: d.empresas.map((e) => [e.chave, e.nome, e.qtd, e.impostos, e.mediana ?? "", e.maisVelha ?? ""]),
              },
      },
      {
        id: "competencias",
        rotulo: "Competências apuradas",
        nome: arquivo("competencias", true),
        montar: () => ({
          cabecalhos: ["Competência", "Fechamentos", "Empresas", "Pessoas", "Atraso mediano (dias)"],
          linhas: d.competencias.map((c) => [c.compet, c.qtd, c.empresas, c.pessoas, c.mediana ?? ""]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: arquivo("evolucao", true),
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Apurações", "Atraso mediano (dias)", "p90 (dias)"],
          linhas: d.serie.map((p) => [rotuloBucketLongo(p.bucket, g), p.total, p.mediana ?? "", p.p90 ?? ""]),
        }),
      },
    ];
  }, [d, pessoa]);

  const impostoDetalhe = impostoAberto != null ? d?.impostos.find((i) => i.chave === impostoAberto) : undefined;
  const quemApurou = useMemo(
    () =>
      impostoAberto == null || !d
        ? []
        : d.ranking
            .map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.porImposto.find((i) => i.chave === impostoAberto)?.qtd ?? 0 }))
            .filter((p) => p.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd),
    [d, impostoAberto]
  );
  const fecharImposto = () => setImpostoAberto(null);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.fechamentos, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.fechamentos === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="calendario"
            titulo="Ninguém apurou nada no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  const fechamentos = pessoa ? pessoa.fechamentos : (d?.totais.fechamentos ?? 0);
  const apuracoes = pessoa ? pessoa.apuracoes : (d?.totais.apuracoes ?? 0);
  const mediana = pessoa ? pessoa.mediana : (d?.totais.mediana ?? null);
  const p90 = pessoa ? pessoa.p90 : (d?.totais.p90 ?? null);
  const porFaixa = pessoa ? pessoa.porFaixa : d?.totais.porFaixa;
  const noCiclo = porFaixa?.[0] ?? 0;
  const somaFaixas = (porFaixa ?? []).reduce((a, b) => a + b, 0);
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = d?.periodo.granularidade ?? "dia";
  const sobraCompetencias = (d?.competencias.length ?? 0) - competencias.length;
  const semNome = d?.semNome ?? 0;
  const sobraImpostos = (impostos?.length ?? 0) > LIMITE_IMPOSTOS;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Fechamentos"
          icone="camadas"
          carregando={carregando}
          valor={num(fechamentos)}
          detalhe={
            <>
              {!pessoa && d && <Variacao atual={d.totais.fechamentos} anterior={d.anterior.fechamentos} />}
              {!pessoa && d && d.anterior.fechamentos > 0 && " · "}
              {num(apuracoes)} {apuracoes === 1 ? "apuração" : "apurações"}
            </>
          }
        />
        <Indicador
          rotulo="Atraso mediano"
          icone="cronometro"
          carregando={carregando}
          valor={emDias(mediana)}
          detalhe="Do fim da competência até a apuração"
          tom={(mediana ?? 0) > ATRASO_ALERTA ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="9 em cada 10 até"
          icone="historico"
          carregando={carregando}
          valor={emDias(p90)}
          detalhe="O prazo que cobre quase tudo (p90)"
          tom={(p90 ?? 0) > P90_ALERTA ? "atencao" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Dentro do ciclo"
          icone="ok"
          carregando={carregando}
          valor={pct(pctDe(noCiclo, somaFaixas))}
          detalhe={`${numCompact(noCiclo)} de ${numCompact(somaFaixas)} ${FAIXAS_APURACAO[0].rotulo.toLowerCase()}`}
        />
        <Indicador
          rotulo="Competência mais velha"
          icone="intervalo"
          carregando={carregando}
          valor={compet(pessoa ? pessoa.maisVelha : (d?.totais.maisVelha ?? null))}
          detalhe={`${num(pessoa ? pessoa.competencias : (d?.totais.competencias ?? 0))} competências · ${num(
            pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0)
          )} empresas`}
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>Período pelo dia da apuração. O atraso conta do fim da competência apurada.</Nota>
        <Nota>Fechamento é uma empresa numa competência. Cada imposto apurado dentro dele conta como uma apuração.</Nota>
        {pessoa && <Nota>Competências e série seguem com o time todo.</Nota>}
      </div>

      <PainelEscada
        titulo="Atraso da Apuração"
        descricao={`Dias entre o fim da competência e a apuração · ${escopo}`}
        faixas={FAIXAS_APURACAO}
        valores={porFaixa}
        rotuloItem="Apurações"
        carregando={carregando}
      />

      <RankingPessoas
        titulo="Quem Apurou"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="fechamentos"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém apurou nada no período."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Por Imposto"
          descricao={pessoa ? `Impostos que ${pessoa.nome} apurou` : "Apurações de cada imposto, na cor do atraso mediano"}
          itens={impostos}
          limite={LIMITE_IMPOSTOS}
          carregando={carregando}
          aoClicar={(i) => setImpostoAberto(i.chave)}
          selecionado={impostoAberto}
          rodape={
            semNome > 0 || sobraImpostos ? (
              <div className="flex flex-col gap-1">
                {semNome > 0 && (
                  <Nota icone="info">
                    {semNome === 1
                      ? "1 tipo de imposto aparece pelo código porque o Questor não guarda o nome de tipoimposto."
                      : `${num(semNome)} tipos de imposto aparecem pelo código porque o Questor não guarda o nome de tipoimposto.`}
                  </Nota>
                )}
                {sobraImpostos && (
                  <Nota>
                    Mostrando {num(LIMITE_IMPOSTOS)} de {num(impostos?.length ?? 0)}. A lista inteira sai na exportação.
                  </Nota>
                )}
              </div>
            ) : undefined
          }
        />
        <PainelQuebra
          titulo="Por Empresa"
          descricao={
            pessoa ? `Apurações de ${pessoa.nome} por empresa` : "Fechamentos de cada empresa, na cor do atraso mediano"
          }
          itens={empresas}
          carregando={carregando}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CaixaGrafico
          titulo="Competências Apuradas"
          descricao="Fechamentos por mês de competência, na cor do atraso mediano daquele mês"
          carregando={carregando}
          vazio={competencias.length === 0 ? "Nenhuma competência no período." : false}
          legenda={<Legenda itens={FAIXAS_APURACAO.map((f) => ({ rotulo: f.rotulo, cor: f.cor }))} />}
          rodape={
            sobraCompetencias > 0 ? (
              <Nota>
                Mostrando as {num(TETO_COMPETENCIAS)} competências mais recentes de {num(d?.competencias.length ?? 0)}. O
                resto sai na exportação.
              </Nota>
            ) : undefined
          }
        >
          <GraficoBarrasCor
            dados={competencias}
            x="rotulo"
            y="qtd"
            rotulo="Fechamentos"
            cor={(c) => corDoAtraso(c.mediana)}
            tituloDica={(c) => `Competência ${c.rotulo}`}
            extrasDica={(c) => [
              { rotulo: "Atraso mediano", valor: emDias(c.mediana) },
              { rotulo: "Empresas", valor: num(c.empresas) },
              { rotulo: "Pessoas", valor: num(c.pessoas) },
            ]}
          />
        </CaixaGrafico>

        <CaixaGrafico
          titulo="Atraso ao Longo do Período"
          descricao={`Dias entre o fim da competência e a apuração, por ${nomeGranularidade(g)} de trabalho`}
          carregando={carregando}
          vazio={d && d.serie.every((p) => p.total === 0) ? "Nenhuma apuração no período." : false}
          legenda={
            <Legenda
              itens={[
                { rotulo: "Mediana", cor: COR_MEDIANA },
                { rotulo: "p90", cor: COR_P90 },
                { rotulo: "Apurações", cor: COR_VOLUME },
              ]}
            />
          }
        >
          {/* O volume entra atrás porque um dia de 3 apurações e um de 300
              desenham a mesma linha de mediana: sem ele, um pico de atraso
              irrelevante parece problema. Dia sem apuração não tem mediana, e
              a linha corta ali em vez de ligar dois pontos por cima do vazio. */}
          <GraficoPeriodo
            pontos={d?.serie ?? []}
            granularidade={g}
            series={[
              { chave: "total", rotulo: "Apurações", cor: COR_VOLUME, tipo: "barra", eixoDireito: true },
              { chave: "mediana", rotulo: "Atraso mediano", cor: COR_MEDIANA, tipo: "linha" },
              { chave: "p90", rotulo: "9 em cada 10 até", cor: COR_P90, tipo: "linha" },
            ]}
            formatar={(v, s) => (s.chave === "total" ? num(v) : emDias(v))}
            formatarEixo={(v) => `${numCompact(v)} d`}
            formatarEixoDireito={numCompact}
          />
        </CaixaGrafico>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HorasDoDia
          porHora={pessoa ? pessoa.porHora : d?.porHora}
          rotuloItem="Apurações"
          descricao={`Apurações por hora do dia · ${escopo}`}
          carregando={carregando}
        />
        <PainelCalendario
          calendario={calendario}
          rotuloItem="Apurações"
          descricao={`Apurações por dia · ${escopo}`}
          carregando={carregando}
        />
      </div>

      <Modal
        aberto={impostoDetalhe != null}
        onFechar={fecharImposto}
        titulo={impostoDetalhe?.nome ?? ""}
        descricao={
          impostoDetalhe
            ? impostoDetalhe.nomeado
              ? origemImposto(impostoDetalhe.chave)
              : `${origemImposto(impostoDetalhe.chave)}, sem nome cadastrado`
            : undefined
        }
        rodape={<Botao onClick={fecharImposto}>Fechar</Botao>}
      >
        {impostoDetalhe && (
          <div className="flex flex-col gap-5">
            <EscadaFaixas faixas={FAIXAS_APURACAO} valores={impostoDetalhe.porFaixa} rotuloItem="Apurações" />
            <CorpoQuebra
              fatos={
                <>
                  <Par rotulo="Apurações">
                    <span className="num font-[600]">{num(impostoDetalhe.qtd)}</span>
                  </Par>
                  <Par rotulo="Empresas">
                    <span className="num">{num(impostoDetalhe.empresas)}</span>
                  </Par>
                  <Par rotulo="Atraso mediano">
                    <span className="num">{emDias(impostoDetalhe.mediana)}</span>
                  </Par>
                  <Par rotulo="9 em cada 10 até">
                    <span className="num">{emDias(impostoDetalhe.p90)}</span>
                  </Par>
                </>
              }
              pessoas={quemApurou}
              rotuloPessoas="Quem apurou este imposto"
              aoEscolher={(codigo) => {
                setPessoaSel(codigo);
                fecharImposto();
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
