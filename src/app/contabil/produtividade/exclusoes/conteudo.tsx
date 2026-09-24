"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { CaixaGrafico } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { PainelCalendario } from "@/componentes/produto/produtividade/painel-calendario";
import { PainelEscada } from "@/componentes/produto/produtividade/painel-escada";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import {
  calendarioDe,
  nomeGranularidade,
  rotuloBucketLongo,
  totalPorBucket,
} from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { decimalBR } from "@/lib/csv";
import { brlCompact, num, pct } from "@/lib/format";
import { emDias, pctDe, slug } from "@/lib/prod-formato";
import { FAIXAS_IDADE, type ContabilExclusoesResp, type CtbExclPessoa } from "@/lib/contabil-exclusoes-tipos";
import { CLASSES } from "@/lib/contabil-produtividade-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const CLASSE = new Map(CLASSES.map((c) => [c.id, c]));
const COR_EXCLUSAO = "var(--serie-4)";

/** Idade mediana acima disso é mexer em mês fechado, não consertar o do dia. */
const IDADE_ALERTA = 90;

const COLUNAS: ColunaRanking<CtbExclPessoa>[] = [
  { id: "excluidos", rotulo: "Exclusões", valor: (p) => p.excluidos },
  { id: "deOutros", rotulo: "De outros", dica: "Lançamentos que outra pessoa tinha feito", valor: (p) => p.excluidos - p.proprios },
  {
    id: "idadeMediana",
    rotulo: "Idade mediana",
    dica: "Metade do que apagou era mais velho que isso",
    valor: (p) => p.idadeMediana ?? 0,
    celula: (p) => emDias(p.idadeMediana),
    alerta: (p) => (p.idadeMediana ?? 0) > IDADE_ALERTA,
  },
  {
    id: "idadeMaxima",
    rotulo: "Mais velho",
    dica: "O lançamento mais antigo que apagou",
    valor: (p) => p.idadeMaxima,
    celula: (p) => emDias(p.idadeMaxima),
    secundaria: true,
  },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "dias", rotulo: "Dias", dica: "Dias em que apagou alguma coisa", valor: (p) => p.dias, secundaria: true },
  { id: "valor", rotulo: "Valor", valor: (p) => p.valor, celula: (p) => brlCompact(p.valor), largura: "104px" },
];

/**
 * Exclusões: o que o time apagou do razão no período, lido do
 * `lctoctbexcluido` pela data da exclusão.
 *
 * Exclusão não é erro por definição: reimportar um mês apaga e regrava milhares
 * de linhas, e isso é rotina. O que pesa é quem apaga muito lançamento VELHO e
 * de OUTRA pessoa: apagar no mesmo dia é conserto, apagar mês fechado é outra
 * conversa. Por isso a escada de idade e a coluna "De outros".
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ContabilExclusoesResp>(
    "contabil-produtividade-exclusoes",
    qs == null ? null : `/api/contabil/produtividade-exclusoes?${qs}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  const autores = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa)
      return d.autores.map((a) => ({
        chave: a.chave,
        nome: a.nome,
        qtd: a.qtd,
        detalhe:
          a.proprios > 0 ? `${pct(pctDe(a.proprios, a.qtd))} apagados pela própria pessoa` : "Nenhum apagado pela própria pessoa",
      }));
    const nomes = new Map(d.autores.map((a) => [a.chave, a.nome]));
    return pessoa.autores.map((a) => ({
      chave: a.chave,
      nome: nomes.get(a.chave) ?? `Usuário ${a.chave}`,
      qtd: a.qtd,
      detalhe: a.chave === String(pessoa.codigo) ? "Lançamento da própria pessoa" : undefined,
    }));
  }, [d, pessoa]);

  const origens = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    const meta = new Map(d.origens.map((o) => [o.chave, o]));
    return (pessoa ? pessoa.origens : d.origens).map((o) => {
      const classe = meta.get(o.chave)?.classe ?? "outros";
      return {
        chave: o.chave,
        nome: meta.get(o.chave)?.nome ?? o.chave,
        qtd: o.qtd,
        cor: CLASSE.get(classe)?.cor,
        detalhe: CLASSE.get(classe)?.rotulo,
      };
    });
  }, [d, pessoa]);

  const empresas = useMemo<ItemQuebra[] | undefined>(
    () =>
      (pessoa ? pessoa.topEmpresas : d?.empresas)?.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.qtd,
        detalhe: brlCompact(e.valor),
      })),
    [d, pessoa]
  );

  const serie = useMemo<{ bucket: string; total: number }[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa) return d.serie;
    return totalPorBucket(
      pessoa.serie,
      d.serie.map((p) => p.bucket),
      d.periodo.granularidade
    );
  }, [d, pessoa]);

  const calendario = useMemo(
    () => (d ? (pessoa ? calendarioDe(d.periodo, pessoa.serie, pessoa.excluidos) : d.calendario) : undefined),
    [d, pessoa]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `exclusoes-contabil-${corte}-${periodo}${doTime ? "" : alvo}`;
    const g = d.periodo.granularidade;
    return [
      {
        id: "pessoas",
        rotulo: "Quem excluiu",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Exclusões", "Próprias", "De outros", "Idade mediana (dias)",
            "Mais velho (dias)", "Empresas", "Dias", "Valor", ...FAIXAS_IDADE.map((f) => f.rotulo),
          ],
          linhas: d.ranking.map((p) => [
            p.codigo,
            p.nome,
            p.inativo ? "desligado" : "ativo",
            p.excluidos,
            p.proprios,
            p.excluidos - p.proprios,
            p.idadeMediana ?? "",
            p.idadeMaxima,
            p.empresas,
            p.dias,
            decimalBR(p.valor),
            ...p.porFaixa,
          ]),
        }),
      },
      {
        id: "autores",
        rotulo: pessoa ? `De quem ${pessoa.nome} apagou` : "De quem era o lançamento",
        nome: arquivo("autores"),
        montar: () => ({ cabecalhos: ["Código", "Pessoa", "Exclusões"], linhas: (autores ?? []).map((a) => [a.chave, a.nome, a.qtd]) }),
      },
      {
        id: "origens",
        rotulo: pessoa ? `Origens de ${pessoa.nome}` : "Origens do time",
        nome: arquivo("origens"),
        montar: () => ({ cabecalhos: ["Código", "Origem", "Exclusões"], linhas: (origens ?? []).map((o) => [o.chave, o.nome, o.qtd]) }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Exclusões", "Valor"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [e.chave, e.nome, e.qtd, decimalBR(e.valor)]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", "Exclusões"],
          linhas: (serie ?? []).map((p) => [rotuloBucketLongo(p.bucket, g), p.total]),
        }),
      },
    ];
  }, [d, pessoa, autores, origens, serie]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={d?.ranking.map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.excluidos, inativo: p.inativo })) ?? []}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.totais.excluidos === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="apagar"
            titulo="Ninguém apagou lançamento no período"
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  const excluidos = pessoa ? pessoa.excluidos : (d?.totais.excluidos ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const deOutros = pessoa ? pessoa.excluidos - pessoa.proprios : (d?.totais.deOutros ?? 0);
  const idadeMediana = pessoa ? pessoa.idadeMediana : (d?.totais.idadeMediana ?? null);
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = d?.periodo.granularidade ?? "dia";
  const topEmpresa = (pessoa ? pessoa.topEmpresas[0] : d?.empresas[0])?.nome;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Exclusões"
          icone="apagar"
          carregando={carregando}
          valor={num(excluidos)}
          detalhe={
            <>
              {!pessoa && d && <Variacao atual={d.totais.excluidos} anterior={d.anterior.excluidos} bomQuandoSobe={false} />}
              {!pessoa && d && d.anterior.excluidos > 0 && " · "}
              {brlCompact(valor)} apagados
            </>
          }
        />
        {/* Sem pessoa, a régua é o que ENTROU no período: exclusões sobre
            lançamentos é a taxa de regravação do escritório. Com uma pessoa
            isolada essa conta perde o sentido (numerador de uma, denominador de
            todos), e a régua vira a parte dela no que o time apagou. */}
        {pessoa ? (
          <Indicador
            rotulo="Participação"
            icone="grafico"
            carregando={carregando}
            valor={pct(pctDe(excluidos, d?.totais.excluidos ?? 0))}
            detalhe={`De ${num(d?.totais.excluidos ?? 0)} exclusões do time`}
          />
        ) : (
          <Indicador
            rotulo="Regravação"
            icone="reabrir"
            carregando={carregando}
            valor={pct(pctDe(excluidos, d?.totais.lancados ?? 0))}
            detalhe={`Do que entrou no período (${num(d?.totais.lancados ?? 0)} lançamentos)`}
          />
        )}
        <Indicador
          rotulo="De outra pessoa"
          icone="usuario"
          carregando={carregando}
          valor={num(deOutros)}
          detalhe={`${pct(pctDe(deOutros, excluidos))} do que foi apagado`}
        />
        <Indicador
          rotulo="Idade mediana"
          icone="historico"
          carregando={carregando}
          valor={emDias(idadeMediana)}
          detalhe="Metade do apagado era mais velha que isso"
          tom={(idadeMediana ?? 0) > IDADE_ALERTA ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Empresas atingidas"
          icone="empresa"
          carregando={carregando}
          valor={num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))}
          detalhe={topEmpresa ?? "Sem exclusão"}
        />
      </FaixaIndicadores>

      <Nota>Período pela data da exclusão. Reimportar um mês apaga e regrava em lote.</Nota>

      <PainelEscada
        titulo="Idade do que foi apagado"
        descricao={`Quanto tempo o lançamento tinha quando foi excluído · ${escopo}`}
        faixas={FAIXAS_IDADE}
        valores={pessoa ? pessoa.porFaixa : d?.totais.porFaixa}
        rotuloItem="Exclusões"
        carregando={carregando}
      />

      <RankingPessoas
        titulo="Quem excluiu"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="excluidos"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém apagou nada no período."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PainelQuebra
          titulo="De quem era o lançamento"
          descricao={pessoa ? `O que ${pessoa.nome} apagou, por quem tinha lançado` : "Quem tinha lançado o que o time apagou"}
          itens={autores}
          corPadrao={COR_EXCLUSAO}
          carregando={carregando}
        />
        <PainelQuebra
          titulo="Por origem"
          descricao={`Que tipo de lançamento foi apagado · ${escopo}`}
          itens={origens}
          carregando={carregando}
        />
        <PainelQuebra
          titulo="Por empresa"
          descricao={pessoa ? `Onde ${pessoa.nome} apagou` : "Onde as exclusões aconteceram"}
          itens={empresas}
          carregando={carregando}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CaixaGrafico
          titulo="Ritmo das exclusões"
          descricao={`Exclusões por ${nomeGranularidade(g)} · ${escopo}`}
          carregando={carregando}
          vazio={serie && serie.every((p) => p.total === 0) ? "Nenhuma exclusão no período." : false}
        >
          <GraficoPeriodo
            pontos={serie ?? []}
            granularidade={g}
            series={[{ chave: "total", rotulo: "Exclusões", cor: COR_EXCLUSAO, tipo: "barra" }]}
          />
        </CaixaGrafico>
        <PainelCalendario
          calendario={calendario}
          rotuloItem="Exclusões"
          descricao={`Exclusões por dia · ${escopo}`}
          carregando={carregando}
        />
      </div>
    </>
  );
}
