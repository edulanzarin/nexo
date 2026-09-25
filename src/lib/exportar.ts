import { baixarCSV } from "./csv";
import type { ModuloId } from "./modulos";
import type { CapaPdf } from "./relatorio-pdf";
import type { Tabela } from "./tabela-exportar";

/**
 * Exportação padronizada do cliente: Excel, PDF, CSV e a impressão da tela.
 * Toda exportação é REGISTRADA na trilha de auditoria — "quem exportou" num
 * sistema com dado fiscal e PII.
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
  auditarExport(modulo, `${nome}.csv`);
}

function baixar(nome: string, bytes: Uint8Array<ArrayBuffer>, tipo: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // O download começa no clique, mas o navegador ainda lê o blob depois dele.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Baixa a tabela em Excel. O montador só carrega no clique: as telas que têm o
 * botão não pagam por ele ao abrir.
 */
export async function exportarXlsx(modulo: ModuloId, nome: string, aba: string, tabela: Tabela): Promise<void> {
  const { montarXlsx } = await import("./planilha-xlsx");
  const bytes = montarXlsx(tabela, aba) as Uint8Array<ArrayBuffer>;
  baixar(`${nome}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  auditarExport(modulo, `${nome}.xlsx`);
}

/** Baixa a tabela como relatório em PDF (jsPDF, carregado no clique). */
export async function exportarPdf(modulo: ModuloId, nome: string, capa: CapaPdf, tabela: Tabela): Promise<void> {
  const { montarPdf } = await import("./relatorio-pdf");
  const bytes = montarPdf(tabela, capa) as Uint8Array<ArrayBuffer>;
  baixar(`${nome}.pdf`, bytes, "application/pdf");
  auditarExport(modulo, `${nome}.pdf`);
}

/**
 * Abre o diálogo de impressão (salvar em PDF) e registra a ação. A tela decide o
 * que sai no papel via CSS `@media print` — mesmo padrão do laudo.
 */
export function imprimirPDF(modulo: ModuloId, alvo: string): void {
  auditarExport(modulo, alvo);
  window.print();
}
