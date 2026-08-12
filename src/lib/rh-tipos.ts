/**
 * DTOs do módulo RH — tipos puros compartilhados entre rotas (servidor) e
 * hooks/telas (client). Sem imports de servidor, para poder entrar no bundle.
 */
import type { Marco, StatusExperiencia } from "./rh-experiencia";

/** Linha do Diretório: funcionário ativo de uma das empresas do RH. */
export interface FuncionarioDiretorio {
  codigoempresa: number;
  contrato: number; // PJ usa o contrato sintético (PJ_CONTRATO_OFFSET + id)
  nome: string;
  cargo: string | null;
  setor: string | null;
  classiforgan: string | null;
  dataadm: string; // YYYY-MM-DD (PJ: data_inicio)
  /** "questor" = base do Questor (com eventual overlay); "pj" = pessoa local. */
  origem: "questor" | "pj";
  /** Tem correções (overlay) por cima do Questor. Sempre false para PJ. */
  editado: boolean;
}

/** Pessoa PJ (rh_pessoa_pj): prestador local, fora do Questor. DTO do CRUD. */
export interface PessoaPj {
  id: number;
  codigoempresa: number;
  nome: string;
  cpfCnpj: string | null;
  cargo: string | null;
  classiforgan: string | null;
  email: string | null;
  dataInicio: string | null; // YYYY-MM-DD
  temExperiencia: boolean; // entra na trilha de experiência (marcos 45/90 pela data de início)
  ativo: boolean;
}

/**
 * Departamento (classiforgan do organograma) com funcionários ativos. As empresas
 * do RH (NAVECON, FOUR, FINAVE) são a mesma Navecon (CNPJs distintos) com os mesmos
 * departamentos, então o setor é identificado só por `classiforgan` e a contagem
 * soma todas.
 */
export interface SetorRh {
  classiforgan: string;
  nome: string; // descrorgan (ou nome limpo de rh_setor, se renomeado)
  ativos: number;
  /** "questor" = derivado do organograma; "app" = setor próprio criado no RH. */
  origem: "questor" | "app";
}

/** Gestor cadastrado num departamento (recebe o formulário de experiência). */
export interface GestorRh {
  id: number;
  classiforgan: string;
  nome: string;
  email: string;
  papel: "supervisor" | "coordenador" | "outro";
  ativo: boolean;
}

/** Item do painel de Experiência: um marco (45/90) de um contrato. */
export interface ExperienciaItem {
  id: number | null; // null = ainda não materializado (só projetado)
  codigoempresa: number;
  contrato: number;
  nome: string;
  cargo: string | null;
  setor: string | null;
  classiforgan: string | null;
  dataadm: string;
  marco: Marco;
  vencimento: string; // YYYY-MM-DD (dataadm + marco)
  status: StatusExperiencia;
  diasParaVencer: number; // negativo = venceu
  gestores: number; // quantos gestores cadastrados no setor
  ultimoLembrete: string | null; // ISO do último lembrete enviado
  resposta: {
    recomendacao: string;
    respondidoPor: string;
    respondidoEm: string;
    comentarios: string | null;
  } | null;
}
