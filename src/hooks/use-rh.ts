"use client";

import type { FormularioResumo } from "@/lib/formularios-tipos";
import type { FuncionarioDiretorio, GestorRh, SetorRh } from "@/lib/rh-tipos";
import { useConsulta } from "./use-consulta";

/**
 * Os cadastros que várias telas do RH leem: quem trabalha na Navecon, os
 * setores, os gestores de cada setor e os formulários. Ficam aqui, com a chave
 * de cache num lugar só, porque quem escreve num deles (o Diretório cria um PJ,
 * Gestores cria um setor) invalida pela chave, e uma tela que lesse com chave
 * própria continuaria mostrando a lista antiga.
 *
 * Invalidar: `qc.invalidateQueries({ queryKey: [CHAVES_RH.funcionarios] })`.
 */
export const CHAVES_RH = {
  funcionarios: "rh-funcionarios",
  setores: "rh-setores",
  gestores: "rh-gestores",
  formularios: "rh-formularios",
} as const;

/** Cadastro: muda pouco, e cada tela que abre não precisa perguntar de novo. */
const CADASTRO = { staleTime: 60_000 };

export function useRhFuncionarios(ativo = true) {
  return useConsulta<FuncionarioDiretorio[]>(CHAVES_RH.funcionarios, ativo ? "/api/rh/funcionarios" : null, CADASTRO);
}

export function useRhSetores(ativo = true) {
  return useConsulta<SetorRh[]>(CHAVES_RH.setores, ativo ? "/api/rh/setores" : null, CADASTRO);
}

export function useRhGestores(ativo = true) {
  return useConsulta<GestorRh[]>(CHAVES_RH.gestores, ativo ? "/api/rh/gestores" : null, CADASTRO);
}

export function useFormulariosRh(ativo = true) {
  return useConsulta<FormularioResumo[]>(CHAVES_RH.formularios, ativo ? "/api/rh/formularios" : null, CADASTRO);
}
