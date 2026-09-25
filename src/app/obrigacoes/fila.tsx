"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useCasca } from "@/componentes/casca/casca-cliente";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import {
  CHAVE_CARTEIRA,
  CHAVE_FILA,
  PainelConsultaAcessorias,
  soDigitos,
  useConsultaAcessorias,
} from "@/componentes/produto/obrigacoes/fila-consulta";
import { ModalEntregaFila } from "@/componentes/produto/obrigacoes/fila-detalhe";
import {
  BarraFiltrosFila,
  FILTROS_FILA_VAZIOS,
  filtrosMarcados,
  listaOu,
  qsFiltrosFila,
  type FiltrosTelaFila,
  type OpcaoObrigacaoFila,
  type OpcaoResponsavelFila,
} from "@/componentes/produto/obrigacoes/fila-filtros";
import { FaixaFila } from "@/componentes/produto/obrigacoes/fila-indicadores";
import { FilaNaoCarregada, RetratoFila } from "@/componentes/produto/obrigacoes/fila-retrato";
import {
  nomeResponsavel,
  TabelaEntregasFila,
  TabelaObrigacoesFila,
  TabelaResponsaveisFila,
  TabelaSetoresFila,
} from "@/componentes/produto/obrigacoes/fila-tabelas";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { dataBR, documento, hojeISO, num } from "@/lib/format";
import type { EmpresaCarteira } from "@/lib/obrigacoes";
import type { EntregaFila, ObrigacaoFila, PainelObrigacoes, ResponsavelFila } from "@/lib/obrigacoes-tipos";
import { setoresDaSecao } from "@/lib/secoes/obrigacoes";

/** A rota devolve no máximo isto, do prazo mais antigo para o mais novo. */
const TETO_FILA = 500;

/** Enquanto uma varredura roda, a fila se recarrega sozinha neste ritmo. */
const RECARGA_RODANDO = 30_000;

/**
 * Opções de um combo lidas da última resposta SEM aquele filtro. Com um
 * responsável escolhido, a resposta só traz ele, e o combo encolheria a uma
 * linha: trocar de pessoa pediria soltar o filtro antes. A lembrança vale no
 * recorte do topo em que foi lida; a contagem, só se os outros filtros não
 * mudaram desde então (senão ela seria de outra fila e sai da lista).
 */
interface Lembranca<T> {
  escopo: string;
  resto: string;
  itens: T[];
}

function opcoesLembradas<T extends { total: number }>(
  atuais: T[] | null | undefined,
  lembranca: Lembranca<T> | null,
  filtrado: boolean,
  escopo: string,
  resto: string
): (Omit<T, "total"> & { total?: number })[] | null | undefined {
  if (!filtrado || !lembranca || lembranca.escopo !== escopo) return atuais;
  if (lembranca.resto === resto) return lembranca.itens;
  return lembranca.itens.map((r) => ({ ...r, total: undefined }));
}

function cortesDaFila(secao: string, d: PainelObrigacoes): CorteExportar[] {
  const dia = hojeISO();
  const cortes: CorteExportar[] = [];
  const { fila, responsaveis, obrigacoes, setores } = d;
  if (fila)
    cortes.push({
      id: "fila",
      rotulo: "Entregas na fila",
      descricao: fila.length >= TETO_FILA ? `As ${num(TETO_FILA)} de prazo mais antigo` : undefined,
      nome: `obrigacoes-${secao}-fila-${dia}`,
      montar: () => ({
        cabecalhos: [
          "Empresa",
          "CNPJ",
          "Código no Questor",
          "Obrigação",
          "Setor",
          "Competência",
          "Prazo",
          "Dias de atraso",
          "Multa",
          "Situação no Acessórias",
          "Responsável",
        ],
        linhas: fila.map((e) => [
          e.empresa,
          documento(e.cnpj),
          e.codigoempresa,
          e.obrigacao,
          e.dptoNome,
          e.competencia ? dataBR(e.competencia) : "",
          e.prazo ? dataBR(e.prazo) : "",
          // Na planilha, prazo futuro é zero de atraso, não atraso negativo.
          e.diasAtraso == null ? "" : Math.max(0, e.diasAtraso),
          e.multa ? "Sim" : "Não",
          e.status.replace(/!+$/, ""),
          nomeResponsavel(e.respNome) ?? "",
        ]),
      }),
    });
  if (responsaveis)
    cortes.push({
      id: "responsaveis",
      rotulo: "Por responsável",
      nome: `obrigacoes-${secao}-responsaveis-${dia}`,
      montar: () => ({
        cabecalhos: ["Responsável", "Na fila", "Vencidas", "Com multa", "Pior atraso (dias)"],
        linhas: responsaveis.map((r) => [
          nomeResponsavel(r.respNome) ?? "Sem responsável",
          r.total,
          r.atrasadas,
          r.comMulta,
          r.piorAtraso,
        ]),
      }),
    });
  if (setores && setores.length > 1)
    cortes.push({
      id: "setores",
      rotulo: "Por setor",
      nome: `obrigacoes-${secao}-setores-${dia}`,
      montar: () => ({
        cabecalhos: ["Setor", "Na fila", "Vencidas", "Com multa"],
        linhas: setores.map((s) => [s.dptoNome, s.total, s.atrasadas, s.comMulta]),
      }),
    });
  if (obrigacoes)
    cortes.push({
      id: "obrigacoes",
      rotulo: "Por obrigação",
      descricao: "As 20 com mais entregas",
      nome: `obrigacoes-${secao}-obrigacoes-${dia}`,
      montar: () => ({
        cabecalhos: ["Obrigação", "Na fila", "Vencidas"],
        linhas: obrigacoes.map((o) => [o.obrigacao, o.total, o.atrasadas]),
      }),
    });
  return cortes;
}

/** Um bloco da resposta veio nulo: a consulta dele falhou no servidor e o resto da tela seguiu. */
function ErroDoPainel({ onTentar }: { onTentar: () => void }) {
  return (
    <div className="p-4">
      <PainelErro titulo="Não deu para montar este painel" mensagem="A consulta dele falhou no servidor." onTentar={onTentar} />
    </div>
  );
}

/**
 * A consulta ao vivo, ligada à empresa do topo. Remonta quando ela muda (a
 * tela passa a `key`): resultado de uma empresa ao lado do nome de outra é o
 * tipo de tela que faz alguém decidir sobre dado errado.
 */
function ConsultaDaFila({
  secao,
  empresaTopo,
  comSetor,
}: {
  secao: string;
  empresaTopo: number | null;
  comSetor: boolean;
}) {
  const carteira = useConsulta<EmpresaCarteira[]>(
    CHAVE_CARTEIRA,
    empresaTopo != null ? "/api/obrigacoes/empresas" : null,
    { staleTime: 10 * 60_000 }
  );
  const consulta = useConsultaAcessorias(secao);
  const [digitado, setDigitado] = useState<string | null>(null);

  // Os CNPJs da empresa do topo na carteira. A filial é empresa própria no
  // Acessórias, então uma empresa do Questor pode ter vários.
  const doTopo =
    empresaTopo != null && carteira.data ? carteira.data.filter((e) => e.codigoempresa === empresaTopo) : undefined;
  const doc = digitado ?? (doTopo?.length === 1 ? doTopo[0].cnpj : "");

  let nota: ReactNode;
  if (doTopo && doTopo.length === 0)
    nota =
      carteira.data?.length === 0
        ? "A carteira do Acessórias chega com a primeira varredura. Digite o CNPJ."
        : "A empresa do topo não tem CNPJ ativo na carteira do Acessórias. Digite o CNPJ.";
  else if (doTopo && doTopo.length > 1 && !digitado)
    nota = `A empresa do topo tem ${num(doTopo.length)} CNPJs na carteira do Acessórias. Escolha qual consultar.`;

  return (
    <PainelConsultaAcessorias
      documento={doc}
      onDocumento={(v) => {
        setDigitado(v);
        if (soDigitos(v) !== soDigitos(doc)) consulta.limpar();
      }}
      opcoes={doTopo && doTopo.length > 1 ? doTopo : undefined}
      nota={nota}
      onConsultar={() => consulta.consultar(doc)}
      buscando={consulta.buscando}
      erro={consulta.erro}
      resultado={consulta.resultado}
      comSetor={comSetor}
    />
  );
}

/**
 * A fila de entregas do Acessórias, uma tela para as quatro seções de fila. O
 * que muda entre elas é o SETOR, e ele vem da seção (é o que a permissão
 * libera), nunca de um filtro na tela. A empresa vem do topo e é opcional: sem
 * ela, a fila é o escopo inteiro da pessoa.
 *
 * Todo número aqui é um retrato datado: a fila é materializada pela varredura
 * diária (a API cobra uma chamada por empresa), então a tela diz de quando é o
 * dado antes de mostrá-lo.
 */
export default function Fila({ secao }: { secao: string }) {
  const { qs } = useExecucao();
  const { acessos } = useCasca();
  const qc = useQueryClient();
  const [filtros, setFiltros] = useEstadoTela<FiltrosTelaFila>("filtros", FILTROS_FILA_VAZIOS);
  const [lembrancaResp, setLembrancaResp] = useEstadoTela<Lembranca<ResponsavelFila> | null>("lembranca-resp", null);
  const [lembrancaObrig, setLembrancaObrig] = useEstadoTela<Lembranca<ObrigacaoFila> | null>("lembranca-obrig", null);
  const [aberta, setAberta] = useState<EntregaFila | null>(null);

  const escopo = qs ?? "";
  const topo = new URLSearchParams(escopo);
  const empresasTopo = (topo.get("empresas") ?? "").split(",").filter(Boolean);
  const empresaTopo = empresasTopo.length === 1 ? Number(empresasTopo[0]) : null;
  const recortadoNoTopo = empresasTopo.length > 0 || topo.has("grupos");
  // Seção de um setor só (Fiscal, DP) não repete o setor embaixo de cada obrigação.
  const comSetor = (setoresDaSecao(secao) ?? []).length !== 1;
  const podeConfigurar = acessos.obrigacoes?.includes("configuracoes") ?? false;

  const url = `/api/obrigacoes/fila?${[`secao=${encodeURIComponent(secao)}`, escopo, qsFiltrosFila(filtros)]
    .filter(Boolean)
    .join("&")}`;
  // Quem diz que a varredura está rodando é a própria resposta: lida do cache,
  // ela liga a recarga de 30 s e a desliga quando a varredura termina.
  const rodando = qc.getQueryData<PainelObrigacoes>([CHAVE_FILA, url])?.sync.rodando ?? false;
  const res = useConsulta<PainelObrigacoes>(CHAVE_FILA, url, {
    refetchInterval: rodando ? RECARGA_RODANDO : false,
  });
  const dados = res.data;
  const fresco = dados && !res.isPlaceholderData ? dados : undefined;

  const restoResp = qsFiltrosFila({ ...filtros, respId: null, respNome: null });
  const restoObrig = qsFiltrosFila({ ...filtros, obrigacao: null });
  useEffect(() => {
    if (!fresco) return;
    if (filtros.respId == null && fresco.responsaveis)
      setLembrancaResp({ escopo, resto: restoResp, itens: fresco.responsaveis });
    if (!filtros.obrigacao && fresco.obrigacoes)
      setLembrancaObrig({ escopo, resto: restoObrig, itens: fresco.obrigacoes });
  }, [fresco, filtros.respId, filtros.obrigacao, escopo, restoResp, restoObrig, setLembrancaResp, setLembrancaObrig]);

  const opcoesResp: OpcaoResponsavelFila[] | null | undefined = opcoesLembradas(
    dados?.responsaveis,
    lembrancaResp,
    filtros.respId != null,
    escopo,
    restoResp
  );
  const opcoesObrig: OpcaoObrigacaoFila[] | null | undefined = opcoesLembradas(
    dados?.obrigacoes,
    lembrancaObrig,
    !!filtros.obrigacao,
    escopo,
    restoObrig
  );

  const tentar = () => void res.refetch();
  const consultaAoVivo = (
    <ConsultaDaFila key={empresaTopo ?? "sem-empresa"} secao={secao} empresaTopo={empresaTopo} comSetor={comSetor} />
  );
  const acoes = (
    <AcoesPagina>
      <MenuExportar
        modulo="obrigacoes"
        desabilitado={!dados?.sync.concluidoEm}
        cortes={dados?.sync.concluidoEm ? cortesDaFila(secao, dados) : []}
      />
    </AcoesPagina>
  );

  if (res.isError && !dados)
    return (
      <>
        {acoes}
        <PainelErro titulo="Não deu para carregar a fila" mensagem={(res.error as Error).message} onTentar={tentar} />
        {consultaAoVivo}
      </>
    );

  if (!dados)
    return (
      <>
        {acoes}
        <Esqueleto className="h-4 w-80 max-w-full" />
        <FaixaFila carregando />
        <Painel corpo="p-0" titulo="Entregas na Fila" descricao="Lendo o retrato do Acessórias">
          <EsqueletoTabela colunas={7} />
        </Painel>
      </>
    );

  const { sync, setores, responsaveis, obrigacoes, fila } = dados;

  // Nunca varreu: zero entregas aqui quer dizer "ninguém perguntou ainda", e a
  // tela não pode deixar isso passar por escritório em dia.
  if (!sync.concluidoEm)
    return (
      <>
        {acoes}
        <FilaNaoCarregada rodando={sync.rodando} podeConfigurar={podeConfigurar} />
        {consultaAoVivo}
      </>
    );

  const marcados = filtrosMarcados(filtros);
  const limpar = () => setFiltros(FILTROS_FILA_VAZIOS);
  // Fila vazia de verdade: um aviso só no lugar de quatro painéis vazios.
  const nada = dados.total === 0 && fila != null && fila.length === 0;

  let vazio: ReactNode;
  if (marcados.length)
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhuma entrega com esses filtros"
        descricao={`Afrouxe ${listaOu(marcados)}${recortadoNoTopo ? ", ou mude a empresa no topo" : ""}.`}
        acao={
          <Botao icone="fechar" onClick={limpar}>
            Limpar filtros
          </Botao>
        }
      />
    );
  else if (recortadoNoTopo)
    vazio = (
      <Vazio
        icone="ok"
        titulo="Nada pendente"
        descricao={
          empresaTopo != null
            ? "A empresa escolhida no topo não tem entrega em aberto nesta seção."
            : "As empresas escolhidas no topo não têm entrega em aberto nesta seção."
        }
      />
    );
  else
    vazio = (
      <Vazio icone="ok" titulo="Nada pendente" descricao="O retrato do Acessórias não tem entrega em aberto nesta seção." />
    );

  const mostrarSetores = setores ? setores.length > 1 : comSetor;
  const alternarResp = (r: ResponsavelFila) =>
    setFiltros(
      filtros.respId === r.respId
        ? { ...filtros, respId: null, respNome: null }
        : { ...filtros, respId: r.respId, respNome: r.respNome }
    );
  const alternarObrig = (o: ObrigacaoFila) =>
    setFiltros({ ...filtros, obrigacao: filtros.obrigacao === o.obrigacao ? null : o.obrigacao });

  return (
    <>
      {acoes}

      {res.isError && (
        <PainelErro titulo="Não deu para atualizar a fila" mensagem={(res.error as Error).message} onTentar={tentar} />
      )}

      <div className="flex flex-col gap-3">
        <RetratoFila sync={sync} />
        <BarraFiltrosFila valor={filtros} onMudar={setFiltros} responsaveis={opcoesResp} obrigacoes={opcoesObrig} />
      </div>

      <FaixaFila dados={dados} recorte={filtros.recorte} onRecorte={(recorte) => setFiltros({ ...filtros, recorte })} />

      {consultaAoVivo}

      {nada ? (
        <Painel corpo="p-0">{vazio}</Painel>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <Painel corpo="p-0" titulo="Por Responsável" descricao="Mais vencidas primeiro. Clique para filtrar a fila.">
              {responsaveis ? (
                <TabelaResponsaveisFila itens={responsaveis} respId={filtros.respId} onFiltrar={alternarResp} />
              ) : (
                <ErroDoPainel onTentar={tentar} />
              )}
            </Painel>
            <div className="flex min-w-0 flex-col gap-4">
              {mostrarSetores && (
                <Painel corpo="p-0" titulo="Por Setor">
                  {setores ? <TabelaSetoresFila itens={setores} /> : <ErroDoPainel onTentar={tentar} />}
                </Painel>
              )}
              <Painel corpo="p-0" titulo="Por Obrigação" descricao="As 20 com mais entregas. Clique para filtrar a fila.">
                {obrigacoes ? (
                  <TabelaObrigacoesFila
                    itens={obrigacoes}
                    obrigacao={filtros.obrigacao}
                    onFiltrar={alternarObrig}
                    alturaMax={mostrarSetores ? "15rem" : "24rem"}
                  />
                ) : (
                  <ErroDoPainel onTentar={tentar} />
                )}
              </Painel>
            </div>
          </div>

          <Painel
            corpo="p-0"
            titulo="Entregas na Fila"
            descricao={
              <span className="inline-flex items-center gap-1.5">
                Do prazo mais antigo para o mais novo
                {res.isFetching && <Girando />}
              </span>
            }
            rodape={
              fila && fila.length >= TETO_FILA ? (
                <Nota>
                  São as {num(TETO_FILA)} de prazo mais antigo
                  {dados.total > fila.length ? `, de ${num(dados.total)} na fila` : ""}. Os filtros reduzem a lista.
                </Nota>
              ) : undefined
            }
          >
            {fila ? (
              <TabelaEntregasFila
                itens={fila}
                comSetor={comSetor}
                onAbrir={setAberta}
                aberta={aberta?.entId}
                vazio={vazio}
              />
            ) : (
              <ErroDoPainel onTentar={tentar} />
            )}
          </Painel>
        </>
      )}

      <ModalEntregaFila
        key={aberta?.entId ?? "nenhuma"}
        entrega={aberta}
        secao={secao}
        comSetor={comSetor}
        onFechar={() => setAberta(null)}
      />
    </>
  );
}
