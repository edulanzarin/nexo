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
 *  4. **Sob pressão, ela responde VAZIO em vez de 429.** Medido: varrendo a
 *     lista de empresas, páginas no meio do intervalo voltaram `[]` com HTTP
 *     200 e, repetidas na sequência, vieram cheias. É a pior falha possível —
 *     "não tem nada" e "não te respondo agora" ficam indistinguíveis, e quem
 *     interrompe na primeira página vazia trunca a carteira em silêncio. Por
 *     isso vazio aqui é SUSPEITA, não fim: confirma-se repetindo.
 *
 * Não há webhook: nada avisa quando uma entrega muda. Quem quiser o dado fresco
 * varre de novo (ver `obrigacoes.ts`).
 */

const BASE = "https://api.acessorias.com";

/**
 * Espaçamento entre chamadas. O teto é 100/min; 70/min deixa folga real — a
 * janela é deslizante e do lado deles, então encostar no limite é o que dispara
 * a resposta vazia silenciosa. Varredura previsivelmente mais lenta vale mais
 * que rápida e incompleta.
 */
const INTERVALO_MS = 60_000 / 70;

/**
 * Uma resposta vazia pode ser fim de lista OU throttle disfarçado. Confirma-se
 * repetindo: só é vazio de verdade quem repete vazio.
 */
const CONFIRMACOES_DE_VAZIO = 2;

/**
 * Teto de páginas da carteira. Não é o tamanho esperado — é a trava contra um
 * laço infinito se a API passar a devolver conteúdo para sempre. Medido em
 * ago/2026: acima de 1.500 empresas cadastradas, ~78 páginas de 20.
 */
const MAX_PAGINAS = 400;

/**
 * 429 não é erro do pedido, é "agora não" — e desistir na primeira faria a
 * empresa sumir da fila em silêncio, o mesmo mal do vazio disfarçado. Recua e
 * repete, dobrando a espera a cada vez.
 */
const TENTATIVAS_429 = 4;
const ESPERA_429_MS = 20_000;

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
 * Uma tentativa de GET. Devolve `null` no 204 (vazio) e o marcador `"429"` quando
 * o servidor recusa por limite — quem decide esperar e repetir é o `get`.
 */
async function tentarGet<T>(url: string, caminho: string): Promise<T | null | "429"> {
  const auth = token();

  return enfileirar(async () => {
    let r: Response;
    try {
      r = await fetch(url, { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" });
    } catch (err) {
      throw new AcessoriasErro(`Falha de rede: ${(err as Error).message}`, caminho);
    }

    if (r.status === 204) return null;
    if (r.status === 429) return "429" as const;
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

/**
 * GET com recuo no 429. Devolve `null` quando a API responde 204 (vazio) — que
 * ela usa tanto para "não tem nada" quanto para "esse identificador não serve
 * aqui". O limite não sobe como erro na primeira recusa: esperar é mais barato
 * que perder a empresa.
 */
async function get<T>(caminho: string, params?: Record<string, string>): Promise<T | null> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  // O caminho já vem montado com o CNPJ cru; só a query é encodada.
  const url = `${BASE}${caminho}${qs}`;

  for (let tentativa = 1; ; tentativa++) {
    const r = await tentarGet<T>(url, caminho);
    if (r !== "429") return r;
    if (tentativa >= TENTATIVAS_429) {
      throw new AcessoriasErro(
        `Limite de requisições excedido (429) após ${TENTATIVAS_429} tentativas`,
        caminho,
        429
      );
    }
    const espera = ESPERA_429_MS * 2 ** (tentativa - 1);
    console.warn(
      `[acessorias] 429 em ${caminho} — aguardando ${espera / 1000}s (tentativa ${tentativa})`
    );
    await new Promise((res) => setTimeout(res, espera));
  }
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
  // Deduplicado por identificador: a confirmação de vazio repete páginas, e
  // repetir não pode inflar a carteira.
  const porId = new Map<string, EmpresaAcessorias>();
  let vaziasSeguidas = 0;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const lote = await get<EmpresaAcessorias[]>("/companies/ListAll", { Pagina: String(pagina) });

    if (!lote?.length) {
      // Vazio é suspeita, não fim (ver armadilha 4). Só encerra depois de
      // páginas vazias CONSECUTIVAS confirmadas.
      vaziasSeguidas++;
      if (vaziasSeguidas >= CONFIRMACOES_DE_VAZIO) break;
      pagina--; // repete a mesma página
      continue;
    }

    vaziasSeguidas = 0;
    for (const e of lote) porId.set(e.Identificador, e);
    // Página curta também não é fim confiável aqui: seguimos até o vazio
    // confirmado, que é o único sinal que a API dá de verdade.
  }

  const todas = [...porId.values()];
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
  let vaziasSeguidas = 0;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const r = await get<RespostaEntregas>(`/deliveries/${cnpj}`, {
      DtInitial: inicio,
      DtFinal: fim,
      situation: "pending",
      config: "1",
      Pagina: String(pagina),
    });
    const lote = r?.Entregas ?? [];

    // Mesma armadilha 4, e aqui ela é mais traiçoeira que na lista de empresas:
    // um vazio engolido vira "esta empresa está em dia", que é uma afirmação
    // FORTE saindo de uma ausência de resposta. Confirma-se repetindo.
    if (!lote.length) {
      vaziasSeguidas++;
      if (vaziasSeguidas >= CONFIRMACOES_DE_VAZIO) break;
      pagina--;
      continue;
    }
    if (vaziasSeguidas > 0) {
      console.warn(
        `[acessorias] ${cnpj} pág.${pagina}: vazio não confirmado (throttle disfarçado) — a resposta veio cheia na repetição`
      );
    }
    vaziasSeguidas = 0;

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
    // Sem atalho por "página curta": só o vazio CONFIRMADO encerra. Uma página
    // com menos de 50 pode ser a última — ou uma resposta parcial sob pressão.
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
