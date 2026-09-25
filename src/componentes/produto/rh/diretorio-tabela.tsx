"use client";

import type { ReactNode } from "react";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { diasDesde, tempoCasa } from "@/componentes/produto/pessoal/tempo-casa";
import { dataBR } from "@/lib/format";
import { nomeEmpresaRh } from "@/lib/rh";
import type { FuncionarioDiretorio } from "@/lib/rh-tipos";
import { SeloEmpresaRh } from "./empresa-rh";
import { SeloOrigemRh } from "./ficha-edicao-rh";

/** Empresa e contrato: o número do contrato só é único dentro da empresa, e o Diretório mistura as três. */
export const chavePessoaRh = (f: Pick<FuncionarioDiretorio, "codigoempresa" | "contrato">) =>
  `${f.codigoempresa}:${f.contrato}`;

/** Origem por extenso, para a planilha. */
export function origemTexto(f: FuncionarioDiretorio): string {
  if (f.origem === "pj") return "PJ";
  return f.editado ? "Questor, corrigido no RH" : "Questor";
}

/** Dias de casa da linha. PJ sem início vem com a data vazia. */
export const diasDeCasa = (f: FuncionarioDiretorio) => diasDesde(f.dataadm || null);

function colunas(comEmpresa: boolean): Coluna<FuncionarioDiretorio>[] {
  return [
    {
      id: "nome",
      cabecalho: "Nome",
      largura: "26%",
      ordenar: (f) => f.nome,
      celula: (f) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-[560] text-tinta" title={f.nome}>
            {f.nome}
          </span>
          <SeloOrigemRh pj={f.origem === "pj"} editado={f.editado} />
        </span>
      ),
    },
    ...(comEmpresa
      ? [
          {
            id: "empresa",
            cabecalho: "Empresa",
            ordenar: (f: FuncionarioDiretorio) => nomeEmpresaRh(f.codigoempresa),
            celula: (f: FuncionarioDiretorio) => <SeloEmpresaRh codigo={f.codigoempresa} />,
          },
        ]
      : []),
    {
      id: "cargo",
      cabecalho: "Cargo",
      largura: "17%",
      ordenar: (f) => f.cargo,
      celula: (f) =>
        f.cargo ? (
          <span className="block truncate" title={f.cargo}>
            {f.cargo}
          </span>
        ) : (
          <span className="text-apagado">—</span>
        ),
    },
    {
      id: "setor",
      cabecalho: "Setor",
      largura: "15%",
      ordenar: (f) => f.setor,
      celula: (f) =>
        f.setor ? (
          <span className="block truncate text-apagado" title={f.setor}>
            {f.setor}
          </span>
        ) : (
          <span className="text-apagado">Sem setor</span>
        ),
    },
    {
      id: "admissao",
      cabecalho: "Admissão",
      alinhar: "dir",
      largura: "104px",
      ordenar: (f) => f.dataadm || null,
      celula: (f) => dataBR(f.dataadm || null),
    },
    {
      id: "tempo",
      cabecalho: "Tempo de casa",
      alinhar: "dir",
      largura: "150px",
      secundaria: true,
      ordenar: (f) => diasDeCasa(f),
      celula: (f) => tempoCasa(diasDeCasa(f)),
    },
    {
      id: "email",
      cabecalho: "E-mail",
      largura: "18%",
      ordenar: (f) => f.email,
      celula: (f) =>
        f.email ? (
          <span className="block truncate" title={f.email}>
            {f.email}
          </span>
        ) : (
          <span className="text-apagado">Sem e-mail</span>
        ),
    },
  ];
}

const COM_EMPRESA = colunas(true);
const SEM_EMPRESA = colunas(false);

/**
 * Quem trabalha na Navecon, uma linha por pessoa. O sinal ao lado do nome diz
 * de onde ela vem (PJ, ou Questor corrigido no RH); o resto da pessoa está na
 * ficha que o clique abre. A coluna da empresa sai quando a tela já recortou
 * uma: repetiria o mesmo nome em toda linha.
 */
export function TabelaDiretorio({
  linhas,
  comEmpresa = true,
  onAbrir,
  selecionada,
  vazio,
  alturaMax = "62vh",
}: {
  linhas: FuncionarioDiretorio[];
  comEmpresa?: boolean;
  onAbrir?: (f: FuncionarioDiretorio) => void;
  selecionada?: (f: FuncionarioDiretorio) => boolean;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return (
    <TabelaDados
      rotulo="Diretório"
      colunas={comEmpresa ? COM_EMPRESA : SEM_EMPRESA}
      linhas={linhas}
      chave={chavePessoaRh}
      onLinha={onAbrir}
      selecionada={selecionada}
      alturaMax={alturaMax}
      vazio={vazio}
      className="print:!max-h-none print:!overflow-visible"
    />
  );
}
