"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { ComposicaoClasses } from "@/componentes/produto/produtividade/composicao-classes";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { HorasDoDia } from "@/componentes/produto/produtividade/horas-do-dia";
import { CorpoQuebra } from "@/componentes/produto/produtividade/modal-quebra";
import { PainelCalendario } from "@/componentes/produto/produtividade/painel-calendario";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { RankingPessoas, type ColunaRanking } from "@/componentes/produto/produtividade/ranking-pessoas";
import {
  calendarioDe,
  nomeGranularidade,
  rotuloBucketLongo,
  rotuloHora,
  totalPorBucket,
} from "@/componentes/produto/produtividade/recorte";
import { SerieClasses } from "@/componentes/produto/produtividade/serie-periodo";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataBR, num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import { zeroDe, type ClasseInfo, type PorClasseGen, type SeriePontoGen } from "@/lib/prod-tipos";
import {
  ESPECIES_PROD,
  NATUREZAS,
  rotuloNatureza,
  type FiscalProdutividadeResp,
  type FisPessoa,
} from "@/lib/fiscal-produtividade-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

const ESPECIE = new Map(ESPECIES_PROD.map((e) => [e.id, e]));
const NATUREZA = new Map(NATUREZAS.map((n) => [n.id, n]));
const nomeEspecie = (id: string) => ESPECIE.get(id)?.rotulo ?? id;

const COLUNAS: ColunaRanking<FisPessoa>[] = [
  { id: "notas", rotulo: "Notas", valor: (p) => p.notas },
  { id: "entradas", rotulo: "Entradas", cor: "var(--ent)", valor: (p) => p.entradas },
  { id: "saidas", rotulo: "Saídas", cor: "var(--sai)", valor: (p) => p.saidas },
  // Numa base em que a integração traz quase tudo, o volume bruto diz pouco:
  // "a dedo" e "canceladas" ficam perto do total porque é nelas que o trabalho
  // humano aparece.
  { id: "aDedo", rotulo: "A dedo", dica: "Digitada ou importada, sem passar pela integração", valor: (p) => p.aDedo },
  { id: "canceladas", rotulo: "Canceladas", dica: "Escriturada e cancelada depois. Conta no total", valor: (p) => p.canceladas },
  {
    id: "rodadas",
    rotulo: "Rodadas",
    dica: "Empresa × dia × espécie: quantas vezes sentou e rodou",
    valor: (p) => p.rodadas,
    secundaria: true,
  },
  { id: "empresas", rotulo: "Empresas", valor: (p) => p.empresas },
  { id: "dias", rotulo: "Dias", dica: "Dias com alguma nota escriturada", valor: (p) => p.diasAtivos, secundaria: true },
  {
    id: "ultimo",
    rotulo: "Última",
    dica: "Último dia com nota escriturada",
    valor: (p) => (p.ultimo ? Date.parse(p.ultimo) : 0),
    celula: (p) => dataBR(p.ultimo),
    largura: "104px",
    secundaria: true,
  },
  { id: "valor", rotulo: "Valor", valor: (p) => p.valor, celula: (p) => brlCompact(p.valor), largura: "104px" },
];

/**
 * Lançamentos do Fiscal: quem escriturou as notas do período, por pessoa,
 * espécie, empresa, dia e hora. Uma consulta aos `lctofis{ent,sai}` traz tudo;
 * isolar uma pessoa reprojeta o que já está na memória.
 *
 * A espécie da nota é filtro do módulo e vai na query (o servidor recorta no
 * `whereTrabalho`). A pessoa é recorte de tela e não sai do cliente.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const { especies: filtroEspecies, mudar: mudarEspecies, comEspecies } = useEspecies();
  const consulta = useConsulta<FiscalProdutividadeResp>(
    "fiscal-produtividade",
    qs == null ? null : `/api/fiscal/produtividade?${comEspecies(qs)}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [pessoaSel, setPessoaSel] = useEstadoTela<number | null>("pessoa", null);
  const [especieAberta, setEspecieAberta] = useState<string | null>(null);

  const pessoa = useMemo(
    () => (pessoaSel != null ? d?.ranking.find((p) => p.codigo === pessoaSel) : undefined),
    [d, pessoaSel]
  );

  // Código de origem fora do catálogo aparece com o rótulo que o domínio dá
  // ("Origem 4") em vez de sumir da composição e deixar a soma furada.
  const classesNatureza = useMemo<ClasseInfo[]>(() => {
    const extras = (d?.naturezas ?? [])
      .filter((n) => !NATUREZA.has(n.chave))
      .map((n) => ({ id: n.chave, rotulo: n.nome, descricao: "Código de origem sem nome no catálogo", cor: "var(--esp-outras)" }));
    return [...NATUREZAS, ...extras];
  }, [d]);

  const porNatureza = useMemo<PorClasseGen>(() => {
    const soma = zeroDe(classesNatureza);
    for (const n of (pessoa ? pessoa.naturezas : d?.naturezas) ?? []) soma[n.chave] = (soma[n.chave] ?? 0) + n.qtd;
    return soma;
  }, [d, pessoa, classesNatureza]);

  // Espécies do time ou só da pessoa isolada. Valor por espécie não é guardado
  // por pessoa (só por empresa): some da linha em vez de virar um R$ 0,00 falso.
  const especies = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    if (!pessoa)
      return d.especies.map((e) => ({
        chave: e.chave,
        nome: e.nome,
        qtd: e.qtd,
        cor: ESPECIE.get(e.chave)?.cor,
        detalhe: `${pct(pctDe(e.qtd, d.totais.notas))} · ${num(e.pessoas)} ${e.pessoas === 1 ? "pessoa" : "pessoas"} · ${brlCompact(e.valor)}`,
      }));
    return pessoa.especies.map((e) => ({
      chave: e.chave,
      nome: nomeEspecie(e.chave),
      qtd: e.qtd,
      cor: ESPECIE.get(e.chave)?.cor,
      detalhe: pct(pctDe(e.qtd, pessoa.notas)),
    }));
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
    () => (d ? (pessoa ? calendarioDe(d.periodo, pessoa.serie, pessoa.notas) : d.calendario) : undefined),
    [d, pessoa]
  );

  // Exportação: os mesmos cortes da tela, com o recorte ativo aplicado. O
  // ranking e o cruzamento pessoa × espécie saem sempre com o time inteiro.
  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const arquivo = (corte: string, doTime = false) => `produtividade-fiscal-${corte}-${periodo}${doTime ? "" : alvo}`;
    const g = d.periodo.granularidade;
    const escala = g === "mes" ? "Mês" : "Dia";
    return [
      {
        id: "pessoas",
        rotulo: "Ranking de pessoas",
        nome: arquivo("pessoas", true),
        montar: () => ({
          cabecalhos: [
            "Código", "Pessoa", "Situação", "Notas", "Entradas", "Saídas", "A dedo", "Canceladas",
            ...ESPECIES_PROD.map((e) => e.rotulo),
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
        nome: arquivo("pessoa-especie", true),
        montar: () => ({
          cabecalhos: ["Pessoa", "Espécie", "Notas"],
          linhas: d.ranking.flatMap((p) => p.especies.map((e) => [p.nome, nomeEspecie(e.chave), e.qtd])),
        }),
      },
      {
        id: "especies",
        rotulo: pessoa ? `Espécies de ${pessoa.nome}` : "Espécies do time",
        nome: arquivo("especies"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Espécie", "Notas"],
                linhas: pessoa.especies.map((e) => [nomeEspecie(e.chave), e.qtd]),
              }
            : {
                cabecalhos: ["Espécie", "Notas", "Pessoas", "Valor"],
                linhas: d.especies.map((e) => [e.nome, e.qtd, e.pessoas, decimalBR(e.valor)]),
              },
      },
      {
        id: "naturezas",
        rotulo: "Como as notas entraram",
        nome: arquivo("origem"),
        montar: () =>
          pessoa
            ? {
                cabecalhos: ["Código", "Origem", "Notas"],
                linhas: pessoa.naturezas.map((n) => [n.chave, rotuloNatureza(Number(n.chave)), n.qtd]),
              }
            : {
                cabecalhos: ["Código", "Origem", "Notas", "Valor"],
                linhas: d.naturezas.map((n) => [n.chave, n.nome, n.qtd, decimalBR(n.valor)]),
              },
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Empresas do time",
        nome: arquivo("empresas"),
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Notas", "Valor"],
          linhas: (pessoa ? pessoa.topEmpresas : d.empresas).map((e) => [e.chave, e.nome, e.qtd, decimalBR(e.valor)]),
        }),
      },
      {
        id: "serie",
        rotulo: "Evolução no período",
        nome: arquivo("evolucao"),
        montar: () => ({
          cabecalhos: pessoa ? [escala, "Notas"] : [escala, "Total", ...ESPECIES_PROD.map((e) => e.rotulo)],
          linhas: (serie ?? []).map((p) => [
            rotuloBucketLongo(p.bucket, g),
            p.total,
            ...(pessoa ? [] : ESPECIES_PROD.map((e) => Number(p[e.id] ?? 0))),
          ]),
        }),
      },
      {
        id: "horas",
        rotulo: "Por hora do dia",
        nome: arquivo("horas"),
        montar: () => ({
          cabecalhos: ["Hora", "Notas"],
          linhas: (pessoa ? pessoa.porHora : d.porHora).map((n, h) => [rotuloHora(h), n]),
        }),
      },
    ];
  }, [d, pessoa, serie]);

  const especieDetalhe = especieAberta != null ? d?.especies.find((e) => e.chave === especieAberta) : undefined;
  const quemEscriturou = useMemo(
    () =>
      especieAberta == null || !d
        ? []
        : d.ranking
            .map((p) => ({ codigo: p.codigo, nome: p.nome, qtd: p.especies.find((e) => e.chave === especieAberta)?.qtd ?? 0 }))
            .filter((p) => p.qtd > 0)
            .sort((a, b) => b.qtd - a.qtd),
    [d, especieAberta]
  );
  const fecharEspecie = () => setEspecieAberta(null);

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
            icone="nota"
            titulo="Ninguém escriturou nota no período"
            descricao={
              filtroEspecies.length
                ? "Tire o filtro de espécie, amplie o período ou tire o filtro de empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  const notas = pessoa ? pessoa.notas : (d?.totais.notas ?? 0);
  const valor = pessoa ? pessoa.valor : (d?.totais.valor ?? 0);
  const entradas = pessoa ? pessoa.entradas : (d?.totais.entradas ?? 0);
  const saidas = pessoa ? pessoa.saidas : (d?.totais.saidas ?? 0);
  const aDedo = pessoa ? pessoa.aDedo : (d?.totais.aDedo ?? 0);
  const canceladas = pessoa ? pessoa.canceladas : (d?.totais.canceladas ?? 0);
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = d?.periodo.granularidade ?? "dia";
  const topEmpresa = (pessoa ? pessoa.topEmpresas[0] : d?.empresas[0])?.nome;
  const soEstaEspecie = especieAberta != null && filtroEspecies.length === 1 && filtroEspecies[0] === especieAberta;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={6}>
        <Indicador
          rotulo="Notas escrituradas"
          icone="nota"
          carregando={carregando}
          valor={num(notas)}
          detalhe={
            <>
              {!pessoa && d && <Variacao atual={d.totais.notas} anterior={d.anterior.notas} />}
              {!pessoa && d && d.anterior.notas > 0 && " · "}
              {brlCompact(valor)} movimentados
            </>
          }
        />
        <Indicador
          rotulo="Entradas"
          icone="seta-baixo"
          carregando={carregando}
          valor={num(entradas)}
          detalhe={`${pct(pctDe(entradas, notas))} das notas`}
        />
        <Indicador
          rotulo="Saídas"
          icone="seta-cima"
          carregando={carregando}
          valor={num(saidas)}
          detalhe={`${pct(pctDe(saidas, notas))} das notas`}
        />
        <Indicador
          rotulo="A dedo"
          icone="editar"
          carregando={carregando}
          valor={num(aDedo)}
          detalhe={`${pct(pctDe(aDedo, notas))} fora da integração`}
        />
        <Indicador
          rotulo="Canceladas"
          icone="bloqueado"
          carregando={carregando}
          valor={num(canceladas)}
          detalhe={`${pct(pctDe(canceladas, notas))} das notas`}
        />
        <Indicador
          rotulo="Empresas atendidas"
          icone="empresa"
          carregando={carregando}
          valor={num(pessoa ? pessoa.empresas : (d?.totais.empresas ?? 0))}
          detalhe={topEmpresa ?? "Sem movimento"}
        />
      </FaixaIndicadores>

      <Nota>Período pela data em que a nota foi escriturada. As canceladas depois disso continuam no total.</Nota>

      <Painel titulo="Como as Notas Entraram" descricao={pessoa ? `Notas de ${pessoa.nome}` : "Notas do time"}>
        {d ? (
          <ComposicaoClasses classes={classesNatureza} porClasse={porNatureza} total={notas} ocultarVazio={["0"]} />
        ) : (
          <Esqueleto className="h-20 w-full" />
        )}
      </Painel>

      <RankingPessoas
        titulo="Quem Escriturou"
        descricao={pessoa ? "O ranking segue com o time todo" : "Clique numa pessoa para isolar o resto da tela"}
        linhas={d?.ranking}
        colunas={COLUNAS}
        ordemInicial="notas"
        carregando={carregando}
        selecionada={pessoa ? pessoa.codigo : null}
        onSelecionar={setPessoaSel}
        vazio="Ninguém escriturou nota no período."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Por Espécie"
          descricao={`De que é feito o volume · ${escopo}`}
          itens={especies}
          carregando={carregando}
          aoClicar={(i) => setEspecieAberta(i.chave)}
          selecionado={especieAberta}
        />
        <PainelQuebra
          titulo="Por Empresa"
          descricao={pessoa ? `Empresas atendidas por ${pessoa.nome}` : "Onde o trabalho aconteceu"}
          itens={empresas}
          carregando={carregando}
        />
      </div>

      <SerieClasses
        pontos={serie}
        classes={ESPECIES_PROD}
        granularidade={g}
        soTotal={!!pessoa}
        rotuloItem="Notas"
        descricao={
          pessoa ? `Notas de ${pessoa.nome} por ${nomeGranularidade(g)}` : `Notas por ${nomeGranularidade(g)}, por espécie`
        }
        carregando={carregando}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HorasDoDia
          porHora={pessoa ? pessoa.porHora : d?.porHora}
          rotuloItem="Notas"
          descricao={`Notas por hora do dia · ${escopo}`}
          carregando={carregando}
        />
        <PainelCalendario
          calendario={calendario}
          rotuloItem="Notas"
          descricao={`Notas por dia · ${escopo}`}
          carregando={carregando}
        />
      </div>

      {/* O detalhe de uma espécie: os números do time e quem a escriturou.
          "Filtrar" é o atalho para o filtro de espécie do cabeçalho, que vale
          pelo módulo inteiro; a lista de pessoas isola alguém nesta tela. */}
      <Modal
        aberto={especieDetalhe != null}
        onFechar={fecharEspecie}
        titulo={especieDetalhe?.nome ?? ""}
        descricao={especieDetalhe ? ESPECIE.get(especieDetalhe.chave)?.descricao : undefined}
        rodape={
          <>
            {especieDetalhe && !soEstaEspecie && (
              <Botao
                variante="fantasma"
                icone="filtrar"
                onClick={() => {
                  mudarEspecies([especieDetalhe.chave]);
                  fecharEspecie();
                }}
              >
                Filtrar por {especieDetalhe.nome}
              </Botao>
            )}
            <Botao onClick={fecharEspecie}>Fechar</Botao>
          </>
        }
      >
        {especieDetalhe && d && (
          <CorpoQuebra
            fatos={
              <>
                <Par rotulo="Notas">
                  <span className="num font-[600]">{num(especieDetalhe.qtd)}</span>
                </Par>
                <Par rotulo="Do total">
                  <span className="num">{pct(pctDe(especieDetalhe.qtd, d.totais.notas))}</span>
                </Par>
                <Par rotulo="Pessoas">
                  <span className="num">{num(especieDetalhe.pessoas)}</span>
                </Par>
                <Par rotulo="Valor">
                  <span className="num">{brl(especieDetalhe.valor)}</span>
                </Par>
              </>
            }
            pessoas={quemEscriturou}
            rotuloPessoas="Quem escriturou esta espécie"
            aoEscolher={(codigo) => {
              setPessoaSel(codigo);
              fecharEspecie();
            }}
          />
        )}
      </Modal>
    </>
  );
}
