/**
 * Seleção dos filtros avançados da Folha (lado do cliente). Fica separado de
 * [[folha-turnover]] (servidor) para não arrastar código de servidor pro bundle.
 */
export interface FolhaSelecao {
  estabs: string[];
  setores: string[];
  cargos: string[];
  vinculos: string[];
  horarios: string[];
}

export const FOLHA_SELECAO_VAZIA: FolhaSelecao = {
  estabs: [],
  setores: [],
  cargos: [],
  vinculos: [],
  horarios: [],
};

/**
 * Converte a seleção em query string (parâmetros repetidos) para as rotas.
 *
 * O estabelecimento vai como `estabelecimentos`, e não `estabs`: `estabs` é a
 * filial do contexto (código numérico), e o `parseFilters` recusa nome ali com
 * "Filial inválida". No nexo2 escolher um estabelecimento derrubava a tela.
 */
export function serializarFolhaSelecao(sel: FolhaSelecao): string {
  const p = new URLSearchParams();
  for (const v of sel.estabs) p.append("estabelecimentos", v);
  for (const v of sel.setores) p.append("setores", v);
  for (const v of sel.cargos) p.append("cargos", v);
  for (const v of sel.vinculos) p.append("vinculos", v);
  for (const v of sel.horarios) p.append("horarios", v);
  const s = p.toString();
  return s ? `&${s}` : "";
}

export function contarFolhaSelecao(sel: FolhaSelecao): number {
  return (
    sel.estabs.length +
    sel.setores.length +
    sel.cargos.length +
    sel.vinculos.length +
    sel.horarios.length
  );
}

/** Rótulo amigável do vínculo (categoria|tipovinculo). Sem tabela de domínio na
 *  base, mapeia só o certo (CLT) e mostra o resto cru — honesto. */
export function rotuloVinculo(vinc: string): string {
  const [categoria, tipo] = vinc.split("|");
  if (categoria === "01" && tipo === "10") return "Empregado (CLT)";
  if (categoria === "01") return `Empregado · tipo ${tipo || "?"}`;
  return `Categoria ${categoria || "?"} · tipo ${tipo || "?"}`;
}
