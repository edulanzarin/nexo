"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { dataBR, num } from "@/lib/format";
import type { ModuloId } from "@/lib/modulos";
import { SECAO_PM_GESTAO } from "@/lib/postmortem-secoes";
import { setorDoModulo, temCampo } from "@/lib/postmortem-setores";
import { CRITICIDADE_ROTULO, CRITICIDADES, type ResumoPM } from "@/lib/postmortem-tipos";
import { CHAVE_PM, urlListaPM } from "./consulta";
import { casaAlvo, FaixaResumoPM, TabelaPM, type AlvoResumo } from "./resumo";
import { numeroPM, rotuloGravidade } from "./selos";

type Situacao = "todos" | "enviado" | "rascunho";

const OPCOES_CRITICIDADE = [
  { valor: "todas", rotulo: "Toda criticidade" },
  { valor: "grave", rotulo: "Alta ou crítica" },
  ...CRITICIDADES.map((c) => ({ valor: c, rotulo: CRITICIDADE_ROTULO[c] })),
];

/**
 * A lista da seção `post-mortem-gestao`: todos os relatórios DO SETOR, de
 * qualquer analista. É a tela do gestor da área, por isso o autor é coluna e
 * por isso ela exporta: a leitura da área inteira é o que se leva para reunião.
 *
 * Criticidade, situação e busca filtram no cliente, sobre a lista já
 * carregada: a lista é de um setor só, e mexer nesses recortes não vale uma ida
 * ao banco.
 */
export function ListaGestao({ modulo }: { modulo: ModuloId }) {
  const router = useRouter();
  const setor = setorDoModulo(modulo);
  const rotuloSetor = setor?.rotulo ?? modulo;
  const mostraGravidade = setor ? temCampo(setor.id, "gravidade") : false;
  const base = `/${modulo}/${SECAO_PM_GESTAO}`;

  const [crit, setCrit] = useEstadoTela<string>("criticidade", "todas");
  const [situacao, setSituacao] = useEstadoTela<Situacao>("situacao", "todos");
  const [busca, setBusca] = useEstadoTela("busca", "");

  const { data, error, isLoading, refetch } = useConsulta<ResumoPM[]>(
    CHAVE_PM,
    urlListaPM(modulo, SECAO_PM_GESTAO)
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (data ?? []).filter((r) => {
      if (crit === "grave" ? !casaAlvo(r, "grave") : crit !== "todas" && r.criticidade !== crit) return false;
      if (situacao !== "todos" && r.status !== situacao) return false;
      if (termo) {
        const alvo = normalizar(`${r.empresaAfetada} ${r.autorNome} ${r.processo} ${r.grupoNome ?? ""}`);
        if (!termo.split(/\s+/).every((p) => alvo.includes(p))) return false;
      }
      return true;
    });
  }, [data, crit, situacao, busca]);

  const filtrando = crit !== "todas" || situacao !== "todos" || busca.trim() !== "";
  const limpar = () => {
    setCrit("todas");
    setSituacao("todos");
    setBusca("");
  };

  // O número clicado na faixa vira o recorte da lista, e só ele: os outros
  // filtros saem para o total bater com o que a faixa mostrou.
  const recortar = (alvo: AlvoResumo) => {
    setBusca("");
    setCrit(alvo === "grave" ? "grave" : "todas");
    setSituacao(alvo === "enviado" || alvo === "rascunho" ? alvo : "todos");
  };

  if (error && !data)
    return (
      <PainelErro titulo="Não deu para carregar os relatórios" mensagem={(error as Error).message} onTentar={() => refetch()} />
    );

  const carregando = isLoading || !data;
  const total = data?.length ?? 0;

  const cortes = [
    {
      id: "relatorios",
      rotulo: "Relatórios",
      nome: `post-mortem-${setor?.id ?? modulo}`,
      montar: () => ({
        cabecalhos: [
          "Nº",
          "Criticidade",
          ...(mostraGravidade ? ["Gravidade"] : []),
          "Analista",
          "Empresa afetada",
          "Grupo",
          "Processo",
          "Ocorrido",
          "Situação",
        ],
        linhas: filtrados.map((r) => [
          numeroPM(r.numero),
          r.criticidade ? CRITICIDADE_ROTULO[r.criticidade] : "",
          ...(mostraGravidade ? [r.gravidade != null ? rotuloGravidade(r.gravidade) : ""] : []),
          r.autorNome,
          r.empresaAfetada,
          r.grupoNome ?? "",
          r.processo,
          r.dataOcorrido ? dataBR(r.dataOcorrido) : "",
          r.status === "enviado" ? "Enviado" : "Rascunho",
        ]),
      }),
    },
  ];

  return (
    <>
      <AcoesPagina>
        <MenuExportar modulo={modulo} cortes={cortes} desabilitado={carregando || !filtrados.length} />
      </AcoesPagina>

      <FaixaResumoPM lista={data} carregando={carregando} comAutor aoClicar={recortar} />

      <Painel
        corpo="p-0"
        titulo={`Relatórios do ${rotuloSetor}`}
        descricao={
          carregando ? "Carregando" : filtrando ? `${num(filtrados.length)} de ${num(total)}` : `${num(total)} no setor`
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="Empresa, analista, processo ou grupo"
              classeCaixa="w-64"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar relatório"
            />
            <Combo
              className="w-44"
              rotuloAcessivel="Criticidade"
              opcoes={OPCOES_CRITICIDADE}
              valor={crit}
              onMudar={setCrit}
            />
            <Segmentado<Situacao>
              rotulo="Situação"
              opcoes={[
                { valor: "todos", rotulo: "Todos" },
                { valor: "enviado", rotulo: "Enviados" },
                { valor: "rascunho", rotulo: "Rascunhos" },
              ]}
              valor={situacao}
              onMudar={setSituacao}
            />
          </>
        }
      >
        {carregando ? (
          <EsqueletoTabela colunas={7} linhas={8} />
        ) : !total ? (
          <Vazio
            icone="relatorio"
            titulo={`Nenhum relatório do ${rotuloSetor} ainda`}
            descricao="Quando alguém do setor abrir um relatório, ele aparece aqui, rascunho ou enviado."
          />
        ) : (
          <TabelaPM
            linhas={filtrados}
            comAutor
            mostraGravidade={mostraGravidade}
            onLinha={(r) => router.push(`${base}/${r.id}`)}
            vazio={
              <Vazio
                compacto
                icone="filtrar"
                titulo="Nenhum relatório com esse filtro"
                descricao="Afrouxe a criticidade, a situação ou a busca."
                acao={
                  <Botao variante="fantasma" icone="fechar" onClick={limpar}>
                    Limpar filtros
                  </Botao>
                }
              />
            }
          />
        )}
      </Painel>
    </>
  );
}
