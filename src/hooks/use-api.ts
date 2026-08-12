"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { mutar } from "./mutar";
import type {
  Empresa,
  Filial,
  Metrica,
  Overview,
  Timeseries,
  EspecieResumo,
  TopItem,
  EstadoResumo,
  ProdutoTop,
  CfopResumo,
  Impostos,
  ImpostosSerie,
  NotasListaResp,
  NotaItem,
  ContrapartesResp,
  DevolucoesResumo,
  CancelamentosResumo,
  PontoValorSerie,
  ColaboradorProd,
  ProdutividadeSerie,
  ProdutividadeCalendario,
  ConformidadeResumo,
  ConformidadeEmpresa,
  TributosCargaEmpresa,
  ConferenciaResp,
  PendenciasResp,
  TurnoverResp,
  FolhaFiltros,
  FolhaMovimentacao,
  FolhaFicha,
  PlanoResp,
  BalanceteFiscalResp,
  BalanceteContabilResp,
  BalanceteLancamentosResp,
  BalanceteCulpadosResp,
  ReplicarPreviewResp,
  AnaliseBalanceteResp,
  LaudoEscritoResp,
  FechamentoResp,
  ContasControleResp,
  ProvisoesResp,
  AuditoriaResp,
  CustoFolhaResp,
  ConformidadeEsocialResp,
  ControleFeriasResp,
} from "@/lib/types";
import type {
  FuncionarioDiretorio,
  SetorRh,
  GestorRh,
  ExperienciaItem,
} from "@/lib/rh-tipos";
import type { Formulario, FormularioResumo } from "@/lib/formularios-tipos";
import type { DpResumo, DpLinha, DpQuebra, DpTipo } from "@/lib/dp-tipos";
import type { EnvioDetalhe, EnvioResumo } from "@/lib/envios";
import type { EnvioRegra } from "@/lib/envio-regras";
import type { RespostaExperienciaDetalhe } from "@/lib/rh-experiencia-dados";
import type { DenunciaDashboard, DenunciaDetalhe, DenunciaResumo } from "@/lib/denuncia-tipos";
import type { ClimaDashboard, RodadaResumo } from "@/lib/clima-tipos";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let mensagem = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) mensagem = body.error;
    } catch {}
    throw new Error(mensagem);
  }
  return res.json();
}

function useApiQuery<T>(chave: unknown[], url: string, enabled = true) {
  const q = useQuery<T>({
    queryKey: chave,
    queryFn: () => fetchJson<T>(url),
    placeholderData: keepPreviousData,
    enabled,
  });

  useEffect(() => {
    if (q.isError) {
      toast.error(q.error instanceof Error ? q.error.message : "Falha ao carregar dados");
    }
  }, [q.isError, q.error]);

  return q;
}

export const useEmpresas = () =>
  useApiQuery<Empresa[]>(["empresas"], "/api/empresas");

/** Filiais de uma empresa — para o seletor de filial (só quando há 1 empresa). */
export const useFiliais = (empresa: number | null) =>
  useApiQuery<Filial[]>(
    ["filiais", empresa],
    `/api/empresas/estabs?empresa=${empresa}`,
    empresa != null
  );

export const useOverview = (qs: string, enabled = true) =>
  useApiQuery<Overview>(["overview", qs], `/api/fiscal/overview?${qs}`, enabled);

export const useTimeseries = (qs: string, enabled = true) =>
  useApiQuery<Timeseries>(["timeseries", qs], `/api/fiscal/timeseries?${qs}`, enabled);

export const useEspecies = (qs: string, enabled = true) =>
  useApiQuery<EspecieResumo[]>(["especies", qs], `/api/fiscal/especies?${qs}`, enabled);

export const useTopEmpresas = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<TopItem[]>(
    ["top-empresas", qs, tipo, metrica],
    `/api/fiscal/top-empresas?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useTopPessoas = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<TopItem[]>(
    ["top-pessoas", qs, tipo, metrica],
    `/api/fiscal/top-pessoas?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useEstados = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<EstadoResumo[]>(
    ["estados", qs, tipo],
    `/api/fiscal/estados?${qs}&tipo=${tipo}`,
    enabled
  );

export const useProdutos = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<ProdutoTop[]>(
    ["produtos", qs, tipo, metrica],
    `/api/fiscal/produtos?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useCfops = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<CfopResumo[]>(
    ["cfops", qs, tipo, metrica],
    `/api/fiscal/cfops?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useImpostos = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<Impostos>(
    ["impostos", qs, tipo],
    `/api/fiscal/impostos?${qs}&tipo=${tipo}`,
    enabled
  );

export const useDevolucoes = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<TopItem[]>(
    ["devolucoes", qs, tipo, metrica],
    `/api/fiscal/devolucoes?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useImpostosSerie = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<ImpostosSerie>(
    ["impostos-serie", qs, tipo],
    `/api/fiscal/impostos-serie?${qs}&tipo=${tipo}`,
    enabled
  );

export const useNotasLista = (
  qs: string,
  tipo: "ent" | "sai",
  page: number,
  busca: string,
  situacao: "todas" | "normais" | "canceladas",
  pessoa: number | null,
  enabled = true,
  // Cada módulo serve o explorador pela sua própria rota (gate por módulo). A
  // query é a mesma; muda só o caminho.
  modulo: "fiscal" | "contabil" = "fiscal"
) =>
  useApiQuery<NotasListaResp>(
    ["notas-lista", modulo, qs, tipo, page, busca, situacao, pessoa],
    `/api/${modulo}/notas-lista?${qs}&tipo=${tipo}&page=${page}&busca=${encodeURIComponent(busca)}&situacao=${situacao}${pessoa != null ? `&pessoa=${pessoa}` : ""}`,
    enabled
  );

export const useContrapartes = (
  qs: string,
  tipo: "ent" | "sai",
  q: string,
  page: number,
  enabled = true,
  modulo: "fiscal" | "contabil" = "fiscal"
) =>
  useApiQuery<ContrapartesResp>(
    ["contrapartes", modulo, qs, tipo, q, page],
    `/api/${modulo}/contrapartes?${qs}&tipo=${tipo}&q=${encodeURIComponent(q)}&page=${page}`,
    enabled
  );

export const useNotaItens = (
  tipo: "ent" | "sai",
  empresa: number | null,
  chave: string | null,
  // Cada módulo serve os itens pela sua própria rota (gate por módulo). A query
  // é a mesma; muda só o caminho.
  modulo: "fiscal" | "contabil" = "fiscal"
) =>
  useApiQuery<NotaItem[]>(
    ["nota-itens", modulo, tipo, empresa, chave],
    `/api/${modulo}/nota-itens?tipo=${tipo}&empresa=${empresa}&chave=${chave}`,
    empresa != null && chave != null
  );

export const useImpostosEmpresas = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<TopItem[]>(
    ["impostos-empresas", qs, tipo],
    `/api/fiscal/impostos-empresas?${qs}&tipo=${tipo}`,
    enabled
  );

export const useMunicipios = (qs: string, tipo: "ent" | "sai", metrica: Metrica) =>
  useApiQuery<TopItem[]>(
    ["municipios", qs, tipo, metrica],
    `/api/fiscal/municipios?${qs}&tipo=${tipo}&metrica=${metrica}`
  );

export const useFrete = (qs: string, tipo: "ent" | "sai", metrica: Metrica) =>
  useApiQuery<TopItem[]>(
    ["frete", qs, tipo, metrica],
    `/api/fiscal/frete?${qs}&tipo=${tipo}&metrica=${metrica}`
  );

export const useFaixasValor = (qs: string, tipo: "ent" | "sai", metrica: Metrica) =>
  useApiQuery<TopItem[]>(
    ["faixas-valor", qs, tipo, metrica],
    `/api/fiscal/faixas-valor?${qs}&tipo=${tipo}&metrica=${metrica}`
  );

export const useOrigem = (qs: string, tipo: "ent" | "sai", metrica: Metrica) =>
  useApiQuery<TopItem[]>(
    ["origem", qs, tipo, metrica],
    `/api/fiscal/origem?${qs}&tipo=${tipo}&metrica=${metrica}`
  );

export const useDevolucoesResumo = (qs: string, enabled = true) =>
  useApiQuery<DevolucoesResumo>(
    ["devolucoes-resumo", qs],
    `/api/fiscal/devolucoes-resumo?${qs}`,
    enabled
  );

export const useDevolucoesSerie = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<PontoValorSerie>(
    ["devolucoes-serie", qs, tipo],
    `/api/fiscal/devolucoes-serie?${qs}&tipo=${tipo}`,
    enabled
  );

export const useDevolucoesContrapartes = (
  qs: string,
  tipo: "ent" | "sai",
  metrica: Metrica,
  enabled = true
) =>
  useApiQuery<TopItem[]>(
    ["devolucoes-contrapartes", qs, tipo, metrica],
    `/api/fiscal/devolucoes-contrapartes?${qs}&tipo=${tipo}&metrica=${metrica}`,
    enabled
  );

export const useCancelamentosResumo = (qs: string, enabled = true) =>
  useApiQuery<CancelamentosResumo>(
    ["cancelamentos-resumo", qs],
    `/api/fiscal/cancelamentos-resumo?${qs}`,
    enabled
  );

export const useCancelamentosSerie = (qs: string, tipo: "ent" | "sai", enabled = true) =>
  useApiQuery<PontoValorSerie>(
    ["cancelamentos-serie", qs, tipo],
    `/api/fiscal/cancelamentos-serie?${qs}&tipo=${tipo}`,
    enabled
  );

export const useProdutividade = (qs: string, enabled = true) =>
  useApiQuery<ColaboradorProd[]>(
    ["produtividade", qs],
    `/api/fiscal/produtividade?${qs}`,
    enabled
  );

export const useProdutividadeSerie = (qs: string, enabled = true) =>
  useApiQuery<ProdutividadeSerie>(
    ["produtividade-serie", qs],
    `/api/fiscal/produtividade-serie?${qs}`,
    enabled
  );

export const useProdutividadeCalendario = (qs: string, enabled = true) =>
  useApiQuery<ProdutividadeCalendario>(
    ["produtividade-calendario", qs],
    `/api/fiscal/produtividade-calendario?${qs}`,
    enabled
  );

export const useTurnover = (qs: string, enabled = true, modulo: "folha" | "rh" = "folha") =>
  useApiQuery<TurnoverResp>(["turnover", modulo, qs], `/api/${modulo}/turnover?${qs}`, enabled);

/** Custo de folha: remuneração calculada do período, por rubrica/tipo/setor/mês. */
export const useCustoFolha = (qs: string, enabled = true) =>
  useApiQuery<CustoFolhaResp>(["custo-folha", qs], `/api/folha/custo?${qs}`, enabled);

/** Conformidade eSocial: panorama por evento + admissões/rescisões pendentes. */
export const useConformidadeEsocial = (qs: string, enabled = true) =>
  useApiQuery<ConformidadeEsocialResp>(["esocial", qs], `/api/folha/esocial?${qs}`, enabled);

/** Controle de férias: quem tem férias vencidas (dobro) ou a vencer. */
export const useControleFerias = (qs: string, enabled = true) =>
  useApiQuery<ControleFeriasResp>(["ferias", qs], `/api/folha/ferias?${qs}`, enabled);

/** Opções dos filtros da Folha para a empresa (não muda com a seleção). */
export const useFolhaFiltros = (qs: string, enabled = true) =>
  useApiQuery<FolhaFiltros>(["folha-filtros", qs], `/api/folha/filtros?${qs}`, enabled);

/** Lista de admitidos/desligados no período (respeita os filtros avançados). */
export const useMovimentacoes = (qs: string, enabled = true, modulo: "folha" | "rh" = "folha") =>
  useApiQuery<FolhaMovimentacao[]>(
    ["movimentacoes", modulo, qs],
    `/api/${modulo}/movimentacoes?${qs}`,
    enabled
  );

/** Drill de uma quebra: as pessoas de um grupo (qs já traz dim e valor). */
export const useFolhaPessoas = (qs: string, enabled = true, modulo: "folha" | "rh" = "folha") =>
  useApiQuery<FolhaMovimentacao[]>(
    ["folha-pessoas", modulo, qs],
    `/api/${modulo}/pessoas?${qs}`,
    enabled
  );

/** Ficha de um colaborador — carregada quando o modal abre. A mesma ficha serve
 *  a Folha e o RH; o módulo escolhe a rota (o gate de empresa é de cada uma). */
export const useFicha = (
  empresa: number | null,
  contrato: number | null,
  modulo: "folha" | "rh" = "folha"
) =>
  useApiQuery<FolhaFicha>(
    ["ficha", modulo, empresa, contrato],
    `/api/${modulo}/funcionario?empresa=${empresa}&contrato=${contrato}`,
    empresa != null && contrato != null
  );

// ── Produtividade do DP (Folha) ─────────────────────────────────────────────

/** Ranking por colaborador + totais do período (avisos/rescisões/admissões/férias). */
export const useDpProdutividade = (qs: string, enabled = true) =>
  useApiQuery<DpResumo>(["dp-produtividade", qs], `/api/folha/dp-produtividade?${qs}`, enabled);

/** Detalhe de um dos quatro trabalhos do DP no período (uma linha por registro). */
export const useDpLista = (qs: string, tipo: DpTipo, enabled = true) =>
  useApiQuery<DpLinha[]>(
    ["dp-lista", tipo, qs],
    `/api/folha/dp-lista?${qs}&tipo=${tipo}`,
    enabled
  );

/** Quebra de um trabalho do DP: por empresa + série no tempo (aba do tipo). */
export const useDpQuebra = (qs: string, tipo: DpTipo, enabled = true) =>
  useApiQuery<DpQuebra>(
    ["dp-quebra", tipo, qs],
    `/api/folha/dp-quebra?${qs}&tipo=${tipo}`,
    enabled
  );

export const useConferencia = (qs: string, enabled = true) =>
  useApiQuery<ConferenciaResp>(
    ["conferencia", qs],
    `/api/contabil/conferencia?${qs}`,
    enabled
  );

/** Fechamento mensal: o semáforo com as checagens do mês. Custo zero. */
export const useFechamento = (qs: string, enabled = true) =>
  useApiQuery<FechamentoResp>(["fechamento", qs], `/api/contabil/fechamento?${qs}`, enabled);

/** Contas de controle: movimento patrimonial do mês repartido por origem. */
export const useContasControle = (qs: string, enabled = true) =>
  useApiQuery<ContasControleResp>(
    ["contas-controle", qs],
    `/api/contabil/contas-controle?${qs}`,
    enabled
  );

/** Provisões: folha calculada × contábil lançado, com a divergência. */
export const useProvisoes = (qs: string, enabled = true) =>
  useApiQuery<ProvisoesResp>(["provisoes", qs], `/api/contabil/provisoes?${qs}`, enabled);

/** Auditoria: lançamentos com anomalia no período, agrupados por tipo de achado. */
export const useAuditoria = (qs: string, enabled = true) =>
  useApiQuery<AuditoriaResp>(["auditoria", qs], `/api/contabil/auditoria?${qs}`, enabled);

/** Central de Pendências: Conferência + Auditoria numa fila só, com a triagem. */
export const usePendencias = (qs: string, enabled = true) =>
  useApiQuery<PendenciasResp>(["pendencias", qs], `/api/contabil/pendencias?${qs}`, enabled);

/**
 * Triar uma pendência (resolver/ignorar/reabrir): grava e invalida a fila para
 * refletir o novo estado. O componente cuida do "gravando" por linha e do toast.
 */
export function useTriarPendencia() {
  const qc = useQueryClient();
  return (input: {
    empresa: number;
    fonte: string;
    chave: string;
    tipo: string;
    status: "resolvido" | "ignorado" | "reabrir";
    observacao?: string;
  }) =>
    mutar("/api/contabil/pendencias/triagem", "POST", input).then(() =>
      qc.invalidateQueries({ queryKey: ["pendencias"] })
    );
}

export const useBalanceteFiscal = (qs: string, enabled = true) =>
  useApiQuery<BalanceteFiscalResp>(
    ["balancete-fiscal", qs],
    `/api/contabil/balancete-fiscal?${qs}`,
    enabled
  );

export const useBalanceteContabil = (qs: string, enabled = true) =>
  useApiQuery<BalanceteContabilResp>(
    ["balancete-contabil", qs],
    `/api/contabil/balancete-contabil?${qs}`,
    enabled
  );

/**
 * Análise de Balancete — motor DETERMINÍSTICO (sem IA, custo zero). Roda no
 * Executar. Cache eterno por período; troca de filtro = nova análise.
 */
export function useAnaliseBalancete(qs: string, enabled = true) {
  const q = useQuery<AnaliseBalanceteResp>({
    queryKey: ["analise-balancete", qs],
    queryFn: () => fetchJson<AnaliseBalanceteResp>(`/api/contabil/analise-balancete?${qs}`),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (q.isError) {
      toast.error(q.error instanceof Error ? q.error.message : "Falha ao gerar a análise");
    }
  }, [q.isError, q.error]);

  return q;
}

/**
 * Laudo ESCRITO por IA — opcional. Só dispara quando `enabled` liga (o botão
 * "Gerar laudo escrito"); cache eterno, então clicar de novo não regasta API.
 */
export function useLaudoEscrito(qs: string, enabled: boolean) {
  const q = useQuery<LaudoEscritoResp>({
    queryKey: ["analise-laudo", qs],
    queryFn: () => fetchJson<LaudoEscritoResp>(`/api/contabil/analise-balancete/laudo?${qs}`),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (q.isError) {
      toast.error(q.error instanceof Error ? q.error.message : "Falha ao gerar o laudo");
    }
  }, [q.isError, q.error]);

  return q;
}

export const useBalanceteLancamentos = (
  qs: string,
  classif: string | null,
  natureza: 1 | -1,
  // "real" = lançamentos do contábil; "fiscal" = o esperado pelas regras (motor).
  lado: "real" | "fiscal" = "real",
  // Linha analítica escopa pela própria conta; sintética, pela subárvore.
  conta = 0,
  sintetica = false
) =>
  useApiQuery<BalanceteLancamentosResp>(
    ["balancete-lancamentos", lado, qs, classif, natureza, conta, sintetica],
    `/api/contabil/balancete${lado === "fiscal" ? "-fiscal" : ""}-lancamentos?${qs}&classif=${encodeURIComponent(classif ?? "")}&natureza=${natureza}&conta=${conta}&sintetica=${sintetica ? 1 : 0}`,
    classif != null
  );

export const useBalanceteCulpados = (
  qs: string,
  classif: string | null,
  conta: number,
  sintetica: boolean
) =>
  useApiQuery<BalanceteCulpadosResp>(
    ["balancete-culpados", qs, classif, conta, sintetica],
    `/api/contabil/balancete-culpados?${qs}&classif=${encodeURIComponent(classif ?? "")}&conta=${conta}&sintetica=${sintetica ? 1 : 0}`,
    classif != null
  );

export const useTributosDifal = (qs: string, enabled = true) =>
  useApiQuery<TopItem[]>(["tributos-difal", qs], `/api/fiscal/tributos-difal?${qs}`, enabled);

export const useTributosCst = (qs: string, enabled = true) =>
  useApiQuery<TopItem[]>(["tributos-cst", qs], `/api/fiscal/tributos-cst?${qs}`, enabled);

export const useTributosCargaEmpresas = (qs: string, enabled = true) =>
  useApiQuery<TributosCargaEmpresa[]>(
    ["tributos-carga-empresas", qs],
    `/api/fiscal/tributos-carga-empresas?${qs}`,
    enabled
  );

export const useConformidade = (qs: string, enabled = true) =>
  useApiQuery<ConformidadeResumo>(
    ["conformidade", qs],
    `/api/fiscal/conformidade?${qs}`,
    enabled
  );

export const useConformidadeEmpresas = (qs: string, enabled = true) =>
  useApiQuery<ConformidadeEmpresa[]>(
    ["conformidade-empresas", qs],
    `/api/fiscal/conformidade-empresas?${qs}`,
    enabled
  );

export const useCancelamentosRanking = (
  qs: string,
  tipo: "ent" | "sai",
  por: "empresa" | "especie",
  enabled = true
) =>
  useApiQuery<TopItem[]>(
    ["cancelamentos-ranking", qs, tipo, por],
    `/api/fiscal/cancelamentos-ranking?${qs}&tipo=${tipo}&por=${por}`,
    enabled
  );

/** Plano de contabilização: configuração fixa da empresa, sem período. */
export const usePlano = (qs: string, enabled = true) =>
  useApiQuery<PlanoResp>(["plano", qs], `/api/contabil/plano?${qs}`, enabled);

/** Preview da replicação de overrides: o que iria da origem pro destino. */
export const useReplicarPreview = (origem: number | null, destino: number | null) =>
  useApiQuery<ReplicarPreviewResp>(
    ["plano-replicar", origem, destino],
    `/api/contabil/plano/replicar?origem=${origem}&destino=${destino}`,
    origem != null && destino != null
  );

// ── RH ───────────────────────────────────────────────────────────────────────

/** Diretório: todos os funcionários ativos das duas empresas (filtra no cliente). */
export const useRhFuncionarios = (enabled = true) =>
  useApiQuery<FuncionarioDiretorio[]>(["rh-funcionarios"], `/api/rh/funcionarios`, enabled);

/** Setores reais (organograma) com funcionários ativos. */
export const useRhSetores = () => useApiQuery<SetorRh[]>(["rh-setores"], `/api/rh/setores`);

/** Gestores cadastrados (todos, ou de um setor via qs). */
export const useRhGestores = (qs = "") =>
  useApiQuery<GestorRh[]>(["rh-gestores", qs], `/api/rh/gestores${qs ? `?${qs}` : ""}`);

/** Painel de experiência: marcos de 45/90 dos contratos em curso. */
export const useRhExperiencia = (qs = "", enabled = true) =>
  useApiQuery<ExperienciaItem[]>(
    ["rh-experiencia", qs],
    `/api/rh/experiencia${qs ? `?${qs}` : ""}`,
    enabled
  );

/** Formulários montados no builder (lista, sem os campos). */
export const useFormularios = () =>
  useApiQuery<FormularioResumo[]>(["rh-formularios"], `/api/rh/formularios`);

/** Um formulário com seus campos (para o editor). */
export const useFormulario = (id: number | null) =>
  useApiQuery<Formulario>(["rh-formulario", id], `/api/rh/formularios?id=${id}`, id != null);

/** Config da experiência: formulário e antecedência por marco (+ forms ativos). */
export interface ExperienciaConfigResp {
  config: { marco: 45 | 90; formularioId: number; diasAntes: number }[];
  formularios: FormularioResumo[];
}
export const useExperienciaConfig = () =>
  useApiQuery<ExperienciaConfigResp>(["rh-experiencia-config"], `/api/rh/experiencia-config`);

/** Respostas de uma avaliação de experiência (por id), para o modal de leitura. */
export const useExperienciaResposta = (id: number | null) =>
  useApiQuery<RespostaExperienciaDetalhe>(
    ["rh-experiencia-resposta", id],
    `/api/rh/experiencia-respostas?id=${id}`,
    id != null
  );

/** Campanhas de envio (lista) e detalhe de uma (com respostas). */
export const useEnvios = () => useApiQuery<EnvioResumo[]>(["rh-envios"], `/api/rh/envios`);
export const useEnvio = (id: number | null) =>
  useApiQuery<EnvioDetalhe>(["rh-envio", id], `/api/rh/envios?id=${id}`, id != null);

/** Regras de envio automático recorrente. */
export const useEnvioRegras = () =>
  useApiQuery<EnvioRegra[]>(["rh-envio-regras"], `/api/rh/envio-regras`);

// ── Canal de denúncia + Clima (avaliação anônima) ────────────────────────────

export interface DenunciasResp {
  denuncias: DenunciaResumo[];
  dashboard: DenunciaDashboard;
}
/** Fila de denúncias + mini-dashboard (aceita ?status=&categoria= no qs). */
export const useDenuncias = (qs = "") =>
  useApiQuery<DenunciasResp>(["rh-denuncias", qs], `/api/rh/denuncias${qs ? `?${qs}` : ""}`);
/** Detalhe de uma denúncia (relato + thread), para o painel de tratativa. */
export const useDenuncia = (id: number | null) =>
  useApiQuery<DenunciaDetalhe>(["rh-denuncia", id], `/api/rh/denuncias?id=${id}`, id != null);

/** Rodadas de clima (lista com contagem de respostas). */
export const useRodadasClima = () =>
  useApiQuery<{ rodadas: RodadaResumo[] }>(["rh-clima-rodadas"], `/api/rh/clima`);
/** Dashboard de uma rodada de clima (respostas anônimas do formulário da rodada). */
export const useClimaDashboard = (id: number | null) =>
  useApiQuery<ClimaDashboard>(["rh-clima", id], `/api/rh/clima?id=${id}`, id != null);
