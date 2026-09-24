"use client";

import { useEffect, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Menu } from "@/componentes/primitivos/menu";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao } from "@/componentes/primitivos/tabela";
import { exportarCSV } from "@/lib/exportar";
import { dataBR, num } from "@/lib/format";
import type { NotaLista, NotasListaResp } from "@/lib/types";
import { buscarJson, useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import type { ModuloNotas } from "./bloco-detalhe";
import { FiltroContraparte, type PessoaSel } from "./contrapartes";
import { DetalheNota } from "./detalhe-nota";
import { TabelaNotas } from "./tabela-notas";

type Tipo = "ent" | "sai";
type Situacao = "todas" | "normais" | "canceladas";

const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "normais", rotulo: "Normais" },
  { valor: "canceladas", rotulo: "Canceladas" },
];

/** Os filtros da tela na query da API, sem a página. */
function paramsFiltro(tipo: Tipo, busca: string, situacao: Situacao, pessoa: PessoaSel | null) {
  const p = new URLSearchParams({ tipo, busca, situacao });
  if (pessoa) p.set("pessoa", String(pessoa.codigo));
  return p;
}

/**
 * Exportar o recorte inteiro, não a página: o servidor devolve o conjunto
 * filtrado de uma vez (com teto de 10 mil linhas). Por isso o clique pergunta
 * de novo à API, e o menu padrão (que monta o arquivo com o que já está na
 * tela) não serve aqui.
 */
function ExportarNotas({
  modulo,
  url,
  tipo,
  mostraEmpresa,
  desabilitado,
}: {
  modulo: ModuloNotas;
  url: string;
  tipo: Tipo;
  mostraEmpresa: boolean;
  desabilitado: boolean;
}) {
  const [gerando, setGerando] = useState(false);

  const exportar = async () => {
    setGerando(true);
    try {
      const dados = await buscarJson<NotasListaResp>(`${url}&export=1`);
      const cabecalhos = [
        "Data",
        ...(mostraEmpresa ? ["Empresa"] : []),
        "Número",
        "Série",
        "Espécie",
        "Contraparte",
        "Documento",
        "UF",
        "Valor",
        "Cancelada",
      ];
      const linhas = dados.rows.map((n) => [
        dataBR(n.data),
        ...(mostraEmpresa ? [n.empresaNome ?? `Empresa ${n.empresa}`] : []),
        n.numero,
        n.serie ?? "",
        n.especie,
        n.contraparte ?? "",
        n.contraparteDoc ?? "",
        n.uf ?? "",
        n.valor,
        n.cancelada ? "sim" : "",
      ]);
      exportarCSV(modulo, `notas-${tipo === "sai" ? "saidas" : "entradas"}`, cabecalhos, linhas);
      if (dados.total > dados.rows.length)
        avisar.info(
          `Saíram ${num(dados.rows.length)} de ${num(dados.total)} notas`,
          "O arquivo tem teto de 10 mil linhas. Encurte o período para levar o resto."
        );
    } catch (e) {
      avisar.erro("Não deu para exportar", (e as Error).message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <Menu
      larguraMin={240}
      itens={[{ rotulo: "Planilha (CSV)", icone: "planilha", detalhe: "recorte inteiro", aoEscolher: exportar }]}
      gatilho={(p) => (
        <Botao {...p} variante="secundario" icone="baixar" carregando={gerando} disabled={desabilitado}>
          Exportar
        </Botao>
      )}
    />
  );
}

/**
 * O explorador de notas: a lista bruta do período, com busca por número ou
 * nome, filtro por contraparte, situação e lado, e o detalhe com os itens no
 * clique. O mesmo serve o Fiscal (seção Dados, várias empresas) e o Contábil
 * (seção Notas, uma empresa); `modulo` só troca a rota da API, que é gateada
 * pelo módulo.
 *
 * `qs` é o recorte executado (empresas, filial, período).
 */
export function ExploradorNotas({
  modulo,
  qs,
  mostraEmpresa = false,
}: {
  modulo: ModuloNotas;
  qs: string;
  mostraEmpresa?: boolean;
}) {
  const [tipo, setTipo] = useEstadoTela<Tipo>("tipo", "sai");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [buscaAplicada, setBuscaAplicada] = useEstadoTela("buscaAplicada", "");
  const [situacao, setSituacao] = useEstadoTela<Situacao>("situacao", "todas");
  const [pessoa, setPessoa] = useEstadoTela<PessoaSel | null>("pessoa", null);
  const filtros = paramsFiltro(tipo, buscaAplicada, situacao, pessoa).toString();
  // A página guarda o recorte a que pertence: mudar filtro, lado ou executar
  // de novo volta para a primeira sem efeito que zere, e voltar de outra seção
  // reencontra a página onde estava.
  const recorte = `${qs}|${filtros}`;
  const [pag, setPag] = useEstadoTela("pagina", { recorte, n: 1 });
  const pagina = pag.recorte === recorte ? pag.n : 1;

  const [notaAberta, setNotaAberta] = useState<NotaLista | null>(null);
  const [filtrandoPessoa, setFiltrandoPessoa] = useState(false);

  // Digitar não dispara consulta a cada tecla.
  useEffect(() => {
    const alvo = busca.trim();
    if (alvo === buscaAplicada) return;
    const t = setTimeout(() => setBuscaAplicada(alvo), 350);
    return () => clearTimeout(t);
  }, [busca, buscaAplicada, setBuscaAplicada]);

  const base = `/api/${modulo}/notas-lista?${qs}&${filtros}`;
  const res = useConsulta<NotasListaResp>("notas-lista", `${base}&page=${pagina}`);
  const dados = res.data;
  const total = dados?.total ?? 0;
  const temFiltro = !!buscaAplicada || situacao !== "todas" || pessoa != null;

  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    setSituacao("todas");
    setPessoa(null);
  };

  return (
    <>
      <AcoesPagina>
        <ExportarNotas
          modulo={modulo}
          url={base}
          tipo={tipo}
          mostraEmpresa={mostraEmpresa}
          desabilitado={!dados || total === 0}
        />
      </AcoesPagina>

      {res.isError ? (
        <PainelErro mensagem={(res.error as Error).message} onTentar={() => res.refetch()} />
      ) : (
        <Painel
          corpo="p-0"
          titulo="Notas"
          descricao={
            dados ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="num">
                  {num(total)} {total === 1 ? "nota" : "notas"}, a mais recente primeiro
                </span>
                {res.isFetching && <Girando />}
              </span>
            ) : (
              "Carregando"
            )
          }
          acoes={
            <>
              <Campo
                icone="buscar"
                placeholder="Número ou contraparte"
                classeCaixa="w-56"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
              />
              <div className="flex items-center gap-1">
                <Botao
                  variante="secundario"
                  icone="filtrar"
                  onClick={() => setFiltrandoPessoa(true)}
                  className="max-w-56"
                  title={pessoa?.nome}
                >
                  <span className="min-w-0 truncate">{pessoa ? pessoa.nome : "Contraparte"}</span>
                </Botao>
                {pessoa && <BotaoIcone icone="fechar" rotulo="Tirar o filtro de contraparte" onClick={() => setPessoa(null)} />}
              </div>
              <Segmentado rotulo="Situação das notas" opcoes={SITUACOES} valor={situacao} onMudar={setSituacao} />
              <Segmentado
                rotulo="Entradas ou saídas"
                opcoes={[
                  { valor: "ent", rotulo: "Entradas" },
                  { valor: "sai", rotulo: "Saídas" },
                ]}
                valor={tipo}
                onMudar={setTipo}
              />
            </>
          }
        >
          {!dados ? (
            <EsqueletoTabela colunas={6} />
          ) : (
            <>
              <TabelaNotas
                linhas={dados.rows}
                tipo={tipo}
                mostraEmpresa={mostraEmpresa}
                onLinha={setNotaAberta}
                selecionada={(n) => n.chave === notaAberta?.chave && n.empresa === notaAberta.empresa}
                vazio={
                  temFiltro ? (
                    <Vazio
                      compacto
                      icone="filtrar"
                      titulo="Nenhuma nota com esse filtro"
                      descricao="Limpe a busca, a contraparte ou a situação."
                      acao={<Botao onClick={limpar}>Limpar filtros</Botao>}
                    />
                  ) : (
                    <Vazio
                      compacto
                      icone="nota"
                      titulo={tipo === "ent" ? "Nenhuma nota de entrada no recorte" : "Nenhuma nota de saída no recorte"}
                      descricao="Confira o período e a filial no topo, ou veja o outro lado."
                      acao={<Botao onClick={() => setTipo(tipo === "ent" ? "sai" : "ent")}>{tipo === "ent" ? "Ver saídas" : "Ver entradas"}</Botao>}
                    />
                  )
                }
              />
              {total > 0 && (
                <div className="border-t border-linha px-4 py-2">
                  <Paginacao
                    pagina={pagina}
                    porPagina={dados.pageSize}
                    total={total}
                    onPagina={(n) => setPag({ recorte, n })}
                  />
                </div>
              )}
            </>
          )}
        </Painel>
      )}

      <FiltroContraparte
        aberto={filtrandoPessoa}
        onFechar={() => setFiltrandoPessoa(false)}
        modulo={modulo}
        qs={qs}
        tipo={tipo}
        selecionada={pessoa}
        onSelecionar={setPessoa}
      />
      <DetalheNota
        nota={notaAberta}
        tipo={tipo}
        modulo={modulo}
        mostraEmpresa={mostraEmpresa}
        onFechar={() => setNotaAberta(null)}
      />
    </>
  );
}
