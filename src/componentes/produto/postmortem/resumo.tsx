"use client";

import type { ReactNode } from "react";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import { CRITICIDADES, type ResumoPM } from "@/lib/postmortem-tipos";
import { numeroPM, SeloCriticidade, SeloGravidade, SeloSituacaoPM } from "./selos";

/** O recorte que um número da faixa aplica na lista quando clicado. */
export type AlvoResumo = "todos" | "enviado" | "rascunho" | "grave";

const ehGrave = (r: ResumoPM) => r.criticidade === "alta" || r.criticidade === "critica";

/**
 * Os números de uma lista de relatórios. Com autor é a leitura do gestor (quantos
 * analistas abriram); sem autor, a do analista. Clicar num número recorta a
 * lista quando a tela oferece o recorte.
 */
export function FaixaResumoPM({
  lista,
  carregando,
  comAutor,
  aoClicar,
}: {
  lista: ResumoPM[] | undefined;
  carregando?: boolean;
  comAutor?: boolean;
  aoClicar?: (alvo: AlvoResumo) => void;
}) {
  const l = lista ?? [];
  const enviados = l.filter((r) => r.status === "enviado").length;
  const rascunhos = l.length - enviados;
  const graves = l.filter(ehGrave).length;
  const criticas = l.filter((r) => r.criticidade === "critica").length;
  const analistas = new Set(l.map((r) => r.autorNome)).size;
  const ultimo = l.reduce<string | null>(
    (u, r) => (r.dataOcorrido && (!u || r.dataOcorrido > u) ? r.dataOcorrido : u),
    null
  );
  const clique = (alvo: AlvoResumo) => (aoClicar ? () => aoClicar(alvo) : undefined);

  return (
    <FaixaIndicadores>
      <Indicador
        rotulo="Relatórios"
        icone="relatorio"
        carregando={carregando}
        valor={num(l.length)}
        detalhe={ultimo ? `Último ocorrido em ${dataBR(ultimo)}` : "Nenhum ocorrido informado"}
        onClick={clique("todos")}
      />
      <Indicador
        rotulo="Enviados"
        icone="relatorio-conferido"
        carregando={carregando}
        valor={num(enviados)}
        detalhe="Com número do setor"
        onClick={clique("enviado")}
      />
      <Indicador
        rotulo="Em rascunho"
        icone="editar"
        carregando={carregando}
        valor={num(rascunhos)}
        detalhe={rascunhos ? "Ainda sem número" : "Nenhum pendente"}
        tom={rascunhos ? "atencao" : "neutro"}
        onClick={clique("rascunho")}
      />
      <Indicador
        rotulo="Alta ou crítica"
        icone="alerta"
        carregando={carregando}
        valor={num(graves)}
        detalhe={`${num(criticas)} ${criticas === 1 ? "crítica" : "críticas"}`}
        tom={graves ? "perigo" : "neutro"}
        valorNoTom={graves > 0}
        onClick={clique("grave")}
      />
      {comAutor && (
        <Indicador
          rotulo="Analistas"
          icone="pessoas"
          carregando={carregando}
          valor={num(analistas)}
          detalhe="Com relatório no setor"
        />
      )}
    </FaixaIndicadores>
  );
}

/** O relatório casa com o recorte clicado na faixa? */
export function casaAlvo(r: ResumoPM, alvo: AlvoResumo): boolean {
  if (alvo === "todos") return true;
  if (alvo === "grave") return ehGrave(r);
  return r.status === alvo;
}

/**
 * A lista de relatórios, uma linha por relatório. O relatório abre na página
 * dele (o formulário é longo demais para modal). Autor e grupo só aparecem na
 * leitura do gestor; gravidade, só no setor que a usa.
 */
export function TabelaPM({
  linhas,
  comAutor,
  mostraGravidade,
  onLinha,
  vazio,
}: {
  linhas: ResumoPM[];
  comAutor?: boolean;
  mostraGravidade?: boolean;
  onLinha: (r: ResumoPM) => void;
  vazio?: ReactNode;
}) {
  const colunas: Coluna<ResumoPM>[] = [
    {
      id: "numero",
      cabecalho: "Nº",
      largura: "72px",
      ordenar: (r) => r.numero,
      celula: (r) =>
        r.numero != null ? <span className="num text-tinta">{numeroPM(r.numero)}</span> : <span className="text-apagado">—</span>,
    },
    {
      id: "criticidade",
      cabecalho: "Criticidade",
      largura: "118px",
      ordenar: (r) => (r.criticidade ? CRITICIDADES.indexOf(r.criticidade) : null),
      celula: (r) => <SeloCriticidade nivel={r.criticidade} />,
    },
    ...(mostraGravidade
      ? [
          {
            id: "gravidade",
            cabecalho: "Gravidade",
            largura: "130px",
            ordenar: (r: ResumoPM) => r.gravidade,
            celula: (r: ResumoPM) => <SeloGravidade nota={r.gravidade} />,
          },
        ]
      : []),
    ...(comAutor
      ? [
          {
            id: "autor",
            cabecalho: "Analista",
            largura: "14%",
            ordenar: (r: ResumoPM) => r.autorNome,
            classe: "text-tinta",
            celula: (r: ResumoPM) => <span className="block truncate">{r.autorNome}</span>,
          },
        ]
      : []),
    {
      id: "empresa",
      cabecalho: "Empresa afetada",
      // As três colunas de texto em porcentagem: sem largura elas crescem até
      // o texto inteiro, e no Societário, com a gravidade a mais, empurravam o
      // Atualizado para fora da tabela a 1440 px.
      largura: "26%",
      ordenar: (r) => r.empresaAfetada,
      celula: (r) =>
        r.empresaAfetada ? (
          <span className="block truncate text-tinta">{r.empresaAfetada}</span>
        ) : (
          <span className="text-apagado">—</span>
        ),
    },
    ...(comAutor
      ? [
          {
            id: "grupo",
            cabecalho: "Grupo",
            largura: "14%",
            secundaria: true,
            ordenar: (r: ResumoPM) => r.grupoNome,
            celula: (r: ResumoPM) => <span className="block truncate text-apagado">{r.grupoNome ?? "—"}</span>,
          },
        ]
      : []),
    {
      id: "processo",
      cabecalho: "Processo",
      largura: "22%",
      ordenar: (r) => r.processo,
      celula: (r) => <span className="block truncate text-tinta-2">{r.processo || "—"}</span>,
    },
    {
      id: "ocorrido",
      cabecalho: "Ocorrido",
      alinhar: "dir",
      largura: "100px",
      ordenar: (r) => r.dataOcorrido,
      celula: (r) => dataBR(r.dataOcorrido),
    },
    {
      id: "atualizado",
      cabecalho: "Atualizado",
      alinhar: "dir",
      largura: "140px",
      secundaria: true,
      ordenar: (r) => r.atualizadoEm,
      celula: (r) => <span className="text-apagado">{dataHoraBR(r.atualizadoEm)}</span>,
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      largura: "112px",
      ordenar: (r) => r.status,
      celula: (r) => <SeloSituacaoPM status={r.status} />,
    },
  ];

  return (
    <TabelaDados
      colunas={colunas}
      linhas={linhas}
      chave={(r) => String(r.id)}
      onLinha={onLinha}
      vazio={vazio}
      rotulo="Relatórios post mortem"
    />
  );
}
