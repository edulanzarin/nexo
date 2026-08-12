import "server-only";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import {
  criticidadeValida,
  fatoresVazio,
  impactosVazio,
  validarEnvio,
  type Criticidade,
  type DadosPM,
  type GrupoOpcao,
  type RelatorioPM,
  type ResumoPM,
  type StatusPM,
} from "./folha-postmortem-tipos";

/**
 * Acesso a dados do Relatório Post Mortem (banco do APP, gravável). A posse é do
 * autor: as consultas de "meus" filtram por autor_id; as de "todos" (gestor) não.
 * Quem decide qual usar é o handler da rota, pela seção da sessão.
 */

// As colunas editáveis, na ordem em que salvar/enviar passam os valores.
const COLS_EDITAVEIS = [
  "criticidade",
  "grupo_id",
  "empresa_afetada",
  "funcionarios_afetados",
  "processo",
  "data_ocorrido",
  "data_identificado",
  "quem_identificou",
  "como_identificou",
  "descricao",
  "linha_tempo",
  "impactos",
  "cinco_porques",
  "fatores",
  "causa_raiz",
  "acoes_corretivas",
  "acoes_preventivas",
  "licoes",
] as const;

// Vira `[valores...]` na mesma ordem de COLS_EDITAVEIS. jsonb vai como texto
// (JSON.stringify) — o pg não serializa objeto/array sozinho. Texto vazio vira
// null pra não guardar string em branco onde o certo é "não preenchido".
function valoresEditaveis(d: DadosPM): unknown[] {
  const t = (s: string) => (s.trim() ? s.trim() : null);
  return [
    d.criticidade,
    d.grupoId,
    t(d.empresaAfetada),
    d.funcionariosAfetados,
    t(d.processo),
    d.dataOcorrido,
    d.dataIdentificado,
    t(d.quemIdentificou),
    t(d.comoIdentificou),
    t(d.descricao),
    JSON.stringify(d.linhaTempo ?? []),
    JSON.stringify(d.impactos ?? impactosVazio()),
    JSON.stringify(d.cincoPorques ?? []),
    JSON.stringify(d.fatores ?? fatoresVazio()),
    t(d.causaRaiz),
    JSON.stringify(d.acoesCorretivas ?? []),
    JSON.stringify(d.acoesPreventivas ?? []),
    t(d.licoes),
  ];
}

interface LinhaBanco {
  id: number;
  numero: number | null;
  status: StatusPM;
  autor_id: string;
  autor_nome: string;
  criticidade: string | null;
  grupo_id: number | null;
  grupo_nome: string | null;
  empresa_afetada: string | null;
  funcionarios_afetados: number | null;
  processo: string | null;
  data_ocorrido: string | null;
  data_identificado: string | null;
  quem_identificou: string | null;
  como_identificou: string | null;
  descricao: string | null;
  linha_tempo: RelatorioPM["linhaTempo"] | null;
  impactos: RelatorioPM["impactos"] | null;
  cinco_porques: string[] | null;
  fatores: RelatorioPM["fatores"] | null;
  causa_raiz: string | null;
  acoes_corretivas: RelatorioPM["acoesCorretivas"] | null;
  acoes_preventivas: RelatorioPM["acoesPreventivas"] | null;
  licoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

// Sempre 5 posições nos "porquês" — o form conta com isso mesmo em relatório antigo.
function cincoPorques(arr: string[] | null): string[] {
  const base = arr ?? [];
  return Array.from({ length: 5 }, (_, i) => base[i] ?? "");
}

function paraRelatorio(r: LinhaBanco): RelatorioPM {
  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    autorId: r.autor_id,
    autorNome: r.autor_nome,
    grupoNome: r.grupo_nome,
    criticidade: criticidadeValida(r.criticidade) ? r.criticidade : null,
    grupoId: r.grupo_id,
    empresaAfetada: r.empresa_afetada ?? "",
    funcionariosAfetados: r.funcionarios_afetados,
    processo: r.processo ?? "",
    dataOcorrido: r.data_ocorrido,
    dataIdentificado: r.data_identificado,
    quemIdentificou: r.quem_identificou ?? "",
    comoIdentificou: r.como_identificou ?? "",
    descricao: r.descricao ?? "",
    linhaTempo: r.linha_tempo ?? [],
    impactos: r.impactos ?? impactosVazio(),
    cincoPorques: cincoPorques(r.cinco_porques),
    fatores: r.fatores ?? fatoresVazio(),
    causaRaiz: r.causa_raiz ?? "",
    acoesCorretivas: r.acoes_corretivas ?? [],
    acoesPreventivas: r.acoes_preventivas ?? [],
    licoes: r.licoes ?? "",
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

const SELECT_COMPLETO = `
  select pm.*, u.nome as autor_nome, g.nome as grupo_nome
    from folha_postmortem pm
    join usuario u on u.id = pm.autor_id
    left join grupo_empresarial g on g.id = pm.grupo_id`;

/** Um relatório completo, ou null. A checagem de posse é do handler. */
export async function obterPostMortem(id: number): Promise<RelatorioPM | null> {
  const rows = await appQuery<LinhaBanco>(`${SELECT_COMPLETO} where pm.id = $1`, [id]);
  return rows[0] ? paraRelatorio(rows[0]) : null;
}

interface FiltroLista {
  criticidade?: Criticidade | null;
  grupoId?: number | null;
  status?: StatusPM | null;
}

const SELECT_RESUMO = `
  select pm.id, pm.numero, pm.status, pm.criticidade, pm.empresa_afetada,
         pm.processo, pm.data_ocorrido, pm.atualizado_em,
         u.nome as autor_nome, g.nome as grupo_nome
    from folha_postmortem pm
    join usuario u on u.id = pm.autor_id
    left join grupo_empresarial g on g.id = pm.grupo_id`;

function paraResumo(r: LinhaBanco): ResumoPM {
  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    criticidade: criticidadeValida(r.criticidade) ? r.criticidade : null,
    empresaAfetada: r.empresa_afetada ?? "",
    grupoNome: r.grupo_nome,
    autorNome: r.autor_nome,
    processo: r.processo ?? "",
    dataOcorrido: r.data_ocorrido,
    atualizadoEm: r.atualizado_em,
  };
}

/** Os relatórios de um autor (a lista do analista). */
export async function listarMeus(autorId: string): Promise<ResumoPM[]> {
  const rows = await appQuery<LinhaBanco>(
    `${SELECT_RESUMO} where pm.autor_id = $1 order by pm.atualizado_em desc`,
    [autorId]
  );
  return rows.map(paraResumo);
}

/** Todos os relatórios (a lista do gestor), com filtros opcionais. */
export async function listarTodos(f: FiltroLista = {}): Promise<ResumoPM[]> {
  const cond: string[] = [];
  const vals: unknown[] = [];
  if (f.status) {
    vals.push(f.status);
    cond.push(`pm.status = $${vals.length}`);
  }
  if (f.criticidade) {
    vals.push(f.criticidade);
    cond.push(`pm.criticidade = $${vals.length}`);
  }
  if (f.grupoId) {
    vals.push(f.grupoId);
    cond.push(`pm.grupo_id = $${vals.length}`);
  }
  const where = cond.length ? `where ${cond.join(" and ")}` : "";
  // Enviados primeiro por nº decrescente; rascunhos (numero null) ao fim.
  const rows = await appQuery<LinhaBanco>(
    `${SELECT_RESUMO} ${where} order by pm.numero desc nulls last, pm.atualizado_em desc`,
    vals
  );
  return rows.map(paraResumo);
}

/** Cria um rascunho vazio do autor e devolve o id (para abrir o formulário). */
export async function criarPostMortem(autorId: string): Promise<number> {
  const rows = await appQuery<{ id: number }>(
    `insert into folha_postmortem (autor_id) values ($1) returning id`,
    [autorId]
  );
  return rows[0].id;
}

/** Salva o rascunho (só o dono, só enquanto rascunho). Lança se não aplicou. */
export async function salvarPostMortem(id: number, autorId: string, dados: DadosPM): Promise<void> {
  const sets = COLS_EDITAVEIS.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const base = valoresEditaveis(dados);
  const rows = await appQuery<{ id: number }>(
    `update folha_postmortem set ${sets}
       where id = $${base.length + 1} and autor_id = $${base.length + 2} and status = 'rascunho'
       returning id`,
    [...base, id, autorId]
  );
  if (!rows[0]) throw new FilterError("Relatório não encontrado ou já enviado");
}

/**
 * Envia: grava o corpo, cobra os campos essenciais, aloca o nº sequencial e
 * fecha (status enviado). Só o dono, só a partir de rascunho. Devolve o número.
 */
export async function enviarPostMortem(
  id: number,
  autorId: string,
  dados: DadosPM
): Promise<number> {
  const faltando = validarEnvio(dados);
  if (faltando.length) {
    throw new FilterError(`Preencha antes de enviar: ${faltando.join(", ")}`);
  }
  const sets = COLS_EDITAVEIS.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const base = valoresEditaveis(dados);
  const rows = await appQuery<{ numero: number }>(
    `update folha_postmortem
        set ${sets},
            numero = nextval('folha_postmortem_numero_seq'),
            status = 'enviado'
      where id = $${base.length + 1} and autor_id = $${base.length + 2} and status = 'rascunho'
      returning numero`,
    [...base, id, autorId]
  );
  if (!rows[0]) throw new FilterError("Relatório não encontrado ou já enviado");
  return rows[0].numero;
}

/** Exclui um rascunho do próprio autor (relatório enviado não se apaga). */
export async function excluirPostMortem(id: number, autorId: string): Promise<void> {
  const rows = await appQuery<{ id: number }>(
    `delete from folha_postmortem
       where id = $1 and autor_id = $2 and status = 'rascunho' returning id`,
    [id, autorId]
  );
  if (!rows[0]) throw new FilterError("Rascunho não encontrado (enviado não se exclui)");
}

/** Grupos de empresa (admin) para o seletor do formulário. */
export async function listarGruposPostMortem(): Promise<GrupoOpcao[]> {
  return appQuery<GrupoOpcao>(`select id, nome from grupo_empresarial order by nome`);
}
