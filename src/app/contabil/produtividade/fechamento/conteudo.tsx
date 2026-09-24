"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna, type Ordem } from "@/componentes/primitivos/tabela";
import {
  FitaCompetencias,
  LegendaFechamento,
  SeloFechamento,
  SITUACOES_FECHAMENTO,
} from "@/componentes/produto/contabil/fechamento";
import { CaixaGrafico, Legenda } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { GraficoPeriodo } from "@/componentes/produto/produtividade/serie-periodo";
import { dataHoraBR, documento, mesBR, num, pct } from "@/lib/format";
import { pctBR } from "@/lib/prod-formato";
import type {
  ContabilFechamentoResp,
  CtbFechamentoAnalista,
  CtbFechamentoEmpresa,
  SituacaoFechamento,
} from "@/lib/contabil-fechamento-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import {
  FiltroAnalista,
  FiltroGrupoAcessorias,
  qsFechamento,
  useEstadoCarteira,
  useFiltrosFechamento,
} from "./filtros";
import { PainelAcessorias } from "./painel-acessorias";

const POR_PAGINA = 50;

/** Situação na referência: a última da fita. */
const situacaoRef = (e: CtbFechamentoEmpresa): SituacaoFechamento =>
  e.situacoes[e.situacoes.length - 1] ?? "sem-movimento";

/** Ordem de urgência, para ordenar pela situação: o que pede ação primeiro. */
const URGENCIA: Record<SituacaoFechamento, number> = { aberta: 0, "sem-par": 1, fechada: 2, "sem-movimento": 3 };

const mesesAtras = (n: number) => `${num(n)} ${n === 1 ? "mês" : "meses"} atrás`;

function comparar(a: number | string, b: number | string): number {
  // Sem subtração: "nunca fechou" é infinito, e infinito menos infinito é NaN.
  if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

const COLUNAS_ANALISTA: Coluna<CtbFechamentoAnalista>[] = [
  { id: "nome", cabecalho: "Analista", ordenar: (a) => a.nome, celula: (a) => <span className="block truncate text-tinta">{a.nome}</span> },
  { id: "carteira", cabecalho: "Carteira", alinhar: "dir", largura: "88px", ordenar: (a) => a.carteira, celula: (a) => num(a.carteira) },
  { id: "fechadas", cabecalho: "Fechadas", alinhar: "dir", largura: "88px", ordenar: (a) => a.fechadas, celula: (a) => num(a.fechadas) },
  {
    id: "abertas",
    cabecalho: "Em aberto",
    alinhar: "dir",
    largura: "92px",
    ordenar: (a) => a.abertas,
    celula: (a) => <span className={a.abertas > 0 ? "font-[600] text-atencao" : "text-apagado"}>{num(a.abertas)}</span>,
  },
  {
    id: "semMovimento",
    cabecalho: "Sem movimento",
    alinhar: "dir",
    largura: "116px",
    secundaria: true,
    ordenar: (a) => a.semMovimento,
    celula: (a) => num(a.semMovimento),
  },
  {
    id: "pct",
    cabecalho: "Fechado",
    alinhar: "dir",
    largura: "92px",
    ordenar: (a) => a.pct,
    celula: (a) => <Selo tom={a.pct >= 0.9 ? "ok" : a.pct >= 0.5 ? "rota" : "atencao"}>{pct(a.pct * 100)}</Selo>,
  },
];

/**
 * Fechamento: quais empresas tiveram a competência apurada, e de quem elas
 * são. As outras abas medem o que o time PRODUZIU; esta mede o que ele
 * TERMINOU. Fechar o mês é apurar o resultado, e isso deixa um rastro único no
 * Questor: o lançamento na conta de Encerramento do Exercício. Sem ele a empresa
 * pode ter mil lançamentos e não estar fechada.
 *
 * É a única tela que cruza duas fontes: o marcador vem do Questor, o analista
 * responsável vem da carteira do Acessórias (o ERP não sabe de quem é a
 * empresa). Analista e grupo recortam a aba INTEIRA, e por isso ficam no
 * cabeçalho, não sobre a tabela: lá pareceria que só a lista obedece.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const { grupos, analistas, setGrupos, setAnalistas } = useFiltrosFechamento();
  const consulta = useConsulta<ContabilFechamentoResp>(
    "contabil-fechamento",
    qs == null ? null : `/api/contabil/produtividade-fechamento?${qsFechamento(qs, grupos, analistas)}`
  );
  const carteira = useEstadoCarteira();
  const d = consulta.data;
  const carregando = !d;

  const [busca, setBusca] = useEstadoTela("fechamento-busca", "");
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<CtbFechamentoEmpresa | null>(null);

  const colunas = useMemo<Coluna<CtbFechamentoEmpresa>[]>(() => {
    const ref = d?.referencia;
    return [
      {
        id: "empresa",
        cabecalho: "Empresa",
        ordenar: (e) => e.nome,
        celula: (e) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-tinta">{e.nome}</span>
            {e.grupos.length > 0 && <span className="truncate text-micro text-apagado">{e.grupos.join(" · ")}</span>}
          </span>
        ),
      },
      {
        id: "analista",
        cabecalho: "Analista",
        largura: "180px",
        ordenar: (e) => e.analista ?? "",
        celula: (e) => <span className="block truncate">{e.analista ?? "—"}</span>,
      },
      {
        id: "situacao",
        cabecalho: ref ? mesBR(ref) : "Situação",
        largura: "132px",
        ordenar: (e) => URGENCIA[situacaoRef(e)],
        celula: (e) => <SeloFechamento situacao={situacaoRef(e)} />,
      },
      {
        id: "fita",
        cabecalho: "Competências",
        largura: d ? `${Math.max(120, d.meses.length * 34)}px` : undefined,
        secundaria: true,
        celula: (e) => <FitaCompetencias meses={d?.meses ?? []} situacoes={e.situacoes} referencia={ref} />,
      },
      {
        id: "ate",
        cabecalho: "Fechada até",
        largura: "160px",
        ordenar: (e) => e.mesesAtras ?? Number.POSITIVE_INFINITY,
        celula: (e) =>
          e.ultimaCompetencia ? (
            <span className="num">
              {mesBR(e.ultimaCompetencia)}
              {e.mesesAtras ? <span className="ml-1.5 text-pequeno text-apagado">{mesesAtras(e.mesesAtras)}</span> : null}
            </span>
          ) : (
            <span className="text-apagado">Nunca</span>
          ),
      },
      {
        id: "quem",
        cabecalho: "Quem fechou",
        largura: "170px",
        secundaria: true,
        ordenar: (e) => e.fechadoPor ?? "",
        celula: (e) => <span className="block truncate">{e.fechadoPor ?? "—"}</span>,
      },
    ];
  }, [d]);

  const filtradas = useMemo(() => {
    const t = normalizar(busca.trim());
    const lista = (d?.empresas ?? []).filter(
      (e) =>
        !t ||
        normalizar(`${e.nome} ${e.cnpj} ${e.codigo ?? ""} ${e.analista ?? ""} ${e.grupos.join(" ")}`).includes(t)
    );
    const col = colunas.find((c) => c.id === ordem?.coluna);
    // Sem ordem escolhida vale a do servidor: em aberto primeiro, das mais
    // atrasadas para as menos, que é o que precisa de ação.
    if (!ordem || !col?.ordenar) return lista;
    const f = col.ordenar;
    const s = ordem.sentido === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => s * comparar(f(a) ?? "", f(b) ?? ""));
  }, [d, busca, colunas, ordem]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);

  const porMes = useMemo(
    () => (d?.porMes ?? []).map((m) => ({ bucket: m.mes, fechadas: m.fechadas, abertas: m.abertas })),
    [d]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const ref = d.referencia.slice(0, 7);
    const rotulo = (s: SituacaoFechamento) => SITUACOES_FECHAMENTO[s].rotulo;
    return [
      {
        id: "empresas",
        rotulo: "Empresas da carteira",
        nome: `fechamento-contabil-${ref}`,
        montar: () => ({
          cabecalhos: [
            "CNPJ", "Empresa", "Grupo do Acessórias", "Código Questor", "Analista", `Situação ${ref}`, "Fechada até",
            "Competências atrás", "Registro", "Quem fechou",
          ],
          linhas: d.empresas.map((e) => [
            e.cnpj,
            e.nome,
            e.grupos.join(" · "),
            e.codigo ?? "",
            e.analista ?? "",
            rotulo(situacaoRef(e)),
            e.ultimaCompetencia?.slice(0, 7) ?? "nunca",
            e.mesesAtras ?? "",
            e.registradoEm ? dataHoraBR(e.registradoEm) : "",
            e.fechadoPor ?? "",
          ]),
        }),
      },
      {
        id: "abertas",
        rotulo: "Só as em aberto",
        nome: `fechamento-contabil-em-aberto-${ref}`,
        montar: () => ({
          cabecalhos: ["CNPJ", "Empresa", "Grupo do Acessórias", "Analista", "Fechada até", "Competências atrás"],
          linhas: d.empresas
            .filter((e) => situacaoRef(e) === "aberta")
            .map((e) => [
              e.cnpj,
              e.nome,
              e.grupos.join(" · "),
              e.analista ?? "",
              e.ultimaCompetencia?.slice(0, 7) ?? "nunca",
              e.mesesAtras ?? "",
            ]),
        }),
      },
      {
        id: "analistas",
        rotulo: "Por analista",
        nome: `fechamento-contabil-analistas-${ref}`,
        montar: () => ({
          cabecalhos: ["Analista", "Carteira", "Fechadas", "Em aberto", "Sem movimento", "Fechado (%)"],
          linhas: d.porAnalista.map((a) => [
            a.nome,
            a.carteira,
            a.fechadas,
            a.abertas,
            a.semMovimento,
            pctBR(a.pct * 100),
          ]),
        }),
      },
    ];
  }, [d]);

  const acoes = (
    <AcoesPagina>
      <FiltroAnalista valor={analistas} onMudar={setAnalistas} />
      <FiltroGrupoAcessorias valor={grupos} onMudar={setGrupos} />
      <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (consulta.isError)
    return (
      <>
        {acoes}
        <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />
      </>
    );

  const semCarteira = !!d && d.carteira.empresas === 0;
  if (semCarteira)
    return (
      <>
        {acoes}
        <PainelAcessorias semCarteira />
      </>
    );

  // O que o recorte da aba deixa de pé. Sai das contagens do servidor, e não do
  // tamanho da tabela, para bater com os indicadores mesmo com a lista paginada.
  const recortada = grupos.length > 0 || analistas.length > 0;
  const visiveis = d ? d.carteira.empresas - d.carteira.foraDoEscopo : 0;
  const noRecorte = d ? visiveis - d.carteira.foraDoGrupo - d.carteira.foraDoAnalista : 0;
  const ref = d ? mesBR(d.referencia) : "";
  const atualizada = carteira.data?.atualizadoEm ?? d?.carteira.atualizadoEm ?? null;

  return (
    <>
      {acoes}

      {d && (recortada || d.naoEncerradas.length > 0) && (
        <div className="flex flex-col gap-1">
          {recortada && (
            <Nota icone="filtrar">
              {num(noRecorte)} de {num(visiveis)} empresas da carteira entram no recorte. Todos os números abaixo falam só
              delas.
            </Nota>
          )}
          {d.naoEncerradas.length > 0 && (
            <Nota icone="info">
              Números de {ref}, a última competência encerrada. {d.naoEncerradas.map(mesBR).join(", ")}{" "}
              {d.naoEncerradas.length === 1 ? "ainda não encerrou" : "ainda não encerraram"} e{" "}
              {d.naoEncerradas.length === 1 ? "aparece" : "aparecem"} só na fita: o fechamento é lançado no mês
              seguinte.
            </Nota>
          )}
        </div>
      )}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo={d ? `Fechadas em ${ref}` : "Fechadas"}
          icone="ok"
          carregando={carregando}
          valor={num(d?.totais.fechadas ?? 0)}
          detalhe={`${pct((d?.totais.pct ?? 0) * 100)} da carteira medida (${num(d?.totais.carteira ?? 0)})`}
        />
        <Indicador
          rotulo="Em aberto"
          icone="pendente"
          carregando={carregando}
          valor={num(d?.totais.abertas ?? 0)}
          detalhe="Escrituraram e ninguém apurou"
          tom={(d?.totais.abertas ?? 0) > 0 ? "atencao" : "neutro"}
          valorNoTom
        />
        {/* Com recorte, o indicador fala do recorte como os vizinhos: a carteira
            inteira ao lado dos números de um analista só pareceria a dele. */}
        <Indicador
          rotulo={recortada ? "Carteira no recorte" : "Carteira do Contábil"}
          icone="empresa"
          carregando={carregando}
          valor={num(recortada ? noRecorte : (d?.carteira.empresas ?? 0))}
          detalhe={
            recortada
              ? `De ${num(visiveis)} · ${num(d?.carteira.semPar ?? 0)} sem par no Questor`
              : `${num(d?.carteira.semPar ?? 0)} sem par no Questor · ${num(d?.carteira.foraDoEscopo ?? 0)} fora do seu escopo`
          }
        />
        <Indicador
          rotulo="Sem movimento"
          icone="ignorado"
          carregando={carregando}
          valor={num(d?.totais.semMovimento ?? 0)}
          detalhe="Nada escriturado, nada a apurar"
        />
        <Indicador
          rotulo="Nunca fecharam"
          icone="alerta"
          carregando={carregando}
          valor={num(d?.totais.nuncaFecharam ?? 0)}
          detalhe="Escrituram e nunca tiveram apuração"
          tom={(d?.totais.nuncaFecharam ?? 0) > 0 ? "perigo" : "neutro"}
          valorNoTom
        />
      </FaixaIndicadores>

      <Nota>
        Fechada é a competência com lançamento na conta de Encerramento do Exercício. O analista vem da carteira do
        Acessórias{atualizada ? `, atualizada em ${dataHoraBR(atualizada)}` : ", que ainda não foi buscada"}.
      </Nota>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Painel
          titulo="Por analista"
          descricao={d ? `Responsável pelo setor Contábil no Acessórias, em ${ref}` : "Responsável pelo setor Contábil"}
          corpo="p-0"
          rodape={<Nota>Os nomes vêm como estão no Acessórias, marcadores de fluxo inclusive.</Nota>}
        >
          {carregando ? (
            <EsqueletoTabela linhas={6} colunas={5} />
          ) : (
            <TabelaDados
              colunas={COLUNAS_ANALISTA}
              linhas={d.porAnalista}
              chave={(a) => a.nome}
              alturaMax="420px"
              rotulo="Fechamento por analista"
              vazio={<p className="py-10 text-center text-corpo text-apagado italic">Nenhum analista no recorte.</p>}
            />
          )}
        </Painel>
        <CaixaGrafico
          titulo="Por competência"
          descricao="Empresas fechadas e em aberto em cada mês do período"
          carregando={carregando}
          vazio={porMes.length === 0 || porMes.every((m) => m.fechadas + m.abertas === 0) ? "Nada para medir no período." : false}
          legenda={
            <Legenda
              itens={[
                { rotulo: "Fechadas", cor: "var(--ok)" },
                { rotulo: "Em aberto", cor: "var(--atencao)" },
              ]}
            />
          }
        >
          <GraficoPeriodo
            pontos={porMes}
            granularidade="mes"
            series={[
              { chave: "fechadas", rotulo: "Fechadas", cor: "var(--ok)", tipo: "barra", pilha: "s" },
              { chave: "abertas", rotulo: "Em aberto", cor: "var(--atencao)", tipo: "barra", pilha: "s" },
            ]}
          />
        </CaixaGrafico>
      </div>

      <Painel
        titulo="Empresas"
        descricao="Em aberto primeiro, das mais atrasadas para as menos"
        corpo="p-0"
        acoes={
          <>
            <LegendaFechamento className="max-[900px]:hidden" />
            <Campo
              icone="buscar"
              placeholder="Empresa, CNPJ, analista ou grupo"
              classeCaixa="w-64"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </>
        }
        rodape={
          carregando ? undefined : (
            <Paginacao pagina={atual} porPagina={POR_PAGINA} total={filtradas.length} onPagina={setPagina} />
          )
        }
      >
        {carregando ? (
          <EsqueletoTabela linhas={10} colunas={6} />
        ) : (
          <TabelaDados
            colunas={colunas}
            linhas={filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)}
            chave={(e) => e.cnpj}
            ordem={ordem}
            onOrdem={(o) => {
              setOrdem(o);
              setPagina(1);
            }}
            onLinha={setAberta}
            rotulo="Empresas da carteira"
            vazio={
              <p className="py-10 text-center text-corpo text-apagado italic">
                {busca ? "Nenhuma empresa com essa busca. Tente parte do nome ou o CNPJ." : "Nenhuma empresa no recorte."}
              </p>
            }
          />
        )}
      </Painel>

      <PainelAcessorias semCarteira={false} />

      <Modal
        aberto={aberta != null}
        onFechar={() => setAberta(null)}
        largura="g"
        titulo={aberta?.nome ?? ""}
        descricao={aberta ? <span className="num">{documento(aberta.cnpj)}</span> : undefined}
        rodape={<Botao onClick={() => setAberta(null)}>Fechar</Botao>}
      >
        {aberta && d && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Par rotulo={`Situação em ${ref}`}>
                <SeloFechamento situacao={situacaoRef(aberta)} />
              </Par>
              <Par rotulo="Fechada até">
                <span className="num">
                  {aberta.ultimaCompetencia ? mesBR(aberta.ultimaCompetencia) : "Nunca fechou"}
                  {aberta.mesesAtras ? <span className="ml-1.5 text-pequeno text-apagado">{mesesAtras(aberta.mesesAtras)}</span> : null}
                </span>
              </Par>
              <Par rotulo="Registro do fechamento">
                <span className="num">{aberta.registradoEm ? dataHoraBR(aberta.registradoEm) : "—"}</span>
              </Par>
              <Par rotulo="Quem fechou">{aberta.fechadoPor ?? "—"}</Par>
              <Par rotulo="Analista">{aberta.analista ?? "Sem responsável"}</Par>
              <Par rotulo="Código no Questor">
                <span className="num">{aberta.codigo ?? "Sem par"}</span>
              </Par>
              <Par rotulo="Grupo do Acessórias" className="col-span-2">
                {aberta.grupos.length ? aberta.grupos.join(" · ") : "Nenhum"}
              </Par>
            </dl>
            <section className="flex flex-col gap-2">
              <h3 className="text-pequeno font-[600] text-tinta-2">Competências do período</h3>
              <FitaCompetencias meses={d.meses} situacoes={aberta.situacoes} referencia={d.referencia} />
              <LegendaFechamento />
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
