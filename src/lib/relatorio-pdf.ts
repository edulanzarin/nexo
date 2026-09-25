import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { colunaNumerica, textoCelula, type Tabela } from "./tabela-exportar";

/**
 * A tabela exportada como relatório em PDF: título, de onde veio, a tabela com
 * o cabeçalho repetido em cada página, e no rodapé quem gerou, quando e a
 * página. É o arquivo que vai por e-mail ou para a impressora, então lê sozinho,
 * fora do NaveX.
 *
 * Diferente do "imprimir a tela", que leva o que está desenhado (gráfico,
 * laudo): aqui sai a mesma tabela da planilha, paginada.
 */

export interface CapaPdf {
  titulo: string;
  /** De onde veio: módulo e seção, e o recorte quando a tela o descreve. */
  contexto?: string;
  /** "Gerado por Fulano em 25/09/2026 às 15:32". */
  autoria: string;
}

const TINTA: [number, number, number] = [32, 30, 27];
const APAGADO: [number, number, number] = [118, 112, 104];
const LINHA: [number, number, number] = [226, 222, 214];
const FUNDO_CABECALHO: [number, number, number] = [244, 242, 237];
const FUNDO_ZEBRA: [number, number, number] = [250, 249, 246];
const MARCA: [number, number, number] = [255, 122, 46];

// As fontes-padrão do PDF (Helvetica) escrevem Latin-1. O que o NaveX põe em
// texto fora dele é tipografia: troca pelo equivalente em vez de sair lixo.
const TROCAS: Record<string, string> = {
  "—": "-", "–": "-", "−": "-", "‘": "'", "’": "'", "“": '"', "”": '"',
  "…": "...", "•": "·", "→": "->", "←": "<-", " ": " ", " ": " ", " ": " ",
};

export function paraLatin1(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    out += cp <= 0xff ? ch : (TROCAS[ch] ?? "?");
  }
  return out;
}

function tamanhoFonte(ncol: number): number {
  if (ncol <= 6) return 9;
  if (ncol <= 10) return 8;
  if (ncol <= 14) return 7;
  return 6.5;
}

export function montarPdf(tabela: Tabela, capa: CapaPdf): Uint8Array {
  const { cabecalhos, linhas } = tabela;
  const ncol = cabecalhos.length;
  // Sem `compress`, 120 linhas passam de 300 KB; comprimido, o mesmo cabe em anexo de e-mail.
  const doc = new jsPDF({ orientation: ncol > 6 ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
  const larg = doc.internal.pageSize.getWidth();
  const alt = doc.internal.pageSize.getHeight();
  const margem = 36;
  const titulo = paraLatin1(capa.titulo);
  doc.setProperties({ title: titulo, creator: "NaveX" });

  // Primeira página: marca, título e de onde veio.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MARCA);
  doc.text("NaveX", margem, 44);
  doc.setFontSize(16);
  doc.setTextColor(...TINTA);
  doc.text(titulo, margem, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...APAGADO);
  const qtd = `${linhas.length.toLocaleString("pt-BR")} ${linhas.length === 1 ? "linha" : "linhas"}`;
  doc.text(paraLatin1(capa.contexto ? `${capa.contexto} · ${qtd}` : qtd), margem, 82);

  const numericas = new Set(cabecalhos.map((_, i) => i).filter((i) => colunaNumerica(linhas, i)));
  const fonte = tamanhoFonte(ncol);

  autoTable(doc, {
    startY: 96,
    margin: { top: margem + 8, right: margem, bottom: margem + 4, left: margem },
    head: [cabecalhos.map(paraLatin1)],
    body: linhas.map((l) => cabecalhos.map((_, i) => paraLatin1(textoCelula(l[i])))),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: fonte,
      textColor: TINTA,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      overflow: "linebreak",
      lineColor: LINHA,
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      valign: "middle",
    },
    headStyles: { fillColor: FUNDO_CABECALHO, textColor: APAGADO, fontStyle: "bold" },
    alternateRowStyles: { fillColor: FUNDO_ZEBRA },
    columnStyles: Object.fromEntries([...numericas].map((i) => [i, { halign: "right" as const }])),
    didParseCell: (d) => {
      if (d.section === "head" && numericas.has(d.column.index)) d.cell.styles.halign = "right";
    },
    didDrawPage: (d) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...APAGADO);
      // Da segunda página em diante, o título pequeno no alto: a folha solta
      // ainda diz de que relatório é.
      if (d.pageNumber > 1) doc.text(titulo, margem, margem - 4);
      doc.text(paraLatin1(capa.autoria), margem, alt - 20);
    },
  });

  // A numeração vai depois da tabela, quando o total já existe. O marcador de
  // total do jsPDF alinha pela largura do marcador, e o número sai torto.
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...APAGADO);
    doc.text(paraLatin1(`Página ${p} de ${paginas}`), larg - margem, alt - 20, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
