"use client";

import type { ReactNode } from "react";
import type { Coluna } from "@/componentes/primitivos/tabela";
import {
  GrupoCadastroEstatico,
  ModalGrupoCadastro,
  TabelaGruposCadastro,
  type AlvoGrupo,
  type CadastroGrupo,
  type RascunhoGrupo,
} from "@/componentes/produto/config/grupos-empresa";
import { CHAVES_ADMIN } from "@/hooks/use-admin";
import type { GrupoPermissaoResumo } from "@/lib/admin-tipos";
import { dataBR, num } from "@/lib/format";
import type { EmpresaMarcavel } from "@/lib/grupos-empresa-tipos";

/*
 * Grupos de permissão: o conjunto de empresas que um cargo enxerga (tabela
 * `empresa_grupo`). A montagem é a do cadastro de grupos de negócio das
 * Configurações (lista, janela, modo "todas, exceto"); o que muda está no
 * `CADASTRO_GRUPO_PERMISSAO`: as rotas, o cache, o uso por cargo e a remoção,
 * que aqui não tem trava (nada aponta para o grupo além dos cargos, e o
 * vínculo cai junto).
 */

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** Quantas empresas o grupo alcança, do jeito que o cargo e a lista dizem. */
export function resumoEmpresasGrupo(g: GrupoPermissaoResumo): string {
  if (g.empresas === 0) return "Sem empresa";
  if (g.modo === "exceto") return `Todas, exceto ${num(g.marcadas)}`;
  return plural(g.empresas, "empresa", "empresas");
}

const COLUNAS_USO: Coluna<GrupoPermissaoResumo>[] = [
  {
    id: "cargos",
    cabecalho: "Cargos",
    alinhar: "dir",
    largura: "96px",
    ordenar: (g) => g.cargos,
    celula: (g) => (g.cargos ? num(g.cargos) : <span className="text-apagado">0</span>),
  },
  {
    id: "usuarios",
    cabecalho: "Usuários",
    alinhar: "dir",
    largura: "96px",
    // No celular o nome do grupo precisa do espaço; a janela diz o uso.
    secundaria: true,
    ordenar: (g) => g.usuarios,
    celula: (g) => (g.usuarios ? num(g.usuarios) : <span className="text-apagado">0</span>),
  },
];

export const CADASTRO_GRUPO_PERMISSAO: CadastroGrupo<GrupoPermissaoResumo> = {
  api: "/api/admin/grupos",
  chaveGrupo: CHAVES_ADMIN.grupo,
  // A mesma chave e URL de `useEmpresasAdmin`: uma lista só no cache.
  empresas: { chave: CHAVES_ADMIN.empresas, url: "/api/admin/empresas" },
  // A lista de cargos mostra quantos grupos cada um tem.
  invalidar: [CHAVES_ADMIN.grupos, CHAVES_ADMIN.grupo, CHAVES_ADMIN.cargos],
  rotuloTabela: "Grupos de permissão",
  larguraNome: "48%",
  colunasUso: COLUNAS_USO,
  dicaSemEmpresa: "Quem recebe este grupo não enxerga empresa nenhuma por ele",
  tituloNovo: "Novo Grupo",
  descricaoNovo: "As empresas que um cargo passa a enxergar quando recebe o grupo",
  exemploNome: "Carteira Sul",
  descricao: (g) =>
    [
      plural(g.empresas, "empresa", "empresas"),
      g.cargos ? `em ${plural(g.cargos, "cargo", "cargos")}` : "em nenhum cargo",
      g.atualizadoEm ? `atualizado em ${dataBR(g.atualizadoEm)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  trava: () => null,
  efeito: (g) =>
    g.cargos
      ? `${plural(g.cargos, "cargo deixa", "cargos deixam")} de enxergar as empresas deste grupo.`
      : "Nenhum cargo usa este grupo.",
};

/** Os grupos de permissão, uma linha cada, com quantos cargos e pessoas cada um alcança. */
export function TabelaGruposPermissao(props: {
  grupos: GrupoPermissaoResumo[];
  onAbrir: (g: GrupoPermissaoResumo) => void;
  selecionado?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return <TabelaGruposCadastro cadastro={CADASTRO_GRUPO_PERMISSAO} {...props} />;
}

/** A janela do grupo de permissão, com as escritas. Fecha sozinha ao salvar e ao remover. */
export function ModalGrupoPermissao({
  alvo,
  onFechar,
}: {
  alvo: AlvoGrupo<GrupoPermissaoResumo> | null;
  onFechar: () => void;
}) {
  return <ModalGrupoCadastro cadastro={CADASTRO_GRUPO_PERMISSAO} alvo={alvo} onFechar={onFechar} />;
}

/** A janela parada, para o catálogo. Mexe no rascunho, mas não grava. */
export function GrupoPermissaoEstatico(props: {
  /** Sem grupo, é a janela do grupo novo. */
  grupo?: GrupoPermissaoResumo;
  inicial: RascunhoGrupo;
  empresas: EmpresaMarcavel[];
  carregando?: boolean;
  confirmandoInicial?: boolean;
}) {
  return <GrupoCadastroEstatico cadastro={CADASTRO_GRUPO_PERMISSAO} {...props} />;
}
