"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import {
  COR_FAMILIA,
  gestoDescrito,
  PontoFamilia,
  rotuloFamilia,
  rotuloLinhas,
  somaFamilia,
  unidades,
} from "@/componentes/produto/folha/produtividade-familias";
import {
  CHAVE_REGISTROS,
  ModalRegistros,
  tabelaRegistros,
  urlRegistros,
} from "@/componentes/produto/folha/produtividade-registros";
import { CaixaGrafico } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { FiltroPessoa } from "@/componentes/produto/produtividade/filtro-pessoa";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { nomeGranularidade, rotuloBucketLongo } from "@/componentes/produto/produtividade/recorte";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { buscarJson, useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { decimal, num, pct } from "@/lib/format";
import { pctDe, slug } from "@/lib/prod-formato";
import { infoDoTipo, tiposDaFamilia, type DpFamilia, type DpLinha, type DpQuebra, type DpTipo } from "@/lib/dp-tipos";
import { ContraAnterior } from "../contra-anterior";
import { opcoesPessoa, periodoDoQs, situacaoPessoa, useResumoDp } from "../use-resumo-dp";

const maiuscula = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/**
 * Aba de uma família de trabalho do DP: os trabalhos dela num seletor e, para
 * o escolhido, os números, quem fez, onde e quando.
 *
 * Quem fez sai do ranking que a Visão Geral já trouxe (mesma consulta, mesmo
 * cache); por empresa e evolução vêm do `dp-quebra`, que é por trabalho e
 * respeita a pessoa isolada. Somar famílias no cliente inventaria uma série
 * que o banco não devolveu, então os gráficos são do trabalho, não da família.
 */
export function Conteudo({ familia }: { familia: DpFamilia }) {
  const { qs, consulta, d, pessoaSel, pessoa, setPessoaSel } = useResumoDp();
  const carregando = !d;
  const qc = useQueryClient();
  // Catálogo lido por hook: o React Compiler trata o que sai de um hook como
  // imutável, e o que sai de função importada como algo que a próxima chamada
  // pode mudar (e aí desiste de memoizar a tela).
  const trabalhos = useMemo(() => tiposDaFamilia(familia), [familia]);

  // O trabalho escolhido é da aba: cada família lembra o seu. Um valor que
  // não é desta família (não deveria acontecer, mas a chave é texto) cai no
  // primeiro dela em vez de mostrar o gráfico de outra.
  const [tipoSel, setTipoSel] = useEstadoTela<DpTipo>("trabalho", trabalhos[0].id);
  const tipo = trabalhos.some((t) => t.id === tipoSel) ? tipoSel : trabalhos[0].id;
  const info = useMemo(() => infoDoTipo(tipo), [tipo]);
  const cor = COR_FAMILIA[familia];
  const [registrosAberto, setRegistrosAberto] = useState(false);

  // A quebra pede a pessoa isolada. Antes do resumo chegar ela vai com a
  // escolha guardada, sem esperar; se a pessoa não estiver no ranking novo, a
  // URL muda e a quebra volta para o time.
  const usuario = d ? (pessoa?.codigo ?? null) : pessoaSel;
  const quebra = useConsulta<DpQuebra>(
    "folha-dp-quebra",
    qs == null ? null : `/api/folha/dp-quebra?${qs}&tipo=${tipo}${usuario != null ? `&usuario=${usuario}` : ""}`,
    // Trocar de trabalho não mostra a quebra do anterior como provisória: o
    // gráfico na cor certa com o número errado engana mais que o esqueleto.
    { manterAnterior: false }
  );
  const q = quebra.data;
  const urlLista = qs == null ? null : urlRegistros(qs, tipo, usuario);

  const quemFez = useMemo(
    () =>
      d?.ranking
        .map((c) => ({ codigo: c.codigo, nome: c.nome, auto: c.auto, qtd: c.porTipo[tipo] }))
        .filter((c) => c.qtd > 0)
        .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR")),
    [d, tipo]
  );
  const humanos = useMemo(() => quemFez?.filter((c) => !c.auto) ?? [], [quemFez]);
  const somaQuemFez = quemFez?.reduce((a, c) => a + c.qtd, 0) ?? 0;
  const sistemaFez = humanos.length !== (quemFez?.length ?? 0);

  const itensQuemFez = useMemo<ItemQuebra[] | undefined>(
    () =>
      quemFez?.map((c) => ({
        chave: String(c.codigo),
        nome: c.nome,
        qtd: c.qtd,
        cor,
        detalhe: pct(pctDe(c.qtd, somaQuemFez)),
      })),
    [quemFez, somaQuemFez, cor]
  );

  const somaEmpresas = q?.porEmpresa.reduce((a, e) => a + e.qtd, 0) ?? 0;
  const itensEmpresas = useMemo<ItemQuebra[] | undefined>(
    () =>
      q?.porEmpresa.map((e) => ({
        chave: String(e.codigo),
        nome: e.nome,
        qtd: e.qtd,
        cor,
        detalhe: pct(pctDe(e.qtd, somaEmpresas)),
      })),
    [q, somaEmpresas, cor]
  );

  // O que a quebra conta. Ela conta LINHA; no trabalho feito em lote a linha é
  // o funcionário (ou o envio), e o painel tem que dizer isso em vez de pôr
  // 18 mil "encargos" ao lado de um indicador que diz 137.
  const unidadeQuebra = info.gesto ? rotuloLinhas(info) : info.rotulo;
  const escopo = pessoa ? pessoa.nome : "Time todo";
  const g = q?.granularidade ?? "dia";

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d || qs == null) return [];
    const periodo = periodoDoQs(qs);
    const alvo = pessoa ? `-${slug(pessoa.nome)}` : "";
    const base = `produtividade-dp-${tipo}`;
    return [
      {
        id: "quem-fez",
        rotulo: "Quem fez",
        descricao: info.rotulo,
        nome: `${base}-pessoas-${periodo}`,
        montar: () => ({
          cabecalhos: ["Código", "Pessoa", "Situação", info.rotulo],
          linhas: d.ranking
            .filter((c) => c.porTipo[tipo] > 0)
            .sort((a, b) => b.porTipo[tipo] - a.porTipo[tipo])
            .map((c) => [c.codigo, c.nome, situacaoPessoa(c), c.porTipo[tipo]]),
        }),
      },
      {
        id: "empresas",
        rotulo: pessoa ? `Empresas de ${pessoa.nome}` : "Por empresa",
        nome: `${base}-empresas-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: ["Código", "Empresa", unidadeQuebra],
          linhas: (q?.porEmpresa ?? []).map((e) => [e.codigo, e.nome, e.qtd]),
        }),
      },
      {
        id: "evolucao",
        rotulo: "Evolução no período",
        nome: `${base}-evolucao-${periodo}${alvo}`,
        montar: () => ({
          cabecalhos: [g === "mes" ? "Mês" : "Dia", unidadeQuebra],
          linhas: (q?.serie ?? []).map((p) => [rotuloBucketLongo(p.bucket, g), p.qtd]),
        }),
      },
      {
        id: "registros",
        rotulo: "Registros",
        descricao: "Uma linha por registro, os mil mais recentes",
        nome: `${base}-registros-${periodo}${alvo}`,
        // A mesma chave do modal: se ele já abriu, o arquivo sai do que está
        // na memória em vez de varrer a fonte de novo.
        montar: async () =>
          tabelaRegistros(
            tipo,
            await qc.fetchQuery({
              queryKey: [CHAVE_REGISTROS, urlLista],
              queryFn: () => buscarJson<DpLinha[]>(urlLista!),
              staleTime: 60_000,
            })
          ),
      },
    ];
  }, [d, qs, pessoa, tipo, info.rotulo, unidadeQuebra, q, g, qc, urlLista]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <FiltroPessoa
        pessoas={opcoesPessoa(d?.ranking, (c) => somaFamilia(c.porTipo, familia))}
        valor={pessoa ? pessoa.codigo : null}
        onMudar={setPessoaSel}
        desabilitado={carregando}
      />
      <MenuExportar modulo="folha" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && somaFamilia(d.totais.porTipo, familia) === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="velocimetro"
            titulo={`Nenhum trabalho de ${rotuloFamilia(familia)} no período`}
            descricao="Amplie o período ou tire o filtro de empresa no topo."
          />
        </div>
      </>
    );

  if (d && pessoa && somaFamilia(pessoa.porTipo, familia) === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="usuario"
            titulo={`${pessoa.nome} não fez nada de ${rotuloFamilia(familia)} no período`}
            descricao="Escolha outra pessoa no cabeçalho."
            acao={
              <Botao icone="pessoas" onClick={() => setPessoaSel(null)}>
                Ver o time todo
              </Botao>
            }
          />
        </div>
      </>
    );

  const contar = (t: DpTipo) => (pessoa ? pessoa.porTipo[t] : (d?.totais.porTipo[t] ?? 0));
  const totalTime = d?.totais.porTipo[tipo] ?? 0;
  const totalMostrado = contar(tipo);
  // As linhas da pessoa não vêm no resumo; a quebra dela conta linha, e a soma
  // da série é o total de linhas no período.
  const linhas = pessoa ? q?.serie.reduce((a, p) => a + p.qtd, 0) : d?.totais.linhas[tipo];
  const media = humanos.length > 0 ? humanos.reduce((a, c) => a + c.qtd, 0) / humanos.length : 0;
  const maiorEmpresa = q?.porEmpresa[0];
  const gesto = gestoDescrito(info);

  return (
    <>
      {acoes}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {trabalhos.length > 1 ? (
          <div className="max-w-full overflow-x-auto">
            <Segmentado
              rotulo="Trabalho"
              valor={tipo}
              onMudar={setTipoSel}
              opcoes={trabalhos.map((t) => ({
                valor: t.id,
                rotulo: (
                  <>
                    {t.rotulo}
                    {d && <span className="num text-apagado">{num(contar(t.id))}</span>}
                  </>
                ),
              }))}
            />
          </div>
        ) : (
          <span />
        )}
        <Botao icone="tabela" onClick={() => setRegistrosAberto(true)} disabled={carregando}>
          Ver registros
        </Botao>
      </div>

      <FaixaIndicadores colunas={info.gesto ? 5 : 4}>
        <Indicador
          rotulo={
            <>
              <PontoFamilia familia={familia} className="mr-1.5" />
              {info.rotulo}
            </>
          }
          carregando={carregando}
          valor={num(totalMostrado)}
          detalhe={
            pessoa ? (
              `${pct(pctDe(totalMostrado, somaQuemFez))} do time`
            ) : d ? (
              <ContraAnterior atual={totalTime} anterior={d.anterior.porTipo[tipo]} />
            ) : undefined
          }
        />
        {info.gesto && (
          <Indicador
            rotulo={rotuloLinhas(info)}
            icone="tabela"
            carregando={linhas == null && !quebra.isError}
            valor={linhas == null ? "—" : num(linhas)}
            detalhe={
              linhas != null && totalMostrado > 0
                ? `${decimal(linhas / totalMostrado)} por ${info.unidade}`
                : "Nada no período"
            }
          />
        )}
        <Indicador
          rotulo="Pessoas que fizeram"
          icone="pessoas"
          carregando={carregando}
          valor={num(humanos.length)}
          detalhe={humanos[0] ? `Quem mais fez: ${humanos[0].nome}` : "Ninguém do DP no período"}
        />
        <Indicador
          rotulo="Empresas atendidas"
          icone="empresa"
          carregando={!q && !quebra.isError}
          valor={q ? num(q.porEmpresa.length) : "—"}
          detalhe={maiorEmpresa ? `Maior: ${maiorEmpresa.nome}` : "Nenhuma no período"}
        />
        <Indicador
          rotulo="Média por pessoa"
          icone="grafico"
          carregando={carregando}
          valor={decimal(media)}
          detalhe={`${maiuscula(unidades(info))} por pessoa${sistemaFez ? ", sem o Sistema" : ""}`}
        />
      </FaixaIndicadores>

      {(gesto || info.temAutomacao || pessoa) && (
        <div className="flex flex-col gap-1">
          {gesto && (
            <Nota>
              Cada {info.unidade} conta uma vez: {gesto}. Por Empresa e Evolução contam{" "}
              {rotuloLinhas(info).toLowerCase()}.
            </Nota>
          )}
          {info.temAutomacao && (
            <Nota>
              Parte deste trabalho é rotina automática, feita pelo Sistema. Conta no total e fica fora da contagem de
              pessoas.
            </Nota>
          )}
          {pessoa && <Nota>Quem Fez e Pessoas que fizeram seguem com o time todo.</Nota>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Quem Fez"
          descricao={pessoa ? "Clique de novo para voltar ao time" : "Clique numa pessoa para isolar o resto da tela"}
          itens={itensQuemFez}
          corPadrao={cor}
          carregando={carregando}
          aoClicar={(i) => setPessoaSel(pessoa && String(pessoa.codigo) === i.chave ? null : Number(i.chave))}
          selecionado={pessoa ? String(pessoa.codigo) : null}
          vazio="Ninguém fez esse trabalho no período."
        />
        {quebra.isError ? (
          <PainelErro
            className="self-start"
            mensagem={(quebra.error as Error).message}
            onTentar={() => quebra.refetch()}
          />
        ) : (
          <PainelQuebra
            titulo="Por Empresa"
            descricao={`${info.gesto ? `${rotuloLinhas(info)} em cada empresa` : "Onde o trabalho aconteceu"} · ${escopo}`}
            itens={itensEmpresas}
            corPadrao={cor}
            carregando={!q}
            vazio={pessoa ? `Nada de ${pessoa.nome} neste trabalho no período.` : "Ninguém fez esse trabalho no período."}
          />
        )}
      </div>

      {!quebra.isError && (
        <CaixaGrafico
          titulo="Evolução no Período"
          descricao={`${unidadeQuebra} por ${nomeGranularidade(g)} · ${escopo}`}
          carregando={!q}
          vazio={q && q.serie.every((p) => p.qtd === 0) ? "Nada no período." : false}
          altura={260}
        >
          <GraficoPeriodo
            pontos={q?.serie ?? []}
            granularidade={g}
            series={[{ chave: "qtd", rotulo: unidadeQuebra, cor, tipo: "barra" }]}
          />
        </CaixaGrafico>
      )}

      <ModalRegistros
        aberto={registrosAberto}
        onFechar={() => setRegistrosAberto(false)}
        tipo={tipo}
        url={urlLista}
        descricao={`${info.rotulo} · ${escopo}`}
        arquivo={`produtividade-dp-${tipo}-registros-${qs ? periodoDoQs(qs) : ""}${pessoa ? `-${slug(pessoa.nome)}` : ""}`}
      />
    </>
  );
}
