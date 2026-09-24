import "server-only";
import type { BalanceteContabil } from "./balancete-contabil";
import type { AnaliseDeterministica } from "./types";

/**
 * Camada OPCIONAL de IA: redige a prosa do laudo a partir do que o motor
 * determinístico (`analise-motor.ts`) já achou. Não recalcula nem julga regra —
 * só escreve. É o único ponto que gasta API, e roda sob demanda (botão "Gerar
 * laudo escrito"), então o dia a dia da análise é de graça.
 *
 * Provider: Groq (API OpenAI-compatível, tier grátis). SIGILO: nome e CNPJ da
 * empresa são CENSURADOS antes do envio — a IA recebe só o marcador [EMPRESA] e
 * nunca vê a identificação. O nome real é reposto no laudo que volta.
 */

const MODELO = process.env.ANALISE_MODELO?.trim() || "llama-3.3-70b-versatile";
const BASE_URL = process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
const MAX_TOKENS_LAUDO = 8000;

export class AnaliseError extends Error {}

const brl0 = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

// ── Censura da identificação (sigilo antes de mandar pra IA externa) ──────────

const PLACEHOLDER_EMPRESA = "[EMPRESA]";

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove a identificação da empresa (nome e CNPJ) ANTES do envio. Defesa em
 * profundidade: o payload já é montado com o placeholder, e este passe varre
 * qualquer ocorrência do nome que tenha escapado por outra via, além de mascarar
 * qualquer CNPJ/CPF que apareça no texto.
 */
function censurarIdentificacao(texto: string, nome: string): string {
  let out = texto;
  const n = nome.trim();
  if (n) out = out.replace(new RegExp(escaparRegex(n), "gi"), PLACEHOLDER_EMPRESA);
  // CNPJ formatado (00.000.000/0000-00) ou 14 dígitos crus; CPF formatado.
  out = out.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g, "[CNPJ]");
  out = out.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]");
  return out;
}

/** Repõe o nome real no laudo já pronto (a IA nunca o viu). */
function restaurarIdentificacao(texto: string, nome: string): string {
  const n = nome.trim();
  return n ? texto.split(PLACEHOLDER_EMPRESA).join(n) : texto;
}

/** Serializa os achados do motor pro prompt (compacto). */
function prepararAchados(bal: BalanceteContabil, a: AnaliseDeterministica): string {
  const estrutura = a.estrutura.map(
    (g) => `- ${g.nome}: ${brl0(g.saldo)}${g.pctBase != null ? ` (${(g.pctBase * 100).toFixed(1)}% do ativo)` : ""}`
  );
  const t = a.totais;
  const dre = a.dre.map(
    (l) => `- ${l.nome}: ${brl0(l.valor)}${l.pctReceita != null ? ` (${(l.pctReceita * 100).toFixed(1)}% da receita líquida)` : ""}`
  );
  const inds = a.indicadores.map(
    (i) => `- ${i.nome}: ${i.formatado} [${i.faixa}, tendência ${i.tendencia}] — ${i.interpretacao}`
  );
  const incs = a.inconsistencias.map(
    (i) => `- [${i.severidade}] ${i.titulo}: ${i.detalhe}`
  );
  const c = a.cobertura;
  return [
    `EMPRESA: ${PLACEHOLDER_EMPRESA}`,
    `PERÍODO: ${bal.mesesLabels.join(", ")}`,
    `SAÚDE GERAL (já classificada): ${a.saudeGeral}`,
    `Balancete fecha: ${a.fecha ? "sim" : `NÃO (diferença ${brl0(a.difFechamento)})`}`,
    `Cobertura: ${c.mesesComMovimento}/${c.mesesSolicitados} meses com movimento; 1º mês com dado: ${c.primeiroMesComDado ?? "nenhum"}; saldo antes do período: ${c.temSaldoInicial ? "sim" : "não"}.`,
    ``,
    `ESTRUTURA PATRIMONIAL (saldo no último mês — Ativo = Passivo + PL):`,
    ...estrutura,
    `- Ativo total: ${brl0(t.ativo)} · Passivo exigível: ${brl0(t.passivo)} · PL: ${brl0(t.pl)}`,
    t.resultadoExercicio > 1 || t.resultadoExercicio < -1
      ? `- Obs.: o PL já inclui ${brl0(t.resultadoExercicio)} de resultado do exercício ainda não transportado às contas de PL (pré-apuração).`
      : `- PL sem resultado pendente de transporte.`,
    ``,
    `RESULTADO DO PERÍODO (DRE em fluxo — movimento do intervalo, não saldo acumulado):`,
    ...dre,
    ``,
    `INDICADORES:`,
    ...inds,
    ``,
    `INCONSISTÊNCIAS/ALERTAS (${a.inconsistencias.length}):`,
    ...(incs.length ? incs : ["- nenhuma"]),
  ].join("\n");
}

const SYSTEM = `Você é um contador e controller sênior brasileiro. Recebe um balancete JÁ ANALISADO por um motor determinístico: os grupos, os indicadores (com faixa e tendência), as inconsistências (com severidade) e a cobertura já vêm calculados e classificados. Seu trabalho é ESCREVER o laudo em prosa, para apresentar ao cliente da contabilidade.

Contexto dos números:
- A estrutura patrimonial já vem reconciliada: o PL inclui o resultado do exercício, então Ativo = Passivo exigível + PL. Se houver "resultado do exercício ainda não transportado", é um balancete mensal pré-apuração — normal, não é erro.
- A DRE do período está em FLUXO (movimento do intervalo), não em saldo acumulado do ano. Trate receita/custo/resultado como o desempenho DAQUELE período.

Regras:
- A empresa vem identificada APENAS como [EMPRESA] (sem nome nem CNPJ, por sigilo). Refira-se a ela como "a empresa" ou reproduza o marcador [EMPRESA] tal e qual; NUNCA invente nome, razão social ou CNPJ.
- Use SOMENTE os números e classificações fornecidos. NÃO recalcule indicadores nem invente valores — se um dado não veio, não fale dele.
- Priorize as inconsistências de severidade alta (balancete que não fecha, saldos de sinal impossível, PL negativo): explique a implicação prática de cada uma.
- Respeite a cobertura: não leia meses sem movimento como queda; se o histórico for curto, diga e module a confiança.
- Estruture em parágrafos claros, nesta ordem: panorama geral; estrutura patrimonial e liquidez; endividamento; resultado; inconsistências e alertas; recomendações práticas. Pode usar títulos curtos de seção em texto puro.

Estilo: português do Brasil, profissional e direto, sem markdown e sem emojis. Cite números concretos. Devolva apenas o texto do laudo.`;

export interface ResultadoLaudo {
  texto: string;
  meta: { modelo: string; tokensEntrada: number; tokensSaida: number };
}

interface GroqResposta {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Redige o laudo escrito (prosa) sobre os achados do motor. */
export async function redigirLaudo(
  bal: BalanceteContabil,
  analise: AnaliseDeterministica
): Promise<ResultadoLaudo> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AnaliseError(
      "Chave da API da Groq não configurada — defina GROQ_API_KEY no ambiente."
    );
  }

  // Sigilo: censura na origem (o payload já sai com [EMPRESA]) + varredura por cima.
  const achados = censurarIdentificacao(prepararAchados(bal, analise), bal.empresa.nome);

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.3,
        max_tokens: MAX_TOKENS_LAUDO,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Escreva o laudo do balancete a partir dos achados abaixo.\n\n${achados}`,
          },
        ],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error && err.message ? err.message : String(err);
    throw new AnaliseError(`Falha ao chamar a Groq: ${msg}`);
  }

  if (!resp.ok) {
    let detalhe = "";
    try {
      const j = (await resp.json()) as { error?: { message?: string } };
      detalhe = j?.error?.message ?? "";
    } catch {
      /* corpo não-JSON */
    }
    throw new AnaliseError(`Groq respondeu ${resp.status}${detalhe ? `: ${detalhe}` : ""}`);
  }

  const data = (await resp.json()) as GroqResposta;
  const escolha = data.choices?.[0];
  if (escolha?.finish_reason === "content_filter") {
    throw new AnaliseError("O modelo recusou a redação deste conteúdo.");
  }
  const bruto = escolha?.message?.content?.trim() ?? "";
  if (!bruto) throw new AnaliseError("Resposta do modelo sem texto.");

  // Repõe o nome real (a IA só viu o placeholder).
  const texto = restaurarIdentificacao(bruto, bal.empresa.nome);

  return {
    texto,
    meta: {
      modelo: data.model ?? MODELO,
      tokensEntrada: data.usage?.prompt_tokens ?? 0,
      tokensSaida: data.usage?.completion_tokens ?? 0,
    },
  };
}
