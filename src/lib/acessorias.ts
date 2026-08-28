import "server-only";

/**
 * Cliente da API do Acessórias — o sistema onde o escritório controla as
 * obrigações entregues ao cliente. É a primeira fonte do Nexo que NÃO é o
 * Questor: entra por HTTP, não por SQL, e por isso traz limites que uma query
 * não tem.
 *
 * Três coisas da API mandam no desenho e estão codificadas aqui:
 *
 *  1. **Teto de 100 req/min** (sliding window, HTTP 429). O cliente serializa e
 *     espaça as chamadas — é melhor uma varredura previsivelmente lenta que uma
 *     rápida que toma 429 no meio e volta pela metade.
 *  2. **Erro com HTTP 200.** Comportamento legado assumido na própria doc: parte
 *     dos erros volta 200 com uma chave `Erro` no corpo. Quem só olha o status
 *     engole a falha como sucesso, então a checagem é do CORPO.
 *  3. **`deliveries` exige o CNPJ no caminho** e não aceita `ListAll` (devolve
 *     204). Não existe varredura global: é uma chamada por empresa, e o CNPJ vai
 *     cru na URL — a barra dele é separador de caminho, encodar quebra.
 *
 * Não há webhook: nada avisa quando uma entrega muda. Quem quiser o dado fresco
 * varre de novo (ver `obrigacoes.ts`).
 */

const BASE = "https://api.acessorias.com";

/**
 * Espaçamento entre chamadas. O teto é 100/min; 90/min deixa folga para o
 * relógio do servidor não bater com o nosso e para outra integração dividir a
 * mesma cota.
 */
const INTERVALO_MS = 60_000 / 90;

export class AcessoriasErro extends Error {
  constructor(
    message: string,
    readonly caminho: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "AcessoriasErro";
  }
}

function token(): string {
  const t = process.env.ACESSORIAS_TOKEN?.trim();
  if (!t) {
    throw new AcessoriasErro(
      "Token do Acessórias não configurado — defina ACESSORIAS_TOKEN no ambiente.",
      "(config)"
    );
  }
  return t;
}

/**
 * Serializa as chamadas: a próxima só sai INTERVALO_MS depois da anterior. Um
 * `Promise` encadeado basta porque a varredura roda num processo só; não é um
 * limitador distribuído, e não precisa ser.
 */
let fila: Promise<unknown> = Promise.resolve();
function enfileirar<T>(fn: () => Promise<T>): Promise<T> {
  const proximo = fila.then(async () => {
    const r = await fn();
    await new Promise((res) => setTimeout(res, INTERVALO_MS));
    return r;
  });
  // A fila não pode morrer por causa de uma falha: encadeia o "depois", não o erro.
  fila = proximo.catch(() => {});
  return proximo;
}

/**
 * GET cru. Devolve `null` quando a API responde 204 (vazio) — que ela usa tanto
 * para "não tem nada" quanto para "esse identificador não serve aqui".
 */
async function get<T>(caminho: string, params?: Record<string, string>): Promise<T | null> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  // O caminho já vem montado com o CNPJ cru; só a query é encodada.
  const url = `${BASE}${caminho}${qs}`;
  const auth = token();

  return enfileirar(async () => {
    let r: Response;
    try {
      r = await fetch(url, { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" });
    } catch (err) {
      throw new AcessoriasErro(`Falha de rede: ${(err as Error).message}`, caminho);
    }

    if (r.status === 204) return null;
    if (r.status === 429) {
      throw new AcessoriasErro("Limite de requisições excedido (429)", caminho, 429);
    }
    if (!r.ok) {
      throw new AcessoriasErro(`HTTP ${r.status}`, caminho, r.status);
    }

    const texto = await r.text();
    if (!texto.trim()) return null;

    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new AcessoriasErro("Resposta não era JSON", caminho, r.status);
    }

    // Erro com 200: a falha vem no corpo, não no status.
    if (corpo && typeof corpo === "object" && !Array.isArray(corpo)) {
      const erro = (corpo as Record<string, unknown>).Erro;
      if (typeof erro === "string" && erro.trim()) {
        throw new AcessoriasErro(erro, caminho, r.status);
      }
    }
    return corpo as T;
  });
}

// ── Empresas ─────────────────────────────────────────────────────────────────

export interface EmpresaAcessorias {
  ID: string;
  Identificador: string;
  Razao: string;
  Status: string;
  DtLastDH?: string;
}

/**
 * Carteira inteira, página a página (20 por página) até vir vazio. `apenasAtivas`
 * filtra aqui e não na API: o parâmetro `ativa` existe, mas a lista completa
 * custa o mesmo e o status é útil no diagnóstico.
 */
export async function listarEmpresas(apenasAtivas = true): Promise<EmpresaAcessorias[]> {
  const todas: EmpresaAcessorias[] = [];
  for (let pagina = 1; ; pagina++) {
    const lote = await get<EmpresaAcessorias[]>("/companies/ListAll", { Pagina: String(pagina) });
    if (!lote?.length) break;
    todas.push(...lote);
    if (lote.length < 20) break;
  }
  return apenasAtivas ? todas.filter((e) => e.Status === "Ativa") : todas;
}

// ── Entregas ─────────────────────────────────────────────────────────────────

interface EntregaConfig {
  EntID?: string;
  DptoID?: string;
  DptoNome?: string;
  RespPrazo?: string;
  RespPrazoID?: string;
}

interface EntregaBruta {
  Nome?: string;
  EntCompetencia?: string;
  EntDtPrazo?: string;
  Status?: string;
  EntMulta?: string;
  Config?: EntregaConfig;
}

interface RespostaEntregas {
  Razao?: string;
  Entregas?: EntregaBruta[];
}

/** Uma entrega pendente, já normalizada. */
export interface EntregaPendente {
  entId: number;
  cnpj: string;
  empresa: string;
  obrigacao: string;
  competencia: string | null;
  prazo: string | null;
  status: string;
  multa: boolean;
  dptoId: number;
  dptoNome: string;
  respId: number | null;
  respNome: string | null;
}

/** "0000-00-00" e "" são o jeito do Acessórias dizer "não tem data". */
function data(v: string | undefined): string | null {
  if (!v || v.startsWith("0000")) return null;
  return v.slice(0, 10);
}

function inteiro(v: string | undefined): number | null {
  if (!v?.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/**
 * Entregas ACIONÁVEIS de uma empresa: `situation=pending`, que a API resolve
 * como "Atrasada!" + "Pendente". O resto do vocabulário (Dispensada, Ent.
 * atrasada, Prazo técnico…) fica de fora — é histórico, não fila.
 *
 * Sem `department_id`: filtrar por setor NÃO reduz o custo (o gargalo é uma
 * chamada por empresa), então traz todos os setores e o recorte é na leitura.
 * A flag `config` é o que traz setor e responsável — sem ela a linha não diz de
 * quem é.
 */
export async function entregasPendentes(
  cnpj: string,
  inicio: string,
  fim: string
): Promise<EntregaPendente[]> {
  const pendentes: EntregaPendente[] = [];

  for (let pagina = 1; ; pagina++) {
    const r = await get<RespostaEntregas>(`/deliveries/${cnpj}`, {
      DtInitial: inicio,
      DtFinal: fim,
      situation: "pending",
      config: "1",
      Pagina: String(pagina),
    });
    const lote = r?.Entregas ?? [];
    if (!lote.length) break;

    for (const e of lote) {
      const entId = inteiro(e.Config?.EntID);
      const dptoId = inteiro(e.Config?.DptoID);
      // Sem id de entrega não há chave estável, e sem setor a linha não serve ao
      // recorte que é o produto — descartar é melhor que gravar meia linha.
      if (entId == null || dptoId == null) continue;

      pendentes.push({
        entId,
        cnpj,
        empresa: r?.Razao?.trim() || cnpj,
        obrigacao: e.Nome?.trim() || "(sem nome)",
        competencia: data(e.EntCompetencia),
        prazo: data(e.EntDtPrazo),
        status: e.Status?.trim() || "(sem status)",
        multa: e.EntMulta === "S",
        dptoId,
        dptoNome: e.Config?.DptoNome?.trim() || `Setor ${dptoId}`,
        respId: inteiro(e.Config?.RespPrazoID),
        respNome: e.Config?.RespPrazo?.trim() || null,
      });
    }
    // Entregas paginam de 50 em 50.
    if (lote.length < 50) break;
  }

  return pendentes;
}

// ── Departamentos ────────────────────────────────────────────────────────────

export interface DepartamentoAcessorias {
  ID: string;
  Nome: string;
  IDPai?: string;
}

/** Setores do escritório, com a hierarquia (`IDPai`) como o Acessórias guarda. */
export async function listarDepartamentos(): Promise<DepartamentoAcessorias[]> {
  return (await get<DepartamentoAcessorias[]>("/departments/ListAll")) ?? [];
}
