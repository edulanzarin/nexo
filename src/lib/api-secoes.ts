import type { ModuloId } from "./modulos";

/**
 * Registro ÚNICO endpoint -> seção(ões) dona(s). É o que deixa o gate do
 * `apiRoute` ser fino por seção mesmo com as rotas namespaceadas só por módulo
 * (e algumas compartilhadas — `/api/fiscal/impostos` serve Painel e Tributos).
 *
 * Regra do gate: libera se ALGUMA seção dona satisfaz o nível pedido. Endpoint
 * não listado cai no gate de módulo (seguro: exige acesso a alguma seção do
 * módulo). Mantido à mão de propósito — a fronteira de permissão não deve
 * depender de heurística de nome.
 *
 * A chave é o PRIMEIRO segmento após `/api/<modulo>/` (ex.: `plano/replicar`
 * casa por `plano`).
 */
const MAPA: Record<ModuloId, Record<string, string[]>> = {
  fiscal: {
    // Painel
    overview: ["painel"],
    timeseries: ["painel"],
    especies: ["painel"],
    impostos: ["painel", "tributos"], // card reusado nas duas seções
    "impostos-serie": ["painel"],
    devolucoes: ["painel"],
    "devolucoes-resumo": ["painel"],
    "devolucoes-serie": ["painel"],
    "devolucoes-contrapartes": ["painel"],
    "cancelamentos-resumo": ["painel"],
    "cancelamentos-serie": ["painel"],
    "cancelamentos-ranking": ["painel"],
    // Análises
    "top-empresas": ["analises"],
    "top-pessoas": ["analises"],
    estados: ["analises"],
    produtos: ["analises"],
    cfops: ["analises"],
    municipios: ["analises"],
    frete: ["analises"],
    "faixas-valor": ["analises"],
    origem: ["analises"],
    // Tributos
    "tributos-difal": ["tributos"],
    "tributos-cst": ["tributos"],
    "tributos-carga-empresas": ["tributos"],
    "impostos-empresas": ["tributos"],
    // Produtividade
    produtividade: ["produtividade"],
    "produtividade-serie": ["produtividade"],
    "produtividade-calendario": ["produtividade"],
    // Conformidade
    conformidade: ["conformidade"],
    "conformidade-empresas": ["conformidade"],
    // Dados
    "notas-lista": ["dados"],
    "nota-itens": ["dados"],
    contrapartes: ["dados"],
  },
  contabil: {
    // Notas (explorador)
    "notas-lista": ["notas"],
    "nota-itens": ["notas"],
    contrapartes: ["notas"],
    // Conferência (+ aba Configuração do plano de contabilização)
    conferencia: ["conferencia"],
    "auditoria-duplicadas": ["conferencia"],
    plano: ["conferencia"],
    aprender: ["conferencia"],
    // Balancete
    "balancete-fiscal": ["balancete"],
    "balancete-fiscal-lancamentos": ["balancete"],
    "balancete-lancamentos": ["balancete"],
    "balancete-culpados": ["balancete"],
    "bf-check": ["balancete"],
    // Balancete de verificação contábil + Análise (abas da mesma seção "analise")
    "balancete-contabil": ["analise"],
    "analise-balancete": ["analise"],
    // Conciliação (+ aba Regras)
    "extrato-importar": ["conciliacao"],
    "extrato-regras": ["conciliacao"],
    // Fechamento mensal (orquestra as checagens; seção própria)
    fechamento: ["fechamento"],
    // Contas de controle (composição do saldo por origem; seção própria)
    "contas-controle": ["controle"],
    // Provisões (folha calculada × contábil lançado; lê folha, mas é seção do contábil)
    provisoes: ["provisoes"],
    // Implantação de saldos (todas as sub-rotas casam pelo 1º segmento)
    implantacao: ["implantacao"],
    // Auditoria de lançamentos (varredura do lctoctb; seção própria)
    auditoria: ["auditoria"],
    // Central de Pendências (Conferência + Auditoria numa fila; triagem grava no app-db)
    pendencias: ["pendencias"],
    // Lookup de contas: usado na Configuração, na Conciliação e na Implantação
    contas: ["conferencia", "conciliacao", "implantacao"],
  },
  folha: {
    // Painel (home do módulo): retrato do escritório, sem filtros.
    painel: ["painel"],
    filtros: ["rotatividade"],
    funcionario: ["rotatividade"],
    movimentacoes: ["rotatividade"],
    pessoas: ["rotatividade"],
    turnover: ["rotatividade"],
    // Produtividade do DP
    "dp-produtividade": ["produtividade"],
    "dp-lista": ["produtividade"],
    "dp-quebra": ["produtividade"],
    // Custo de Folha (remuneração calculada por rubrica/tipo/setor)
    custo: ["custo"],
    // Conformidade eSocial (transmissão de eventos)
    esocial: ["esocial"],
    // Controle de férias (vencidas / a vencer)
    ferias: ["ferias"],
    // Controle de rescisões a pagar (todas as sub-rotas casam pelo 1º segmento:
    // rescisoes, rescisoes/resolver). Config e destinatários têm 1º segmento próprio.
    rescisoes: ["rescisoes"],
    "rescisoes-config": ["rescisoes"],
    "rescisoes-destinatarios": ["rescisoes"],
    // /api/folha/cron/rescisoes é público (segredo próprio) — NÃO passa por apiRoute.
    // Relatório Post Mortem: analista (post-mortem) e gestor (post-mortem-gestao)
    // batem no mesmo endpoint; o handler recorta por dono (meus x todos).
    "post-mortem": ["post-mortem", "post-mortem-gestao"],
  },
  rh: {
    // Diretório
    funcionarios: ["diretorio"],
    funcionario: ["diretorio", "rotatividade"], // ficha reusada no drill da rotatividade
    "pessoa-pj": ["diretorio"], // CRUD das pessoas PJ (não existem no Questor)
    "funcionario-override": ["diretorio"], // correções sobre um funcionário do Questor
    setor: ["diretorio", "gestores"], // CRUD de setor próprio / renomear (singular)
    setores: ["diretorio", "gestores"], // lista de setores serve filtro e cadastro
    // Experiência
    experiencia: ["experiencia"],
    "experiencia-reenviar": ["experiencia"],
    "experiencia-respostas": ["experiencia"], // ler as respostas de uma avaliação
    "experiencia-config": ["experiencia", "formularios"], // config da experiência
    // Formulários (builder) e campanhas de envio
    formularios: ["formularios"],
    envios: ["formularios"],
    // Canal de denúncia (fila + tratativa + dashboard). Sub-rotas casam pelo 1º segmento.
    denuncias: ["denuncias"],
    // Clima (avaliação anônima): rodadas + dashboard.
    clima: ["clima"],
    // Gestores
    gestores: ["gestores"],
    // Rotatividade (reusa libs da Folha, rotas próprias do módulo)
    turnover: ["rotatividade"],
    filtros: ["rotatividade"],
    movimentacoes: ["rotatividade"],
    pessoas: ["rotatividade"],
    // /api/rh/cron/experiencia é público (segredo próprio) — NÃO passa por apiRoute.
  },
  // Configurações não tem rotas de API: o CRUD roda por Server Action (gateada
  // por assertSecao). Mapa vazio; nenhum endpoint /api/config existe.
  config: {},
};

/**
 * Seções donas do endpoint, ou `undefined` se não mapeado (cai no gate de
 * módulo). `segmentos` é o resto do path após `/api/<modulo>/`.
 */
export function secoesDoEndpoint(modulo: ModuloId, segmentos: string): string[] | undefined {
  const primeiro = segmentos.split("/")[0];
  return MAPA[modulo]?.[primeiro];
}
