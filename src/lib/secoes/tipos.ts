/**
 * O vocabulário da navegação do NaveX. Uma seção é uma entrada da barra
 * lateral e a unidade de permissão (o cargo concede `modulo/secao`); uma aba
 * divide a seção em ângulos do mesmo trabalho e herda a permissão dela.
 *
 * Os ids de seção são os mesmos do nexo2 de propósito: `cargo_secao` guarda
 * esses ids, e manter a chave é o que deixa os cargos cadastrados valerem no
 * dia em que o NaveX assumir o banco do app.
 */

/** Recorte de tempo que a aba pede no contexto do topo. */
export type Periodo = "dia" | "mes" | "nenhum";

/**
 * O que a aba faz com a empresa do contexto:
 * - `uma`: bancada, roda uma empresa por vez e não abre sem ela;
 * - `opcional`: varre o escopo inteiro, e a empresa (ou o grupo) vira filtro;
 * - `nenhuma`: tela que não lê empresa (painel, post mortem).
 */
export type EscopoEmpresa = "uma" | "opcional" | "nenhuma";

export interface Aba {
  id: string;
  rotulo: string;
  path: string;
  descricao: string;
  /** Padrão `dia`. */
  periodo?: Periodo;
  /** Padrão `uma`. */
  empresa?: EscopoEmpresa;
  /** A tela honra filial (estabelecimento). Só vale com uma empresa. */
  filial?: boolean;
  /**
   * Como a tela dispara a consulta:
   * - ausente: botão "Executar";
   * - string: botão com esse verbo ("Carregar" quando só traz cadastro);
   * - null: sem botão, a tela tem gatilho próprio (o envio do extrato).
   */
  execucao?: string | null;
}

export interface Secao {
  id: string;
  rotulo: string;
  path: string;
  descricao: string;
  /** Nome no registro de ícones (`<Icone nome=... />`). */
  icone: string;
  /** Grupo da barra lateral. Seções do mesmo grupo ficam juntas, na ordem da lista. */
  grupo: string;
  abas: Aba[];
}

export function periodoDaAba(aba: Aba | undefined): Periodo {
  return aba?.periodo ?? "dia";
}

export function empresaDaAba(aba: Aba | undefined): EscopoEmpresa {
  return aba?.empresa ?? "uma";
}

export function execucaoDaAba(aba: Aba | undefined): { imediata: boolean; rotulo: string } {
  if (aba?.execucao === null) return { imediata: true, rotulo: "" };
  return { imediata: false, rotulo: aba?.execucao ?? "Executar" };
}

/** Aba de uma tela só, que não lê empresa nem período. */
export function abaAutonoma(id: string, rotulo: string, path: string, descricao: string): Aba {
  return { id, rotulo, path, descricao, periodo: "nenhum", empresa: "nenhuma", execucao: null };
}
