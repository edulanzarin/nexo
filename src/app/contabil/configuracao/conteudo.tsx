"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Partida } from "@/componentes/produto/contabil/partida";
import { num } from "@/lib/format";
import type { EstabInfo, PlanoCfop, PlanoResp } from "@/lib/types";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { EditorPlano } from "./editor-plano";
import { ReplicarModal } from "./replicar-modal";

type Filtro = "todos" | "ent" | "sai" | "override" | "naocontabiliza";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos os CFOPs" },
  { valor: "ent", rotulo: "Entradas" },
  { valor: "sai", rotulo: "Saídas" },
  { valor: "override", rotulo: "Só overrides" },
  { valor: "naocontabiliza", rotulo: "Não contabilizam" },
];

/**
 * Rótulo curto do estabelecimento pelo sufixo do CNPJ (0001 é a matriz, o
 * resto são filiais). "estab 2" sozinho não diz nada para quem usa.
 */
function rotuloEstab(e: EstabInfo | undefined, codigo: number): string {
  // Vale com o CNPJ formatado ou só em dígitos: a ordem é do 9º ao 12º.
  const digitos = e?.cnpj?.replace(/\D/g, "") ?? "";
  const ordem = digitos.length === 14 ? digitos.slice(8, 12) : null;
  if (!ordem) return `estab ${codigo}`;
  return ordem === "0001" ? "matriz" : `filial ${ordem}`;
}

function colunas(estabs: Map<number, EstabInfo>): Coluna<PlanoCfop>[] {
  return [
    {
      id: "cfop",
      cabecalho: "CFOP",
      largura: "72px",
      celula: (c) => <span className="num font-[600] text-tinta">{c.cfop}</span>,
    },
    {
      id: "estab",
      cabecalho: "Estabelecimento",
      largura: "170px",
      secundaria: true,
      celula: (c) => (
        <span className="num text-apagado" title={estabs.get(c.estab)?.cnpj ?? undefined}>
          {rotuloEstab(estabs.get(c.estab), c.estab)} · base {c.cfopBase}
        </span>
      ),
    },
    {
      id: "descricao",
      classe: "max-w-0",
      cabecalho: "Descrição",
      celula: (c) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate" title={c.descricao ?? undefined}>
            {c.descricao ?? "Sem descrição"}
          </span>
          {c.origem === "override" && (
            <Selo tom="acento" title={c.observacao ?? "Vale no lugar do plano do Questor"}>
              Override
            </Selo>
          )}
        </span>
      ),
    },
    {
      id: "lancamentos",
      classe: "max-w-0",
      cabecalho: "Lançamentos esperados",
      largura: "38%",
      celula: (c) =>
        !c.contabiliza ? (
          <Selo>Não contabiliza</Selo>
        ) : (
          <span className="flex items-center gap-1 overflow-hidden">
            {c.componentes
              .flatMap((comp) => comp.linhas)
              .map((l, i) => (
                <Partida key={i} natureza={l.natureza} conta={l.conta} variavel={l.contaVariavel} descricao={l.descrConta} />
              ))}
          </span>
        ),
    },
    {
      id: "historico",
      cabecalho: "Lançou em",
      largura: "130px",
      secundaria: true,
      // O "contabiliza" de quem não tem override vem do histórico; o número
      // explica por que a conferência cobra (ou não) este CFOP.
      celula: (c) =>
        c.origem !== "override" && c.aprendido ? (
          <span className="num text-apagado" title="Notas deste CFOP lançadas nos últimos 12 meses">
            {num(c.aprendido.contabilizadas)} de {num(c.aprendido.notas)}
          </span>
        ) : null,
    },
    {
      id: "editar",
      cabecalho: <span className="sr-only">Editar</span>,
      largura: "40px",
      alinhar: "dir",
      celula: () => <Icone nome="editar" tamanho={14} className="text-apagado" />,
    },
  ];
}

export default function ConteudoConfiguracao() {
  const { qs } = useExecucao();
  const qc = useQueryClient();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [buscaAplicada, setBuscaAplicada] = useEstadoTela("buscaAplicada", "");
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "todos");
  // A página guarda o recorte a que pertence: trocar busca, filtro ou empresa
  // volta para a primeira, e voltar da Conferência reencontra a página.
  const recorte = `${empresa}|${buscaAplicada}|${filtro}`;
  const [pag, setPag] = useEstadoTela("pagina", { recorte, n: 1 });
  const pagina = pag.recorte === recorte ? pag.n : 1;
  const [editando, setEditando] = useState<PlanoCfop | null>(null);
  const [replicando, setReplicando] = useState(false);
  const [aprendendo, setAprendendo] = useState(false);

  useEffect(() => {
    const alvo = busca.trim();
    if (alvo === buscaAplicada) return;
    const t = setTimeout(() => setBuscaAplicada(alvo), 350);
    return () => clearTimeout(t);
  }, [busca, buscaAplicada, setBuscaAplicada]);

  // Sem período: o plano é configuração fixa da empresa.
  const p = new URLSearchParams({ empresa: String(empresa), filtro, pagina: String(pagina) });
  if (buscaAplicada) p.set("busca", buscaAplicada);
  const res = useConsulta<PlanoResp>("plano", qs ? `/api/contabil/plano?${p}` : null);
  const dados = res.data;
  const estabs = useMemo(() => new Map((dados?.estabs ?? []).map((e) => [e.codigo, e])), [dados]);
  const cols = useMemo(() => colunas(estabs), [estabs]);
  const temFiltro = !!buscaAplicada || filtro !== "todos";

  async function aprender() {
    setAprendendo(true);
    try {
      const r = await mutar<{ cfops: number; naturezas: number }>(`/api/contabil/aprender?empresa=${empresa}`, "POST");
      avisar.ok("Histórico reaprendido", `${num(r.cfops)} CFOPs revistos nos últimos 12 meses.`);
      qc.invalidateQueries({ queryKey: ["plano"] });
      qc.invalidateQueries({ queryKey: ["conferencia"] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    } catch (e) {
      avisar.erro("Não deu para reaprender", (e as Error).message);
    } finally {
      setAprendendo(false);
    }
  }

  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    setFiltro("todos");
  };

  if (res.isError) return <PainelErro mensagem={(res.error as Error).message} onTentar={() => res.refetch()} />;

  const filiais = dados ? dados.estabs.filter((e) => rotuloEstab(e, e.codigo) !== "matriz").length : 0;

  return (
    <>
      <AcoesPagina>
        <Botao
          icone="aprender"
          onClick={aprender}
          carregando={aprendendo}
          title="Relê os últimos 12 meses para saber quais CFOPs contabilizam"
        >
          Reaprender do histórico
        </Botao>
        {(dados?.overrides ?? 0) > 0 && (
          <Botao icone="copiar" onClick={() => setReplicando(true)} title="Copiar os overrides desta empresa para outra">
            Replicar
          </Botao>
        )}
      </AcoesPagina>

      <FaixaIndicadores>
        {!dados ? (
          Array.from({ length: 3 }).map((_, i) => <Indicador key={i} rotulo="Carregando" valor="" detalhe="" carregando />)
        ) : (
          <>
            <Indicador
              rotulo="CFOPs cadastrados"
              icone="hash"
              valor={num(dados.totalGeral)}
              detalhe="entradas e saídas"
              onClick={() => setFiltro("todos")}
            />
            <Indicador
              rotulo="Com override"
              icone="editar"
              valor={num(dados.overrides)}
              detalhe="valem no lugar do Questor"
              onClick={() => setFiltro("override")}
            />
            <Indicador
              rotulo="Estabelecimentos"
              icone="empresa"
              valor={num(dados.estabs.length)}
              detalhe={filiais > 0 ? `matriz e ${num(filiais)} ${filiais === 1 ? "filial" : "filiais"}` : "só a matriz"}
            />
          </>
        )}
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="CFOPs da empresa"
        descricao={
          dados ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="num">
                {dados.total !== dados.totalGeral && `${num(dados.total)} de ${num(dados.totalGeral)}, `}
                overrides primeiro
              </span>
              {res.isFetching && <Girando />}
            </span>
          ) : (
            "Lendo o plano do Questor"
          )
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="CFOP ou descrição"
              classeCaixa="w-56"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <Combo
              className="w-48"
              rotuloAcessivel="Quais CFOPs"
              opcoes={FILTROS}
              valor={filtro}
              onMudar={(v) => setFiltro(v as Filtro)}
            />
          </>
        }
      >
        {!dados ? (
          <EsqueletoTabela colunas={5} />
        ) : (
          <>
            <TabelaDados
              rotulo="Plano de contabilização"
              colunas={cols}
              linhas={dados.cfops}
              chave={(c) => `${c.estab}:${c.cfop}`}
              onLinha={setEditando}
              selecionada={(c) => c.cfop === editando?.cfop && c.estab === editando.estab}
              vazio={
                temFiltro ? (
                  <Vazio
                    compacto
                    icone="filtrar"
                    titulo="Nenhum CFOP com esse filtro"
                    descricao="Limpe a busca ou volte para todos os CFOPs."
                    acao={<Botao onClick={limpar}>Limpar filtros</Botao>}
                  />
                ) : (
                  <Vazio
                    compacto
                    icone="hash"
                    titulo="Esta empresa não tem CFOP cadastrado"
                    descricao="O plano vem do cadastro de CFOP no Questor. Cadastre lá e carregue de novo."
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

      {editando && (
        <EditorPlano
          key={`${editando.estab}:${editando.cfop}`}
          empresa={empresa}
          plano={editando}
          rotuloEstab={rotuloEstab(estabs.get(editando.estab), editando.estab)}
          onFechar={() => setEditando(null)}
        />
      )}
      <ReplicarModal origem={empresa} aberto={replicando} onFechar={() => setReplicando(false)} />
    </>
  );
}
