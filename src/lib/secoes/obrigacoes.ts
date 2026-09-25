import { abaAutonoma, type Aba, type Secao } from "./tipos";

/**
 * Seções do Obrigações: a fila de entregas do Acessórias. O recorte entre as
 * seções é o SETOR do Acessórias, porque é assim que o escritório divide o
 * trabalho lá: toda entrega nasce dentro de um departamento. Uma seção por área
 * é também o que deixa a permissão fazer sentido (o time do Contábil recebe a
 * seção Contábil e não vê a fila do Fiscal).
 *
 * A empresa vem do contexto do topo, como nas outras telas que varrem o
 * escritório: a fila guarda o `codigoempresa` do Questor de cada CNPJ. Sem
 * empresa, a seção mostra o escopo inteiro da pessoa.
 *
 * Os ids e os caminhos são os do nexo2 (`cargo_secao` guarda `obrigacoes/dp`).
 */

/**
 * Departamentos do Acessórias que cada seção mostra (ids do Acessórias, não do
 * NaveX). Vazio = todos. A varredura traz todos os setores de uma vez, então
 * abrir uma área nova aqui é só listar os ids dela.
 */
const SETORES: Record<string, number[]> = {
  geral: [],
  // 1 Contábil - Balanço Balancetes, 50 Célula Contábil, 27 Lançamentos.
  contabil: [1, 50, 27],
  // 2 Fiscal - Faturamento - Notas.
  fiscal: [2],
  // 3 Pessoal - Empregados - Folha.
  dp: [3],
};

/** Seções que leem a fila (as que têm setor). A Configurações opera a varredura. */
export const SECOES_FILA = Object.keys(SETORES);

/** Setores da seção de fila, pelo id. `undefined` quando a seção não é de fila. */
export function setoresDaSecao(id: string): number[] | undefined {
  return SETORES[id];
}

function abaFila(id: string, rotulo: string, descricao: string): Aba {
  // Sem período no topo: o prazo é filtro da própria tela, e a fila é um
  // retrato já materializado, que carrega sem botão.
  return { id, rotulo, path: `/obrigacoes/${id}`, descricao, periodo: "nenhum", empresa: "opcional", execucao: null };
}

function secaoFila(id: string, rotulo: string, icone: string, descricao: string): Secao {
  return {
    id,
    rotulo,
    icone,
    grupo: "Filas",
    path: `/obrigacoes/${id}`,
    descricao,
    abas: [abaFila(id, rotulo, descricao)],
  };
}

export const SECOES_OBRIGACOES: Secao[] = [
  // Visão Geral primeiro: é a entrada do módulo e a única sem recorte de setor.
  secaoFila("geral", "Visão Geral", "grade", "Entregas pendentes do escritório inteiro, por setor e responsável"),
  secaoFila("contabil", "Contábil", "calculadora", "Balancetes, movimentação financeira e escriturações pendentes"),
  secaoFila("fiscal", "Fiscal", "recibo", "Guias, apurações e declarações fiscais pendentes"),
  secaoFila("dp", "DP", "pessoas", "Folha, encargos e obrigações de pessoal pendentes"),
  // À parte das filas: aqui se opera a varredura. Seção própria porque a
  // permissão é binária, e nenhum cargo a recebe por padrão (ver
  // [[Posse numa permissão binária é duas seções e recorte por linha]]).
  {
    id: "configuracoes",
    rotulo: "Configurações",
    icone: "engrenagem",
    grupo: "Integração",
    path: "/obrigacoes/configuracoes",
    descricao: "Andamento e disparo da varredura do Acessórias",
    abas: [
      abaAutonoma(
        "configuracoes",
        "Configurações",
        "/obrigacoes/configuracoes",
        "Andamento e disparo da varredura do Acessórias"
      ),
    ],
  },
];
