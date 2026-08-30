import { baixarCSV } from "./csv";
import type { ModuloId } from "./modulos";

/**
 * Exportação padronizada do cliente: CSV e impressão (o "PDF" via diálogo do
 * navegador, mesmo caminho do laudo contábil). Toda exportação é REGISTRADA na
 * trilha de auditoria — "quem exportou" num sistema com dado fiscal e PII.
 *
 * O beacon é best-effort e não bloqueia o download: se a auditoria falhar, o
 * arquivo baixa do mesmo jeito.
 */
function auditarExport(modulo: ModuloId, alvo: string): void {
  registrarNaTrilha(modulo, "export", alvo);
}

/**
 * Beacon genérico da trilha para gesto que só o cliente conhece. O servidor
 * deriva o verbo de `modulo` + `tipo` (lista fechada) — daqui não sai ação
 * arbitrária. Best-effort por definição: nunca bloqueia nem falha o gesto que
 * está sendo registrado.
 */
export function registrarNaTrilha(
  modulo: ModuloId,
  tipo: "export" | "consulta",
  alvo: string,
  codigoempresa?: number
): void {
  try {
    fetch("/api/auditoria", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modulo, tipo, alvo, codigoempresa }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* nunca atrapalha o gesto que está sendo registrado */
  }
}

/** Baixa a tabela em CSV e registra a exportação na auditoria. */
export function exportarCSV(
  modulo: ModuloId,
  nome: string,
  cabecalhos: string[],
  linhas: (string | number | null | undefined)[][]
): void {
  baixarCSV(nome, cabecalhos, linhas);
  auditarExport(modulo, nome);
}

/**
 * Abre o diálogo de impressão (salvar em PDF) e registra a ação. A tela decide o
 * que sai no papel via CSS `@media print` — mesmo padrão do laudo.
 */
export function imprimirPDF(modulo: ModuloId, alvo: string): void {
  auditarExport(modulo, alvo);
  window.print();
}
