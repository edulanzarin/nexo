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

/** Converte a seleção em query string (parâmetros repetidos) para as rotas. */
export function serializarFolhaSelecao(sel: FolhaSelecao): string {
  const p = new URLSearchParams();
  for (const v of sel.estabs) p.append("estabs", v);
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
