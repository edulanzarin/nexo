import { strToU8, zipSync } from "fflate";
import { lerCelula, type Tabela } from "./tabela-exportar";

/**
 * Planilha .xlsx montada à mão: o formato é um zip de XML, e as seis partes que
 * o Excel exige cabem aqui. Uma biblioteca de planilha inteira pesaria mais que
 * o resto da tela para escrever uma aba só.
 *
 * O que o arquivo leva além dos valores: cabeçalho em negrito e congelado,
 * filtro ligado, largura de coluna pelo conteúdo, número como número (soma no
 * Excel sem converter), data como data (ordena por dia, não por texto).
 */

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Estilos (índices de `cellXfs` em ESTILOS). */
const E = { cabecalho: 1, data: 2, dataHora: 3, decimal: 4 } as const;

const ESTILOS =
  XML +
  `<styleSheet xmlns="${NS}">` +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

// Fora do XML 1.0: controles (menos tab e quebras) e surrogates soltos. Um só
// deles no nome de alguém e o Excel recusa o arquivo inteiro.
const INVALIDO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function esc(s: string): string {
  return s
    .replace(INVALIDO, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function letraColuna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nome de aba: até 31 caracteres, sem `[]:*?/\`, e nunca vazio. */
export function nomeAba(nome: string): string {
  const limpo = nome.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim();
  return limpo || "Planilha";
}

/** Dias desde 30/12/1899, a contagem de data do Excel. */
const serial = (d: Date) => d.getTime() / 86_400_000 + 25_569;

function textoInline(ref: string, s: string, estilo?: number): string {
  const limpo = esc(s);
  const espaco = limpo !== limpo.trim() || /\n/.test(limpo) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ""}><is><t${espaco}>${limpo}</t></is></c>`;
}

export function montarXlsx(tabela: Tabela, aba: string): Uint8Array {
  const { cabecalhos, linhas } = tabela;
  // reduce e não Math.max(...): com dezenas de milhares de linhas o espalhamento
  // estoura o limite de argumentos.
  const ncol = linhas.reduce((n, l) => Math.max(n, l.length), Math.max(cabecalhos.length, 1));
  const larguras = cabecalhos.map((c) => c.length);
  const linhasXml: string[] = [];

  linhasXml.push(`<row r="1">${cabecalhos.map((c, i) => textoInline(`${letraColuna(i)}1`, c, E.cabecalho)).join("")}</row>`);

  linhas.forEach((linha, li) => {
    const r = li + 2;
    let celulas = "";
    for (let i = 0; i < linha.length; i++) {
      const c = lerCelula(linha[i]);
      const ref = `${letraColuna(i)}${r}`;
      let largura = 0;
      switch (c.tipo) {
        case "vazio":
          continue;
        case "texto":
          celulas += textoInline(ref, c.valor);
          largura = Math.max(...c.valor.split("\n").map((p) => p.length));
          break;
        case "numero":
          celulas += `<c r="${ref}"><v>${c.valor}</v></c>`;
          largura = String(c.valor).length;
          break;
        case "decimal":
          celulas += `<c r="${ref}" s="${E.decimal}"><v>${c.valor}</v></c>`;
          // Com milhar e duas casas, como o Excel vai mostrar.
          largura = Math.trunc(Math.abs(c.valor)).toString().length * 1.35 + 4;
          break;
        case "data":
          celulas += `<c r="${ref}" s="${c.comHora ? E.dataHora : E.data}"><v>${serial(c.valor)}</v></c>`;
          largura = c.comHora ? 16 : 10;
          break;
      }
      larguras[i] = Math.max(larguras[i] ?? 0, largura);
    }
    linhasXml.push(`<row r="${r}">${celulas}</row>`);
  });

  const ultima = `${letraColuna(ncol - 1)}${linhas.length + 1}`;
  const cols = Array.from({ length: ncol }, (_, i) => {
    // +2 de folga e +2 para a seta do filtro, que ocupa o fim do cabeçalho.
    const w = Math.min(60, Math.max(8, Math.ceil((larguras[i] ?? 0) + 4)));
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
  }).join("");

  const folha =
    XML +
    `<worksheet xmlns="${NS}" xmlns:r="${NS_R}">` +
    `<dimension ref="A1:${ultima}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${linhasXml.join("")}</sheetData>` +
    `<autoFilter ref="A1:${ultima}"/>` +
    "</worksheet>";

  const nome = nomeAba(aba);
  const faixa = `'${esc(nome).replace(/'/g, "''")}'!$A$1:$${letraColuna(ncol - 1)}$${linhas.length + 1}`;
  const livro =
    XML +
    `<workbook xmlns="${NS}" xmlns:r="${NS_R}">` +
    `<sheets><sheet name="${esc(nome)}" sheetId="1" r:id="rId1"/></sheets>` +
    // O Excel guarda o intervalo do filtro neste nome oculto; sem ele, abre e
    // oferece "reparar" o arquivo.
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${faixa}</definedName></definedNames>` +
    "</workbook>";

  return zipSync(
    {
      "[Content_Types].xml": strToU8(
        XML +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          "</Types>"
      ),
      "_rels/.rels": strToU8(
        XML +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>"
      ),
      "xl/workbook.xml": strToU8(livro),
      "xl/_rels/workbook.xml.rels": strToU8(
        XML +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>"
      ),
      "xl/worksheets/sheet1.xml": strToU8(folha),
      "xl/styles.xml": strToU8(ESTILOS),
    },
    { level: 6 }
  );
}
