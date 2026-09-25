"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { CaixaGrafico, EscadaFaixas, GraficoBarrasCor, Legenda } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { PainelEscada } from "@/componentes/produto/produtividade/painel-escada";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import { nomeGranularidade, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { mesBR, num, numCompact, pct } from "@/lib/format";
import { emDias, pctDe, slug } from "@/lib/prod-formato";
import { faixaDe } from "@/lib/prod-escala";
import {
  FAIXAS_ATRASO_FISCAL,
  type FisAtrasoEmpresa,
  type FisAtrasoPessoa,
  type FiscalAtrasoResp,
} from "@/lib/fiscal-atraso-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

/** "2026-05" vira "mai/26". */
const compet = (v: string | null) => (v ? mesBR(`${v}-01`) : "—");

/**
 * O alerta acompanha a escada da própria aba: no Fiscal o ciclo normal vai até
 * 30 dias (o mês anterior se fecha ao longo do seguinte), então só passar de 90
 * é dívida de verdade.
 */
const ATRASO_ALERTA = 90;

/**
 * Um ano de competências já enche o eixo; o que é mais velho que isso vive na
 * exportação, não no gráfico.
 */
const TETO_COMPETENCIAS = 24;

const corDoAtraso = (dias: number | null) =>
  FAIXAS_ATRASO_FISCAL[faixaDe(FAIXAS_ATRASO_FISCAL, dias ?? 0)].cor;

const COR_MEDIANA = "var(--serie-1)";
const COR_P90 = "var(--atencao)";
const COR_VOLUME = "var(--linha-forte)";

const COLUNAS: ColunaRanking<FisAtrasoPessoa>[] = [
  {
    id: "mediana",
    rotulo: "Atraso mediano",
    dica: "Metade das notas da pessoa demorou mais que isso",
    valor: (p) => p.mediana ?? 0,
    celula: (p) => emDias(p.mediana),
    alerta: (p) => (p.mediana ?? 0) > ATRASO_ALERTA,
  },
  { id: "p90", rotulo: "p90", dica: "9 em cada 10 notas saíram até esse prazo", valor: (p) => p.p90 ?? 0, celula: (p) => emDias(p.p90) },
  { id: "notas", rotulo: "Notas", valor: (p) => p.notas },
  {
    id: "noCiclo",
    rotulo: "No ciclo",
    dica: "Escrituradas até 30 dias depois da data do documento",
    valor: (p) => pctDe(p.porFaixa[0] ?? 0, p.notas),
    celula: (p) => pct(pctDe(p.porFaixa[0] ?? 0, p.notas)),
  },
  { id: "competencias", rotulo: "Competências", dica: "Meses de documento tocados no período", valor: (p) => p.competencias, secundaria: true },
  {
    id: "maisVelha",
    rotulo: "Mais velha",
    dica: "A competência mais antiga em que mexeu",
    // Ordena pela data sem virar texto: a mais antiga é o maior negativo.
    valor: (p) => (p.maisVelha ? -Number(p.maisVelha.replace("-", "")) : 0),
    celula: (p) => compet(p.maisVelha),
    secundaria: true,
  },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
];

/**
 * Atraso do Fiscal: a distância entre a data do documento (`datalctofis`, a
 * competência) e o carimbo da escrituração (`datahoralctofis`). É o número que
 * diz se o time está fechando o mês passado ou correndo atrás de abril.
 *
 * A tela é a do Contábil com a régua do Fiscal: escriturar o mês anterior
 * durante o mês seguinte é o ciclo normal (a defasagem mediana medida em
 * jul/2026 foi de 25 dias), e a régua de 5 dias pintaria o escritório inteiro
 * de vermelho. Por isso o primeiro degrau é "até 30 dias" e o indicador se
 * chama "dentro do ciclo", não "em dia".
 *
 * A medida central é a MEDIANA: uma importação de dois anos atrás puxa a média
 * para o teto e some com a realidade do dia a dia.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const { especies, comEspecies } = useEspecies();
  const consulta = useConsulta<FiscalAtrasoResp>(
    "fiscal-produtividade-atraso",
    qs == null ? null : `/api/fiscal/produtividade-atraso?${comEspecies(qs)}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);
  const [empresaAberta, setEmpresaAberta] = useState<string | null>(null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  // A barra mede o ATRASO, não o volume: é o ranking do que está mais para
  // trás. O volume vai no detalhe, para a mediana de um punhado de notas não
  // passar por problema grande.
  const empresas = useMemo<ItemQuebra[] | undefined>(
    () =>
      d?.empresas.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.mediana ?? 0,
        cor: corDoAtraso(e.mediana),
        detalhe: `${num(e.notas)} notas · desde ${compet(e.maisVelha)}`,
      })),
    [d]
  );

  const competencias = useMemo(
    () =>
      (d?.competencias ?? []).slice(-TETO_COMPETENCIAS).map((c) => ({
        rotulo: compet(c.compet),
        qtd: c.qtd,
        mediana: c.mediana,
        pessoas: c.pessoas,
      })),
    [d]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const g = d.periodo.granularidade;
    return [
      {
        id: "pessoas",
        rotulo: "Atraso por Pessoa",
        nome: `atraso-fiscal-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Notas", "Atraso mediano (dias)", "p90 (dias)", "Competências",
            "Mais velha", "Empresas", ...FAIXAS_ATRASO_FISCAL.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.notas,
            p.mediana ?? "",
            p.p90 ?? "",
            p.competencias,
            p.maisVelha ?? "",
            p.empresas,
            ...p.porFaixa,
          ]),
        }),
      },
      {
        id: "empresas",
        rotulo: "Atraso por empresa",
        descricao: `Empresas com ${num(d.minimoEmpresa)} ou mais notas no período`,
        nome: `atraso-fiscal-empresas-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Notas", "Atraso mediano (dias)", "p90 (dias)", "Competência mais velha",
            ...FAIXAS_ATRASO_FISCAL.map((f) => f.rotulo),
          ],
          linhas: d.empresas.map((e) => [e.chave, e.nome, e.notas, e.mediana ?? "", e.p90 ?? "", e.maisVelha ?? "", ...e.porFaixa]),
        }),
      },
      {
        id: "competencias",
        rotulo: "Competências Trabalhadas",
        nome: `atraso-fiscal-competencias-${periodo}`,
        montar: () => ({
          cabecalhos: ["Competência", "Notas", "Atraso mediano (dias)", "Pessoas"],
          linhas: d.competencias.map((c) => [c.compet, c.qtd, c.mediana ?? "", c.pessoas]),
        }),
      },
      {
        id: "serie",
        rotulo: "Atraso ao Longo do Período",
        nome: `atraso-fiscal-evolucao-${periodo}`,
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Notas", "Atraso mediano (dias)", "p90 (dias)"],
          linhas: d.serie.map((p) => [rotuloBucketLongo(p.bucket, g), p.total, p.mediana ?? "", p.p90 ?? ""]),
        }),
      },
    ];
  }, [d, pessoa]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroEspecies />
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.notas, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.notas === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="historico"
            titulo="Nenhuma nota para medir no período"
            descricao={
              especies.length
                ? "Marque outras espécies, amplie o período ou tire o filtro de empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const mediana = pessoa ? pessoa.mediana : (d?.totais.mediana ?? null);
  const p90 = pessoa ? pessoa.p90 : (d?.totais.p90 ?? null);
  const noCiclo = pessoa ? (pessoa.porFaixa[0] ?? 0) : (d?.totais.noCiclo ?? 0);
  const g = d?.periodo.granularidade ?? "dia";
  const empresaDetalhe: FisAtrasoEmpresa | undefined =
    empresaAberta != null ? d?.empresas.find((e) => e.chave === empresaAberta) : undefined;
  const sobraCompetencias = (d?.competencias.length ?? 0) - competencias.length;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Atraso mediano"
          icone="historico"
          carregando={carregando}
          valor={emDias(mediana)}
          detalhe="Metade das notas demorou mais que isso"
          tom={(mediana ?? 0) > ATRASO_ALERTA ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="9 em cada 10 até"
          icone="velocimetro"
          carregando={carregando}
          valor={emDias(p90)}
          detalhe="O prazo que cobre quase tudo (p90)"
        />
        <Indicador
          rotulo="Dentro do ciclo"
          icone="ok"
          carregando={carregando}
          valor={pct(pctDe(noCiclo, notas))}
          detalhe={`${numCompact(noCiclo)} de ${numCompact(notas)} até 30 dias`}
        />
        <Indicador
          rotulo="Competências tocadas"
          icone="camadas"
          carregando={carregando}
          valor={num(pessoa ? pessoa.competencias : (d?.totais.competencias ?? 0))}
          detalhe="Meses de documento que receberam nota"
        />
        <Indicador
          rotulo="Mais antiga"
          icone="intervalo"
          carregando={carregando}
          valor={compet(pessoa ? pessoa.maisVelha : (d?.totais.maisVelha ?? null))}
          detalhe="A competência mais velha que recebeu nota"
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>
          Atraso é a distância entre a data do documento e o carimbo da escrituração. Mediana, nunca média. Fechar o mês
          anterior ao longo do mês seguinte é o ciclo normal do fiscal.
        </Nota>
        {pessoa && <Nota>Competências, série e empresas seguem com o time todo.</Nota>}
      </div>

      <PainelEscada
        titulo="Distribuição do Atraso"
        descricao={`Quanto cada nota esperou entre o documento e a escrituração · ${pessoa ? pessoa.nome : "Time todo"}`}
        faixas={FAIXAS_ATRASO_FISCAL}
        valores={pessoa ? pessoa.porFaixa : d?.totais.porFaixa}
        rotuloItem="Notas"
        carregando={carregando}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CaixaGrafico
          titulo="Competências Trabalhadas"
          descricao="Notas por mês do documento, na cor do atraso mediano daquele mês"
          carregando={carregando}
          vazio={competencias.length === 0 ? "Nenhuma competência no período." : false}
          legenda={<Legenda itens={FAIXAS_ATRASO_FISCAL.map((f) => ({ rotulo: f.rotulo, cor: f.cor }))} />}
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
            rotulo="Notas"
            cor={(c) => corDoAtraso(c.mediana)}
            tituloDica={(c) => `Competência ${c.rotulo}`}
            extrasDica={(c) => [
              { rotulo: "Atraso mediano", valor: emDias(c.mediana) },
              { rotulo: "Pessoas", valor: num(c.pessoas) },
            ]}
          />
        </CaixaGrafico>

        <CaixaGrafico
          titulo="Atraso ao Longo do Período"
          descricao={`Dias entre o documento e a escrituração, por ${nomeGranularidade(g)} de trabalho`}
          carregando={carregando}
          vazio={d && d.serie.every((p) => p.total === 0) ? "Nenhuma nota no período." : false}
          legenda={
            <Legenda
              itens={[
                { rotulo: "Mediana", cor: COR_MEDIANA },
                { rotulo: "p90", cor: COR_P90 },
                { rotulo: "Notas", cor: COR_VOLUME },
              ]}
            />
          }
        >
          {/* O volume entra atrás porque um dia de 30 notas e um de 30 mil
              desenham a mesma linha de mediana: sem ele, um pico de atraso
              irrelevante parece problema. Dia sem nota não tem mediana, e a
              linha corta ali em vez de ligar dois pontos por cima do vazio. */}
          <GraficoPeriodo
            pontos={d?.serie ?? []}
            granularidade={g}
            series={[
              { chave: "total", rotulo: "Notas", cor: COR_VOLUME, tipo: "barra", eixoDireito: true },
              { chave: "mediana", rotulo: "Atraso mediano", cor: COR_MEDIANA, tipo: "linha" },
              { chave: "p90", rotulo: "9 em cada 10 até", cor: COR_P90, tipo: "linha" },
            ]}
            formatar={(v, s) => (s.chave === "total" ? num(v) : emDias(v))}
            formatarEixo={(v) => `${numCompact(v)} d`}
            formatarEixoDireito={numCompact}
          />
        </CaixaGrafico>
      </div>

      <RankingPessoas
        titulo="Atraso por Pessoa"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar os números do topo"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="mediana"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém escriturou nota no período."
        rodape={<Nota>Quem escritura pouco e antigo sobe no atraso mediano. Leia junto com a coluna Notas.</Nota>}
      />

      <PainelQuebra
        titulo="Empresas Mais Atrasadas"
        descricao={`Atraso mediano, só empresas com ${num(d?.minimoEmpresa ?? 20)} ou mais notas no período`}
        itens={empresas}
        formatar={(v) => emDias(v)}
        carregando={carregando}
        vazio="Nenhuma empresa com notas suficientes para medir."
        aoClicar={(i) => setEmpresaAberta(i.chave)}
        selecionado={empresaAberta}
      />

      <Modal
        aberto={empresaDetalhe != null}
        onFechar={() => setEmpresaAberta(null)}
        titulo={empresaDetalhe?.nome ?? ""}
        descricao={empresaDetalhe ? <span className="num">Empresa {empresaDetalhe.chave}</span> : undefined}
        rodape={<Botao onClick={() => setEmpresaAberta(null)}>Fechar</Botao>}
      >
        {empresaDetalhe && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Par rotulo="Notas">
                <span className="num font-[600]">{num(empresaDetalhe.notas)}</span>
              </Par>
              <Par rotulo="Atraso mediano">
                <span className="num">{emDias(empresaDetalhe.mediana)}</span>
              </Par>
              <Par rotulo="9 em cada 10 até">
                <span className="num">{emDias(empresaDetalhe.p90)}</span>
              </Par>
              <Par rotulo="Competência mais velha">
                <span className="num">{compet(empresaDetalhe.maisVelha)}</span>
              </Par>
            </dl>
            <EscadaFaixas faixas={FAIXAS_ATRASO_FISCAL} valores={empresaDetalhe.porFaixa} rotuloItem="Notas" />
          </div>
        )}
      </Modal>
    </>
  );
}
