/**
 * Dado de mentira do catálogo e da prévia. Nomes e números plausíveis para
 * julgar a estética no lugar real, sem nada do Questor.
 */

export const EMPRESAS_FALSAS = [
  { codigo: 1200, nome: "NAVECON CONTABILIDADE LTDA" },
  { codigo: 1318, nome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA" },
  { codigo: 1402, nome: "TRANSPORTES RIO DO PEIXE EIRELI" },
  { codigo: 1455, nome: "CLINICA ODONTOLOGICA SORRISO VIVO S/S" },
  { codigo: 1507, nome: "METALURGICA VALE DO ITAJAI LTDA" },
  { codigo: 1633, nome: "PANIFICADORA E CONFEITARIA TRIGO BOM LTDA ME" },
  { codigo: 1702, nome: "AGROPECUARIA CAMPOS GERAIS S/A" },
  { codigo: 1788, nome: "U FIT ACADEMIA JARAGUA LTDA" },
];

export interface NotaFalsa {
  numero: number;
  serie: string;
  data: string;
  contraparte: string;
  cfops: string[];
  situacao: "ok" | "pendente" | "divergente" | "duplicada" | "consolidada";
  divergencias: number;
  valor: number;
}

const CONTRAPARTES = [
  "DISTRIBUIDORA SUL BRASIL LTDA",
  "COOPERATIVA AGROINDUSTRIAL ALFA",
  "ENERGISA SANTA CATARINA",
  "POSTO DE COMBUSTIVEIS BR 280",
  "ATACADAO DISTRIBUICAO COM E IND",
  "TOTVS S/A",
  "EMBALAGENS PLASTICAS VALE LTDA",
  "TRANSPORTADORA TRES IRMAOS",
  "MERCADO LIVRE LTDA",
  "WEG EQUIPAMENTOS ELETRICOS S/A",
];

const SITUACOES: NotaFalsa["situacao"][] = ["ok", "ok", "pendente", "ok", "divergente", "ok", "duplicada", "consolidada", "ok", "pendente"];

export const NOTAS_FALSAS: NotaFalsa[] = Array.from({ length: 14 }, (_, i) => ({
  numero: 48190 + i * 7,
  serie: "1",
  data: `2026-08-${String(2 + ((i * 3) % 27)).padStart(2, "0")}`,
  contraparte: CONTRAPARTES[i % CONTRAPARTES.length],
  cfops: [["1.102"], ["1.556"], ["1.933", "1.949"], ["2.102"], ["1.253"]][i % 5],
  situacao: SITUACOES[i % SITUACOES.length],
  divergencias: SITUACOES[i % SITUACOES.length] === "divergente" ? 1 + (i % 2) : 0,
  valor: Math.round((1200 + ((i * 7919) % 48000) + i * 13.37) * 100) / 100,
}));

export const SERIE_FALSA = Array.from({ length: 12 }, (_, i) => {
  const mes = ["set", "out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago"][i];
  const base = 3800 + Math.round(Math.sin(i / 1.7) * 900 + i * 110);
  return {
    mes: `${mes}/${i < 4 ? "25" : "26"}`,
    manual: Math.round(base * 0.42),
    importado: Math.round(base * 0.38),
    integracao: Math.round(base * 0.2),
    total: base,
  };
});

export const PESSOAS_FALSAS = [
  { nome: "Ana Paula Ribeiro", lancamentos: 5212, horas: 142.5 },
  { nome: "Bruno Henrique Costa", lancamentos: 4380, horas: 151 },
  { nome: "Camila Schmitt", lancamentos: 3905, horas: 128.25 },
  { nome: "Diego Moretti", lancamentos: 2870, horas: 139 },
  { nome: "Elaine Kowalski", lancamentos: 2410, horas: 96.5 },
  { nome: "Felipe Zanella", lancamentos: 1690, horas: 118 },
  { nome: "Gabriela Nunes", lancamentos: 980, horas: 74 },
];

export function diasFalsos(): { dia: string; valor: number }[] {
  const out: { dia: string; valor: number }[] = [];
  const d = new Date(2026, 5, 1);
  for (let i = 0; i < 92; i++) {
    const dow = d.getDay();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fimMes = d.getDate() >= 25;
    out.push({ dia: iso, valor: dow === 0 || dow === 6 ? (i % 5 === 0 ? 40 : 0) : Math.round(180 + ((i * 97) % 260) + (fimMes ? 420 : 0)) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
