"use client";

import { useEffect, useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, ComboMulti, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao, TabelaDados, type Coluna, type Ordem } from "@/componentes/primitivos/tabela";
import { DetalheNotaConferida } from "@/componentes/produto/contabil/detalhe-nota-conferida";
import { SITUACAO_NOTA, SeloSituacao } from "@/componentes/produto/contabil/situacao-nota";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { NumeroNota } from "@/componentes/produto/notas/detalhe-nota";
import { brl, brlCompact, dataBR, num, pct } from "@/lib/format";
import type { ConferenciaResp, ConfResumo, NotaConferida, SituacaoNota } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

type Tipo = "ent" | "sai";
type FiltroSituacao = "problema" | "todas" | SituacaoNota;
type OrdemServidor = "valor_desc" | "valor_asc" | "data_desc" | "data_asc" | "numero";

const SITUACOES: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "problema", rotulo: "Com problema" },
  { valor: "todas", rotulo: "Todas" },
  { valor: "pendente", rotulo: "Não contabilizadas" },
  { valor: "consolidada", rotulo: "Em bloco" },
  { valor: "divergente", rotulo: "Conta errada" },
  { valor: "duplicada", rotulo: "Duplicadas" },
  { valor: "ok", rotulo: "Corretas" },
  { valor: "nao_exige", rotulo: "Não exigem lançamento" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

function contagem(r: ConfResumo, s: FiltroSituacao): number {
  switch (s) {
    case "todas":
      return r.total;
    // "Com problema" é o que pede ação: sem lançamento, conta errada ou
    // lançada duas vezes. Em bloco não entra: a consolidação cobre a nota.
    case "problema":
      return r.pendentes + r.divergentes + r.duplicadas;
    case "pendente":
      return r.pendentes;
    case "consolidada":
      return r.consolidadas;
    case "divergente":
      return r.divergentes;
    case "duplicada":
      return r.duplicadas;
    case "ok":
      return r.conformes;
    case "nao_exige":
      return r.naoExigem;
    case "cancelada":
      return r.canceladas;
  }
}

/*
 * A ordem é do servidor: ele pagina de 100 em 100 depois de ordenar o período
 * inteiro, então ordenar a página no navegador mentiria sobre o conjunto. O
 * cabeçalho da tabela só traduz o clique para a ordem que a API conhece.
 */
function ordemDaTabela(o: OrdemServidor): Ordem {
  if (o === "valor_asc") return { coluna: "valor", sentido: "asc" };
  if (o === "data_desc") return { coluna: "data", sentido: "desc" };
  if (o === "data_asc") return { coluna: "data", sentido: "asc" };
  if (o === "numero") return { coluna: "nota", sentido: "asc" };
  return { coluna: "valor", sentido: "desc" };
}

function ordemDoServidor(o: Ordem): OrdemServidor {
  if (!o) return "valor_desc";
  // Número da nota só existe crescente na API.
  if (o.coluna === "nota") return "numero";
  if (o.coluna === "data") return o.sentido === "asc" ? "data_asc" : "data_desc";
  return o.sentido === "asc" ? "valor_asc" : "valor_desc";
}

function colunas(tipo: Tipo): Coluna<NotaConferida>[] {
  return [
    {
      id: "nota",
      cabecalho: "Nota",
      largura: "116px",
      ordenar: (n) => n.numero,
      celula: (n) => <NumeroNota numero={n.numero} serie={n.serie} />,
    },
    {
      id: "data",
      cabecalho: "Data",
      largura: "100px",
      ordenar: (n) => n.data,
      celula: (n) => <span className="num">{dataBR(n.data)}</span>,
    },
    {
      id: "contraparte",
      classe: "max-w-0",
      cabecalho: tipo === "ent" ? "Fornecedor" : "Cliente",
      celula: (n) => (
        <span className="block truncate text-tinta" title={n.contraparte ?? undefined}>
          {n.contraparte ?? "Sem contraparte"}
        </span>
      ),
    },
    {
      id: "cfop",
      classe: "max-w-0",
      cabecalho: "CFOP",
      largura: "130px",
      secundaria: true,
      celula: (n) => (
        <span className="num block truncate text-apagado" title={n.cfops.join(", ")}>
          {n.cfops.join(", ")}
        </span>
      ),
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      largura: "240px",
      // A contagem de divergências fica à vista para não precisar abrir a nota
      // só para saber o tamanho do problema.
      celula: (n) => (
        <span className="flex items-center gap-1.5">
          <SeloSituacao situacao={n.situacao} />
          {n.divergencias.length > 0 && (
            <span className="num text-micro text-perigo">
              {num(n.divergencias.length)} {n.divergencias.length === 1 ? "divergência" : "divergências"}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "140px",
      ordenar: (n) => n.valor,
      classe: "font-[600] text-tinta",
      celula: (n) => brl(n.valor),
    },
  ];
}

export default function ConteudoConferencia() {
  const { qs } = useExecucao();
  const [tipo, setTipo] = useEstadoTela<Tipo>("tipo", "ent");
  const [situacao, setSituacao] = useEstadoTela<FiltroSituacao>("situacao", "problema");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [buscaAplicada, setBuscaAplicada] = useEstadoTela("buscaAplicada", "");
  const [especies, setEspecies] = useEstadoTela<string[]>("especies", []);
  const [cfops, setCfops] = useEstadoTela<string[]>("cfops", []);
  const [ordem, setOrdem] = useEstadoTela<OrdemServidor>("ordem", "valor_desc");
  // Nota aberta no detalhe: efêmera, não sobrevive à troca de seção.
  const [notaAberta, setNotaAberta] = useState<NotaConferida | null>(null);

  // Digitar não dispara a conferência a cada tecla.
  useEffect(() => {
    const alvo = busca.trim();
    if (alvo === buscaAplicada) return;
    const t = setTimeout(() => setBuscaAplicada(alvo), 350);
    return () => clearTimeout(t);
  }, [busca, buscaAplicada, setBuscaAplicada]);

  const filtros = new URLSearchParams({ tipo, situacao, ordem });
  if (buscaAplicada) filtros.set("busca", buscaAplicada);
  if (especies.length) filtros.set("especies", especies.join(","));
  if (cfops.length) filtros.set("cfops", cfops.join(","));
  // A página guarda o recorte a que pertence: qualquer mudança de filtro ou
  // nova execução recomeça na primeira, e voltar da aba do plano reencontra a
  // página onde estava.
  const recorte = `${qs}|${filtros}`;
  const [pag, setPag] = useEstadoTela("pagina", { recorte, n: 1 });
  const pagina = pag.recorte === recorte ? pag.n : 1;

  const url = qs ? `/api/contabil/conferencia?${qs}&${filtros}&pagina=${pagina}` : null;
  const res = useConsulta<ConferenciaResp>("conferencia", url);
  const dados = res.data;
  const r = dados?.resumo;
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const temFiltroExtra = !!buscaAplicada || especies.length > 0 || cfops.length > 0;

  const mudarTipo = (t: Tipo) => {
    setTipo(t);
    // CFOP de entrada (1, 2, 3) não existe na saída (5, 6, 7): levar o filtro
    // para o outro lado esvaziaria a lista sem motivo aparente.
    setCfops([]);
  };
  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    setEspecies([]);
    setCfops([]);
  };

  const opcoesSituacao = useMemo<Opcao[]>(
    () => SITUACOES.map((s) => ({ valor: s.valor, rotulo: s.rotulo, detalhe: r ? num(contagem(r, s.valor)) : undefined })),
    [r]
  );
  const opcoesEspecie = useMemo<Opcao[]>(
    () => (dados?.facetas.especies ?? []).map((f) => ({ valor: f.valor, rotulo: f.valor, detalhe: num(f.qtd) })),
    [dados]
  );
  const opcoesCfop = useMemo<Opcao[]>(
    () =>
      (dados?.facetas.cfops ?? []).map((f) => ({
        valor: f.valor,
        rotulo: f.rotulo ? `${f.valor} ${f.rotulo}` : f.valor,
        detalhe: num(f.qtd),
      })),
    [dados]
  );
  const cols = useMemo(() => colunas(tipo), [tipo]);

  if (res.isError)
    return <PainelErro mensagem={(res.error as Error).message} onTentar={() => res.refetch()} />;

  const exigem = r ? r.contabilizadas + r.pendentes : 0;
  const lado = tipo === "ent" ? "entradas" : "saidas";

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="contabil"
          desabilitado={!dados}
          cortes={[
            {
              id: "notas",
              rotulo: `Notas desta página (${num(dados?.notas.length ?? 0)})`,
              nome: `conferencia-${lado}-pagina-${pagina}`,
              montar: () => ({
                cabecalhos: [
                  "Número",
                  "Série",
                  "Espécie",
                  "Data",
                  "Contraparte",
                  "Documento",
                  "UF",
                  "CFOP",
                  "Situação",
                  "Divergências",
                  "Lançamentos",
                  "Valor",
                ],
                linhas: (dados?.notas ?? []).map((n) => [
                  n.numero,
                  n.serie ?? "",
                  n.especie,
                  dataBR(n.data),
                  n.contraparte ?? "",
                  n.doc ?? "",
                  n.uf ?? "",
                  n.cfops.join(" "),
                  SITUACAO_NOTA[n.situacao].rotulo,
                  n.divergencias.map((d) => `${d.natureza === 1 ? "D" : "C"} ${d.detalhe}`).join(" | "),
                  n.lancamentos,
                  n.valor,
                ]),
              }),
            },
            {
              id: "resumo",
              rotulo: "Resumo da conferência",
              nome: `conferencia-${lado}-resumo`,
              montar: () => ({
                cabecalhos: ["Indicador", "Notas", "Valor"],
                linhas: r
                  ? [
                      ["Notas no período", r.total, r.valorTotal],
                      ["Não contabilizadas", r.pendentes, r.valorPendente],
                      ["Em bloco", r.consolidadas, r.valorConsolidado],
                      ["Conta errada", r.divergentes, r.valorDivergente],
                      ["Duplicadas (valor lançado a mais)", r.duplicadas, r.valorDuplicado],
                      ["Corretas", r.conformes, null],
                      ["Contabilizadas sem plano no CFOP", r.semPlano, null],
                      ["Não exigem lançamento", r.naoExigem, null],
                      ["Canceladas", r.canceladas, null],
                    ]
                  : [],
              }),
            },
          ]}
        />
      </AcoesPagina>

      <FaixaIndicadores>
        {!r ? (
          Array.from({ length: 6 }).map((_, i) => <Indicador key={i} rotulo="Carregando" valor="" detalhe="" carregando />)
        ) : (
          <>
            <Indicador
              rotulo={tipo === "ent" ? "Notas de entrada" : "Notas de saída"}
              icone="nota"
              valor={num(r.total)}
              detalhe={`${num(r.naoExigem)} não exigem lançamento`}
              onClick={() => setSituacao("todas")}
            />
            <Indicador
              rotulo="Não contabilizadas"
              icone="pendente"
              valor={num(r.pendentes)}
              detalhe={`${brlCompact(r.valorPendente)} a contabilizar`}
              tom={r.pendentes > 0 ? "atencao" : "neutro"}
              valorNoTom
              onClick={() => setSituacao("pendente")}
            />
            <Indicador
              rotulo="Em bloco"
              icone="camadas"
              valor={num(r.consolidadas)}
              detalhe={r.consolidadas > 0 ? `${brlCompact(r.valorConsolidado)} em consolidação` : "sem consolidação"}
              onClick={() => setSituacao("consolidada")}
            />
            <Indicador
              rotulo="Conta errada"
              icone="alerta"
              valor={num(r.divergentes)}
              detalhe={`de ${num(r.contabilizadas)} contabilizadas`}
              tom={r.divergentes > 0 ? "perigo" : "neutro"}
              valorNoTom
              onClick={() => setSituacao("divergente")}
            />
            <Indicador
              rotulo="Duplicadas"
              icone="copiar"
              valor={num(r.duplicadas)}
              detalhe={r.duplicadas > 0 ? `${brlCompact(r.valorDuplicado)} lançado a mais` : "nenhuma repetida"}
              tom={r.duplicadas > 0 ? "perigo" : "neutro"}
              valorNoTom
              onClick={() => setSituacao("duplicada")}
            />
            <Indicador
              rotulo="Corretas"
              icone="ok"
              valor={num(r.conformes)}
              detalhe={exigem > 0 ? `${pct((r.conformes / exigem) * 100)} do que exige lançamento` : "nada exige lançamento"}
              onClick={() => setSituacao("ok")}
            />
          </>
        )}
      </FaixaIndicadores>

      {dados && (dados.truncado || dados.resumo.semPlano > 0) && (
        <div className="flex flex-col gap-1 px-1">
          {dados.truncado && (
            <Nota tom="atencao" icone="alerta">
              O período passou de 8 mil notas, e só as de maior valor foram conferidas. Encurte o período para ver todas.
            </Nota>
          )}
          {dados.resumo.semPlano > 0 && (
            <Nota icone="info">
              {num(dados.resumo.semPlano)}{" "}
              {dados.resumo.semPlano === 1 ? "nota contabilizada usa CFOP" : "notas contabilizadas usam CFOP"} sem plano de
              contabilização: a conta delas não é conferida.
            </Nota>
          )}
        </div>
      )}

      <Painel
        corpo="p-0"
        titulo="Notas"
        descricao={
          dados ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="num">
                {num(dados.total)} {dados.total === 1 ? "nota" : "notas"}
              </span>
              {res.isFetching && <Girando />}
            </span>
          ) : (
            "Conferindo as notas do período"
          )
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="Nº, contraparte, CNPJ ou UF"
              classeCaixa="w-60"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <Combo
              className="w-56"
              rotuloAcessivel="Situação"
              opcoes={opcoesSituacao}
              valor={situacao}
              onMudar={(v) => setSituacao(v as FiltroSituacao)}
              busca={false}
            />
            <Segmentado
              rotulo="Entradas ou saídas"
              opcoes={[
                { valor: "ent", rotulo: "Entradas" },
                { valor: "sai", rotulo: "Saídas" },
              ]}
              valor={tipo}
              onMudar={mudarTipo}
            />
          </>
        }
      >
        {/* Refinos: só as espécies e os CFOPs que existem no recorte, com a
            contagem de cada um. As opções saem do conjunto antes deste filtro,
            então não somem conforme se marca. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-linha px-4 py-2">
          <ComboMulti
            className="w-48"
            icone="etiquetas"
            rotuloAcessivel="Espécie"
            rotuloTodas="Todas as espécies"
            plural="espécies"
            opcoes={opcoesEspecie}
            valor={especies}
            onMudar={setEspecies}
            desabilitado={!dados}
          />
          <ComboMulti
            className="w-48"
            icone="hash"
            rotuloAcessivel="CFOP"
            rotuloTodas="Todos os CFOPs"
            plural="CFOPs"
            larguraMin={380}
            opcoes={opcoesCfop}
            valor={cfops}
            onMudar={setCfops}
            desabilitado={!dados}
          />
          {temFiltroExtra && (
            <Botao variante="fantasma" icone="fechar" onClick={limpar}>
              Limpar filtros
            </Botao>
          )}
        </div>
        {!dados ? (
          <EsqueletoTabela colunas={6} />
        ) : (
          <>
            <TabelaDados
              rotulo="Notas conferidas"
              colunas={cols}
              linhas={dados.notas}
              chave={(n) => n.chave}
              onLinha={setNotaAberta}
              selecionada={(n) => n.chave === notaAberta?.chave}
              ordem={ordemDaTabela(ordem)}
              onOrdem={(o) => setOrdem(ordemDoServidor(o))}
              vazio={
                situacao === "problema" && !temFiltroExtra ? (
                  <Vazio
                    compacto
                    icone="ok"
                    titulo="Nada pendente e nada fora do plano"
                    descricao="Nenhuma nota ficou sem lançamento, na conta errada ou lançada duas vezes."
                    acao={<Botao onClick={() => setSituacao("todas")}>Ver todas as notas</Botao>}
                  />
                ) : temFiltroExtra ? (
                  <Vazio
                    compacto
                    icone="filtrar"
                    titulo="Nenhuma nota com esse filtro"
                    descricao="Limpe a busca, a espécie ou o CFOP."
                    acao={<Botao onClick={limpar}>Limpar filtros</Botao>}
                  />
                ) : (
                  <Vazio
                    compacto
                    icone="filtrar"
                    titulo="Nenhuma nota nesta situação"
                    descricao="Troque a situação para ver as outras notas do período."
                    acao={<Botao onClick={() => setSituacao("todas")}>Ver todas as notas</Botao>}
                  />
                )
              }
            />
            {dados.total > dados.porPagina && (
              <div className="border-t border-linha px-4 py-2">
                <Paginacao
                  pagina={pagina}
                  porPagina={dados.porPagina}
                  total={dados.total}
                  onPagina={(n) => setPag({ recorte, n })}
                />
              </div>
            )}
          </>
        )}
      </Painel>

      <DetalheNotaConferida nota={notaAberta} tipo={tipo} empresa={empresa} onFechar={() => setNotaAberta(null)} />
    </>
  );
}
