"use client";

import type { ReactNode } from "react";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { dataBR } from "@/lib/format";
import type { FolhaMovimentacao } from "@/lib/types";
import { tempoCasa } from "./tempo-casa";

/**
 * O que aconteceu com o contrato no período. Admitido e desligado no mesmo
 * período leva os dois selos: é o caso que infla o turnover e merece ser visto.
 * O motivo do desligamento fica na dica do selo; por inteiro, na ficha.
 */
export function SituacaoMovimento({ m }: { m: FolhaMovimentacao }) {
  if (!m.admitido && !m.desligado) return <Selo>Ativo</Selo>;
  return (
    <span className="flex items-center gap-1">
      {m.admitido && <Selo tom="ok">Admitido</Selo>}
      {m.desligado && (
        <Selo tom="perigo" title={m.motivo ?? undefined}>
          Desligado
        </Selo>
      )}
    </span>
  );
}

const COLUNAS: Coluna<FolhaMovimentacao>[] = [
  {
    id: "nome",
    cabecalho: "Nome",
    largura: "28%",
    ordenar: (m) => m.nome,
    classe: "font-[560] text-tinta",
    celula: (m) => (
      <span className="block truncate" title={m.nome}>
        {m.nome}
      </span>
    ),
  },
  {
    id: "situacao",
    cabecalho: "Situação",
    largura: "170px",
    ordenar: (m) => (m.desligado ? 2 : m.admitido ? 1 : 0),
    celula: (m) => <SituacaoMovimento m={m} />,
  },
  {
    id: "cargo",
    cabecalho: "Cargo",
    largura: "20%",
    ordenar: (m) => m.cargo,
    celula: (m) => (
      <span className="block truncate" title={m.cargo}>
        {m.cargo}
      </span>
    ),
  },
  {
    id: "setor",
    cabecalho: "Setor",
    largura: "18%",
    secundaria: true,
    ordenar: (m) => m.setor,
    celula: (m) => (
      <span className="block truncate text-apagado" title={m.setor}>
        {m.setor}
      </span>
    ),
  },
  {
    id: "admissao",
    cabecalho: "Admissão",
    alinhar: "dir",
    largura: "104px",
    ordenar: (m) => m.dataadm,
    celula: (m) => dataBR(m.dataadm),
  },
  {
    id: "desligamento",
    cabecalho: "Desligamento",
    alinhar: "dir",
    largura: "118px",
    ordenar: (m) => m.datadem,
    celula: (m) => dataBR(m.datadem),
  },
  {
    id: "tempo",
    cabecalho: "Tempo de casa",
    alinhar: "dir",
    largura: "150px",
    secundaria: true,
    ordenar: (m) => m.tempoCasaDias,
    celula: (m) => tempoCasa(m.tempoCasaDias),
  },
];

/**
 * Pessoas de uma lista de pessoal (movimentações, efetivo, o grupo de uma
 * quebra), uma linha por contrato. Linha enxuta: a pessoa inteira está na
 * ficha que o clique abre.
 *
 * A chave junta empresa e contrato porque o RH mistura empresas na mesma lista,
 * e o número do contrato só é único dentro da empresa.
 */
export function TabelaPessoas({
  linhas,
  onAbrir,
  selecionada,
  alturaMax = "34rem",
  vazio,
  rotulo = "Funcionários",
}: {
  linhas: FolhaMovimentacao[];
  onAbrir?: (m: FolhaMovimentacao) => void;
  selecionada?: (m: FolhaMovimentacao) => boolean;
  alturaMax?: string;
  vazio?: ReactNode;
  rotulo?: string;
}) {
  return (
    <TabelaDados
      colunas={COLUNAS}
      linhas={linhas}
      chave={(m) => `${m.codigoempresa}-${m.contrato}`}
      onLinha={onAbrir}
      selecionada={selecionada}
      alturaMax={alturaMax}
      rotulo={rotulo}
      vazio={vazio}
      // No papel a lista sai inteira, sem a rolagem da tela.
      className="print:!max-h-none print:!overflow-visible"
    />
  );
}
