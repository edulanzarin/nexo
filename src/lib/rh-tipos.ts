/**
 * DTOs do módulo RH — tipos puros compartilhados entre rotas (servidor) e
 * hooks/telas (client). Sem imports de servidor, para poder entrar no bundle.
 */
import type { Marco, StatusExperiencia } from "./rh-experiencia";
import type { EscopoRodada, StatusDesempenho } from "./rh-desempenho";
import type { Formulario } from "./formularios-tipos";

/** Linha do Diretório: funcionário ativo de uma das empresas do RH. */
export interface FuncionarioDiretorio {
  codigoempresa: number;
  contrato: number; // PJ usa o contrato sintético (PJ_CONTRATO_OFFSET + id)
  nome: string;
  cargo: string | null;
  setor: string | null;
  classiforgan: string | null;
  dataadm: string; // YYYY-MM-DD (PJ: data_inicio)
  /** E-mail do colaborador (PJ: coluna; Questor: só via overlay). null = sem e-mail. */
  email: string | null;
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
  vencimento: string; // YYYY-MM-DD (dataadm + marco - 1: a admissão conta como dia 1)
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

/**
 * Linha da tela de Desempenho: uma avaliação (um colaborador dentro de uma
 * rodada). `respostas` é a contagem — a avaliação aceita várias, uma por gestor
 * — e `respondentes` traz quem já respondeu, que é o que a tela mostra sem
 * precisar abrir o detalhe.
 */
export interface DesempenhoItem {
  id: number;
  rodadaId: number;
  rodadaTitulo: string;
  escopo: EscopoRodada;
  formularioId: number;
  formularioNome: string;
  codigoempresa: number;
  contrato: number;
  nome: string;
  cargo: string | null;
  setor: string | null;
  classiforgan: string | null;
  status: StatusDesempenho;
  /** Gestores ativos cadastrados no setor — quem recebe o link. 0 = ninguém recebe. */
  gestores: number;
  respostas: number;
  respondentes: string[];
  ultimaResposta: string | null;
  criadoEm: string;
  enviadoEm: string | null;
  /** Preenchido = link fechado, não aceita mais resposta. */
  encerradoEm: string | null;
}

/** Uma resposta de gestor dentro de uma avaliação de desempenho. */
export interface DesempenhoResposta {
  id: number;
  nome: string;
  email: string | null;
  respondidoEm: string;
  valores: Record<string, unknown>;
}

/** Detalhe de uma avaliação: o formulário usado + todas as respostas. */
export interface DesempenhoDetalhe {
  id: number;
  titulo: string;
  funcionarioNome: string;
  codigoempresa: number;
  cargo: string | null;
  setor: string | null;
  criadoEm: string;
  encerradoEm: string | null;
  formulario: Formulario;
  respostas: DesempenhoResposta[];
}

/** Rodada listada no filtro da tela (para recortar "aquela avaliação de agosto"). */
export interface DesempenhoRodada {
  id: number;
  titulo: string;
  escopo: EscopoRodada;
  formularioNome: string;
  criadoEm: string;
  avaliacoes: number;
  respondidas: number;
}
