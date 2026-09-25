"use client";

import type { CargoResumo, GrupoPermissaoResumo, SetorResumo, UsuarioLista } from "@/lib/admin-tipos";
import type { EmpresaMarcavel } from "@/lib/grupos-empresa-tipos";
import { useConsulta } from "./use-consulta";

/**
 * Os cadastros da Administração que mais de uma tela lê: o formulário do
 * usuário escolhe cargos, o do cargo escolhe setor e grupos de permissão. A
 * chave fica num lugar só porque quem escreve invalida por ela, e uma tela
 * que lesse com chave própria continuaria mostrando a lista antiga.
 *
 * Invalidar: `qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.cargos] })`. Cargo
 * mexe na contagem de usuários e de grupos; usuário mexe na de cargos: quem
 * salva invalida as listas cuja contagem mudou.
 */
export const CHAVES_ADMIN = {
  usuarios: "admin-usuarios",
  cargos: "admin-cargos",
  cargo: "admin-cargo",
  setores: "admin-setores",
  grupos: "admin-grupos",
  grupo: "admin-grupo",
  empresas: "admin-empresas",
  trilha: "admin-trilha",
} as const;

/** Cadastro: muda pouco, e cada tela que abre não precisa perguntar de novo. */
const CADASTRO = { staleTime: 60_000 };

export function useUsuariosAdmin(ativo = true) {
  return useConsulta<UsuarioLista[]>(CHAVES_ADMIN.usuarios, ativo ? "/api/admin/usuarios" : null, CADASTRO);
}

export function useCargosAdmin(ativo = true) {
  return useConsulta<CargoResumo[]>(CHAVES_ADMIN.cargos, ativo ? "/api/admin/cargos" : null, CADASTRO);
}

export function useSetoresAdmin(ativo = true) {
  return useConsulta<SetorResumo[]>(CHAVES_ADMIN.setores, ativo ? "/api/admin/setores" : null, CADASTRO);
}

export function useGruposPermissao(ativo = true) {
  return useConsulta<GrupoPermissaoResumo[]>(CHAVES_ADMIN.grupos, ativo ? "/api/admin/grupos" : null, CADASTRO);
}

/** Todas as empresas do Questor, o universo de um grupo de permissão. Muda raramente. */
export function useEmpresasAdmin(ativo = true) {
  return useConsulta<EmpresaMarcavel[]>(CHAVES_ADMIN.empresas, ativo ? "/api/admin/empresas" : null, {
    staleTime: 10 * 60_000,
  });
}
