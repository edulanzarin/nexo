"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { CabecalhoPapel } from "@/componentes/produto/cabecalho-papel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { ModalFichaRh } from "@/componentes/produto/rh/ficha-edicao-rh";
import { buscarJson, useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { decimalBR } from "@/lib/csv";
import { FOLHA_SELECAO_VAZIA } from "@/lib/folha-filtros";
import { dataBR, deltaPct, mesBR, num, pct } from "@/lib/format";
import type {
  FolhaFiltros,
  FolhaMovimentacao,
  TurnoverContagem,
  TurnoverGrupo,
  TurnoverResp,
} from "@/lib/types";
import { COR_MOVIMENTO } from "./cores";
import { ModalFicha, type ModuloPessoal } from "./ficha-funcionario";
import { FaixaFiltrosPessoal, resumoFiltros, useSelecaoPessoal } from "./filtros-pessoal";
import { ModalPessoas, type DimensaoDrill, type Drill } from "./modal-pessoas";
import { PainelMovimentacoes, vistaEhEfetivo, type VistaPessoas } from "./painel-movimentacoes";
import { PainelQuebraTurnover, pctTurnover } from "./quebra-turnover";
import { SerieTurnover } from "./serie-turnover";
import { emAnos } from "./tempo-casa";

type ChaveQuebra =
  | "organogramas"
  | "cargos"
  | "horarios"
  | "faixaEtaria"
  | "estabelecimentos"
  | "sexo"
  | "escolaridade"
  | "estadoCivil";

/**
 * As quebras da tela, na ordem em que aparecem. A rota chama o setor de
 * "organograma" (a tabela do Questor); na tela ele é "Setor", o mesmo nome do
 * filtro e da ficha, para a pessoa não achar que são duas coisas.
 */
const QUEBRAS: { chave: ChaveQuebra; dim: DimensaoDrill; titulo: string; coluna: string; compacto?: boolean }[] = [
  { chave: "organogramas", dim: "setor", titulo: "Turnover por Setor", coluna: "Setor" },
  { chave: "cargos", dim: "cargo", titulo: "Turnover por Cargo", coluna: "Cargo" },
  { chave: "horarios", dim: "horario", titulo: "Turnover por Horário", coluna: "Horário" },
  { chave: "faixaEtaria", dim: "faixaEtaria", titulo: "Turnover por Faixa Etária", coluna: "Faixa etária", compacto: true },
  { chave: "estabelecimentos", dim: "estab", titulo: "Turnover por Estabelecimento", coluna: "Estabelecimento", compacto: true },
  { chave: "sexo", dim: "sexo", titulo: "Turnover por Sexo", coluna: "Sexo", compacto: true },
  { chave: "escolaridade", dim: "escolaridade", titulo: "Turnover por Escolaridade", coluna: "Escolaridade", compacto: true },
  { chave: "estadoCivil", dim: "estadoCivil", titulo: "Turnover por Estado Civil", coluna: "Estado civil", compacto: true },
];

/** Contagem de desligados (motivo, tempo de casa) em barras, com o peso de cada uma. */
function itensContagem(lista: TurnoverContagem[] | undefined): ItemQuebra[] | undefined {
  if (!lista) return undefined;
  const total = lista.reduce((s, c) => s + c.valor, 0);
  return lista.map((c) => ({
    chave: c.rotulo,
    nome: c.rotulo,
    qtd: c.valor,
    detalhe: total > 0 ? pct((c.valor / total) * 100) : undefined,
  }));
}

/**
 * O número contra o período anterior de mesmo tamanho. A cor diz se andou para
 * o lado bom; admissão não tem lado bom (contratar pode ser crescer ou repor),
 * então a variação dela sai sem cor.
 */
function Comparado({
  atual,
  anterior,
  formatar = num,
  bomQuandoSobe = true,
  neutro,
}: {
  atual: number;
  anterior: number;
  formatar?: (v: number) => string;
  bomQuandoSobe?: boolean;
  neutro?: boolean;
}) {
  return (
    <>
      {deltaPct(atual, anterior) != null && (
        <>
          <Variacao atual={atual} anterior={anterior} bomQuandoSobe={bomQuandoSobe} neutra={neutro} />
          {" · "}
        </>
      )}
      anterior {formatar(anterior)}
    </>
  );
}

const situacaoCsv = (m: FolhaMovimentacao) =>
  m.admitido && m.desligado ? "Admitido e desligado" : m.admitido ? "Admitido" : m.desligado ? "Desligado" : "Ativo";

const CABECALHOS_PESSOAS = [
  "Empresa",
  "Contrato",
  "Nome",
  "Situação",
  "Cargo",
  "Setor",
  "Admissão",
  "Desligamento",
  "Motivo do desligamento",
  "Tempo de casa (dias)",
];

const linhaPessoaCsv = (m: FolhaMovimentacao) => [
  m.codigoempresa,
  m.contrato,
  m.nome,
  situacaoCsv(m),
  m.cargo,
  m.setor,
  m.dataadm ? dataBR(m.dataadm) : "",
  m.datadem ? dataBR(m.datadem) : "",
  m.motivo ?? "",
  m.tempoCasaDias ?? "",
];

/**
 * A Rotatividade, montada uma vez para os dois módulos que a têm. O DP roda uma
 * empresa cliente por vez, com a empresa do contexto do topo; o RH roda as
 * empresas da própria Navecon, com a escolha dentro da tela (`topo`). O resto é
 * igual: quem entrou e saiu no período sobre o efetivo, contra o período
 * anterior, e onde a troca se concentra. Cada módulo lê as suas rotas
 * (`/api/<modulo>/*`), e é nelas que mora o escopo de empresa de cada um.
 *
 * Os filtros da faixa recortam a tela inteira e valem só para a `chaveSelecao`
 * em que foram escolhidos (a empresa): trocar de empresa limpa a seleção.
 *
 * Todo número leva a pessoas: a barra do motivo, a linha da quebra e a lista de
 * movimentações abrem quem está por trás, e cada pessoa abre a ficha.
 */
export function TelaRotatividade({
  modulo,
  qs,
  empresa,
  chaveSelecao,
  arquivo,
  topo,
  rotuloTotal = "Total da empresa",
  vazio,
}: {
  modulo: ModuloPessoal;
  /** O recorte executado (período e empresas), sem os filtros da faixa. */
  qs: string | null;
  /** De quem é o papel: a empresa, ou o nome do conjunto quando são várias. */
  empresa: { codigo?: number | null; nome: string };
  /** A seleção de filtros vale só para esta chave. */
  chaveSelecao: string | null;
  /** Como a empresa entra no nome dos arquivos exportados. */
  arquivo: string;
  /** O que vai acima da faixa de filtros (o seletor de empresa do RH). */
  topo?: ReactNode;
  rotuloTotal?: string;
  /** Descrição do vazio sem filtro: diz onde conferir o recorte. */
  vazio: string;
}) {
  const p = new URLSearchParams(qs ?? "");
  const inicio = p.get("inicio") ?? "";
  const fim = p.get("fim") ?? "";
  const qc = useQueryClient();
  const api = `/api/${modulo}`;

  const { sel, mudar, filtrada, qs: qsSel } = useSelecaoPessoal(chaveSelecao);
  // A seleção entra na query junto do recorte executado: filtrar aplica na
  // hora, sem Executar de novo.
  const qsTela = qs == null ? null : `${qs}${qsSel}`;

  // As opções vêm sem a seleção: a lista não encolhe conforme se marca.
  const opcoes = useConsulta<FolhaFiltros>(`${modulo}-filtros`, qs == null ? null : `${api}/filtros?${qs}`);
  const turnover = useConsulta<TurnoverResp>(`${modulo}-turnover`, qsTela == null ? null : `${api}/turnover?${qsTela}`);

  const [vista, setVista] = useEstadoTela<VistaPessoas>("vista-pessoas", "todos");
  const urlMov = (efetivo: boolean) =>
    qsTela == null ? null : `${api}/movimentacoes?${qsTela}${efetivo ? "&escopo=efetivo" : ""}`;
  // Sem reserva: trocar de movimentações para efetivo com a lista anterior na
  // tela, mesmo por um instante, mostraria desligados como efetivo.
  const movimentos = useConsulta<FolhaMovimentacao[]>(`${modulo}-movimentacoes`, urlMov(vistaEhEfetivo(vista)), {
    manterAnterior: false,
  });

  const [aberta, setAberta] = useState<FolhaMovimentacao | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);

  const d = turnover.data;
  const c = d?.consolidado;
  const a = d?.anterior;
  const carregando = !d;
  const variosMeses = inicio.slice(0, 7) !== fim.slice(0, 7);

  const motivos = useMemo(() => itensContagem(d?.motivos), [d]);
  const tenure = useMemo(() => itensContagem(d?.tenure), [d]);

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d || qsTela == null) return [];
    const k = d.consolidado;
    const sufixo = `${arquivo}-${inicio}_${fim}${filtrada ? "-filtrado" : ""}`;
    const pessoas =
      (efetivo: boolean) =>
      async () => {
        const url = `${api}/movimentacoes?${qsTela}${efetivo ? "&escopo=efetivo" : ""}`;
        // A mesma chave da lista na tela: se ela já veio, o arquivo sai do cache.
        const linhas = await qc.ensureQueryData({
          queryKey: [`${modulo}-movimentacoes`, url],
          queryFn: () => buscarJson<FolhaMovimentacao[]>(url),
        });
        return { cabecalhos: CABECALHOS_PESSOAS, linhas: linhas.map(linhaPessoaCsv) };
      };
    const contagem = (lista: TurnoverContagem[], rotulo: string) => () => {
      const total = lista.reduce((s, x) => s + x.valor, 0);
      return {
        cabecalhos: [rotulo, "Desligamentos", "% dos desligamentos"],
        linhas: lista.map((x) => [x.rotulo, x.valor, decimalBR(total > 0 ? (x.valor / total) * 100 : 0)]),
      };
    };
    const lista: CorteExportar[] = [
      {
        id: "resumo",
        rotulo: "Números do período",
        nome: `rotatividade-resumo-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Indicador", "Período", "Período anterior"],
          linhas: [
            ["Turnover (%)", decimalBR(k.turnover), decimalBR(d.anterior.turnover)],
            ["Admissões", k.admissoes, d.anterior.admissoes],
            ["Desligamentos", k.desligamentos, d.anterior.desligamentos],
            ["Ativos no fim do período", k.ativos, d.anterior.ativos],
            ["Saldo de pessoal", k.saldo, ""],
            ["Desligamentos voluntários", k.voluntarios, ""],
            ["Desligamentos involuntários", k.involuntarios, ""],
            ["Tempo médio de casa dos desligados (dias)", k.tempoMedioCasaDias ?? "", ""],
          ],
        }),
      },
    ];
    if (d.serie.length >= 2)
      lista.push({
        id: "serie",
        rotulo: "Mês a mês",
        nome: `rotatividade-mensal-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Mês", "Admissões", "Desligamentos", "Ativos no fim do mês", "Turnover (%)"],
          linhas: d.serie.map((s) => [mesBR(s.mes), s.admissoes, s.desligamentos, s.ativos, decimalBR(s.turnover)]),
        }),
      });
    lista.push(
      {
        id: "movimentacoes",
        rotulo: "Quem entrou e saiu",
        descricao: "Admitidos e desligados do período",
        nome: `rotatividade-movimentacoes-${sufixo}`,
        montar: pessoas(false),
      },
      {
        id: "efetivo",
        rotulo: "Efetivo no fim do período",
        nome: `rotatividade-efetivo-${sufixo}`,
        montar: pessoas(true),
      },
      {
        id: "motivos",
        rotulo: "Motivo do desligamento",
        nome: `rotatividade-motivos-${sufixo}`,
        montar: contagem(d.motivos, "Motivo"),
      },
      {
        id: "tempo-casa",
        rotulo: "Tempo de casa dos desligados",
        nome: `rotatividade-tempo-de-casa-${sufixo}`,
        montar: contagem(d.tenure, "Tempo de casa"),
      },
      {
        id: "quebras",
        rotulo: "Turnover por grupo",
        descricao: "Setor, cargo, horário e perfil num arquivo só",
        nome: `rotatividade-quebras-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Dimensão", "Grupo", "Ativos", "Admissões", "Desligamentos", "Turnover (%)"],
          linhas: QUEBRAS.flatMap((q) =>
            d[q.chave].map((g: TurnoverGrupo) => [
              q.coluna,
              g.grupo,
              g.ativos,
              g.admissoes,
              g.desligamentos,
              decimalBR(g.turnover),
            ])
          ),
        }),
      }
    );
    return lista;
  }, [d, qsTela, arquivo, inicio, fim, filtrada, qc, api, modulo]);

  const abrirGrupo = (dim: DimensaoDrill, rotulo: string) => (valor: string) => setDrill({ dim, valor, rotulo });

  const faixaFiltros = (
    <>
      {topo}
      <FaixaFiltrosPessoal
        opcoes={opcoes.data}
        sel={sel}
        onMudar={mudar}
        erro={opcoes.error ? (opcoes.error as Error).message : null}
        onTentar={() => opcoes.refetch()}
      />
    </>
  );

  const acoes = (
    <AcoesPagina>
      <MenuExportar modulo={modulo} cortes={cortes} imprimir="rotatividade" desabilitado={carregando} />
    </AcoesPagina>
  );

  if (turnover.error && !d)
    return (
      <>
        {acoes}
        {faixaFiltros}
        <PainelErro
          titulo="Não deu para calcular a rotatividade"
          mensagem={(turnover.error as Error).message}
          onTentar={() => turnover.refetch()}
        />
      </>
    );

  if (c && c.ativos + c.admissoes + c.desligamentos === 0)
    return (
      <>
        {acoes}
        {faixaFiltros}
        <div className="nx-vidro rounded-painel">
          {filtrada ? (
            <Vazio
              icone="filtrar"
              titulo="Ninguém neste recorte"
              descricao="Nenhum contrato ativo, admitido ou desligado com esses filtros. Tire algum da faixa acima."
              acao={
                <Botao variante="secundario" icone="fechar" onClick={() => mudar(FOLHA_SELECAO_VAZIA)}>
                  Limpar filtros
                </Botao>
              }
            />
          ) : (
            <Vazio icone="pessoas" titulo="Nenhum funcionário no período" descricao={vazio} />
          )}
        </div>
      </>
    );

  // Enquanto carrega, o detalhe é texto vazio: o indicador desenha o esqueleto
  // da linha, e a faixa não pula quando o número chega.
  const detalhe = (n: ReactNode) => (c && a ? n : "");
  const outros = c ? c.desligamentos - c.voluntarios - c.involuntarios : 0;
  const total = filtrada ? "Total do recorte" : rotuloTotal;

  return (
    <>
      {acoes}
      {faixaFiltros}

      <CabecalhoPapel
        titulo="Rotatividade"
        empresa={empresa}
        itens={[
          { rotulo: "Período", valor: `${dataBR(inicio)} a ${dataBR(fim)}` },
          ...(filtrada ? resumoFiltros(sel, opcoes.data) : [{ rotulo: "Filtros", valor: "Nenhum" }]),
        ]}
      />

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Turnover geral"
          icone="rotatividade"
          carregando={carregando}
          valor={c ? pctTurnover(c.turnover) : ""}
          detalhe={detalhe(
            c && a && <Comparado atual={c.turnover} anterior={a.turnover} formatar={pctTurnover} bomQuandoSobe={false} />
          )}
        />
        <Indicador
          rotulo="Admissões"
          icone="usuario"
          carregando={carregando}
          valor={c ? num(c.admissoes) : ""}
          detalhe={detalhe(c && a && <Comparado atual={c.admissoes} anterior={a.admissoes} neutro />)}
        />
        <Indicador
          rotulo="Desligamentos"
          icone="sair"
          carregando={carregando}
          valor={c ? num(c.desligamentos) : ""}
          detalhe={detalhe(
            c && a && <Comparado atual={c.desligamentos} anterior={a.desligamentos} bomQuandoSobe={false} />
          )}
        />
        <Indicador
          rotulo="Colaboradores ativos"
          icone="pessoas"
          carregando={carregando}
          valor={c ? num(c.ativos) : ""}
          detalhe={detalhe(c && a && <Comparado atual={c.ativos} anterior={a.ativos} />)}
        />
        <Indicador
          rotulo="Saldo de pessoal"
          icone="balanca"
          carregando={carregando}
          valor={c ? (c.saldo > 0 ? `+${num(c.saldo)}` : num(c.saldo)) : ""}
          tom={!c || c.saldo === 0 ? "neutro" : c.saldo > 0 ? "ok" : "perigo"}
          valorNoTom
          detalhe={detalhe("Admissões menos desligamentos")}
        />
        <Indicador
          rotulo="Desligamentos voluntários"
          icone="desfazer"
          carregando={carregando}
          valor={c ? num(c.voluntarios) : ""}
          detalhe={detalhe(
            c && c.desligamentos > 0
              ? `Iniciativa do funcionário · ${pct((c.voluntarios / c.desligamentos) * 100)}`
              : "Iniciativa do funcionário"
          )}
        />
        <Indicador
          rotulo="Desligamentos involuntários"
          icone="bloqueado"
          carregando={carregando}
          valor={c ? num(c.involuntarios) : ""}
          detalhe={detalhe(
            c && c.desligamentos > 0
              ? `Iniciativa da empresa · ${pct((c.involuntarios / c.desligamentos) * 100)}`
              : "Iniciativa da empresa"
          )}
        />
        <Indicador
          rotulo="Tempo médio de casa"
          icone="relogio"
          carregando={carregando}
          valor={c ? emAnos(c.tempoMedioCasaDias) : ""}
          detalhe={detalhe(c?.tempoMedioCasaDias != null ? "De quem saiu no período" : "Ninguém saiu no período")}
        />
      </FaixaIndicadores>

      <div className="flex flex-col gap-1">
        <Nota>
          Turnover é a média entre admissões e desligamentos sobre os ativos no fim do período, contando por contrato.
          Transferência entre estabelecimentos entra como um desligamento e uma admissão.
        </Nota>
        {outros > 0 && (
          <Nota>Fim de contrato, aposentadoria e falecimento não entram em voluntários nem involuntários.</Nota>
        )}
      </div>

      {variosMeses && <SerieTurnover pontos={d?.serie} carregando={carregando} className="print:break-inside-avoid" />}

      <PainelMovimentacoes
        vista={vista}
        onVista={setVista}
        linhas={movimentos.data}
        erro={movimentos.error ? (movimentos.error as Error).message : null}
        onTentar={() => movimentos.refetch()}
        contagens={c ? { admitidos: c.admissoes, desligados: c.desligamentos, efetivo: c.ativos } : undefined}
        onAbrir={setAberta}
        selecionada={(m) => aberta != null && m.contrato === aberta.contrato && m.codigoempresa === aberta.codigoempresa}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Motivo do Desligamento"
          descricao="Causa da rescisão de quem saiu no período"
          itens={motivos}
          carregando={carregando}
          corPadrao={COR_MOVIMENTO.desligamentos}
          vazio="Nenhum desligamento no período."
          aoClicar={(i) => abrirGrupo("motivo", "Motivo do desligamento")(i.chave)}
        />
        <PainelQuebra
          titulo="Tempo de Casa dos Desligados"
          descricao="Quanto tempo quem saiu ficou na empresa"
          itens={tenure}
          carregando={carregando}
          corPadrao={COR_MOVIMENTO.tempoCasa}
          vazio="Nenhum desligamento no período."
          aoClicar={(i) => abrirGrupo("tempoCasa", "Tempo de casa")(i.chave)}
        />
      </div>

      {QUEBRAS.filter((q) => !q.compacto).map((q) => (
        <PainelQuebraTurnover
          key={q.chave}
          titulo={q.titulo}
          rotuloColuna={q.coluna}
          grupos={d?.[q.chave]}
          total={c}
          rotuloTotal={total}
          carregando={carregando}
          onGrupo={(g) => abrirGrupo(q.dim, q.coluna)(g.grupo)}
          rodape={
            q.chave === "horarios" ? (
              <Nota>Horário é a jornada escrita no cadastro do funcionário; sem ela, o horário da escala.</Nota>
            ) : undefined
          }
        />
      ))}

      {/* Faixa etária ocupa a linha; as quatro menores fecham a grade em dois por dois. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {QUEBRAS.filter((q) => q.compacto).map((q) => (
          <PainelQuebraTurnover
            key={q.chave}
            className={q.chave === "faixaEtaria" ? "xl:col-span-2" : undefined}
            titulo={q.titulo}
            rotuloColuna={q.coluna}
            grupos={d?.[q.chave]}
            total={c}
            rotuloTotal={total}
            carregando={carregando}
            compacto
            onGrupo={(g) => abrirGrupo(q.dim, q.coluna)(g.grupo)}
          />
        ))}
      </div>

      {/* No RH a ficha corrige o cadastro (e-mail, cargo, setor), como no Diretório. */}
      {modulo === "rh" ? (
        <ModalFichaRh pessoa={aberta} onFechar={() => setAberta(null)} />
      ) : (
        <ModalFicha modulo={modulo} pessoa={aberta} onFechar={() => setAberta(null)} />
      )}
      <ModalPessoas modulo={modulo} qs={qs ?? ""} sel={sel} drill={drill} onFechar={() => setDrill(null)} />
    </>
  );
}
