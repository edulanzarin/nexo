/**
 * Formulários (builder tipo Google Forms) — parte PURA, sem servidor. DTOs e
 * regras de validação compartilhados entre o renderer público (client), o
 * preview do builder (client) e a submissão (server). Não importa `pg` nem
 * `server-only` para poder entrar no bundle.
 */

export const TIPOS_CAMPO = [
  "texto_curto",
  "texto_longo",
  "selecao_unica",
  "selecao_multipla",
  "nota",
  "pontuacao",
] as const;

export type TipoCampo = (typeof TIPOS_CAMPO)[number];

/** Rótulos no vocabulário da RH ("escrever", "marcação", "nota", "pontuação"). */
export const TIPO_CAMPO_ROTULO: Record<TipoCampo, string> = {
  texto_curto: "Escrever (curto)",
  texto_longo: "Escrever (parágrafo)",
  selecao_unica: "Marcação (uma opção)",
  selecao_multipla: "Marcação (várias opções)",
  nota: "Nota (escala)",
  pontuacao: "Pontuação (número)",
};

export type StatusFormulario = "rascunho" | "ativo" | "arquivado";

/** Config específica do tipo (jsonb `config` do campo). Todos opcionais. */
export interface CampoConfig {
  /** selecao_unica / selecao_multipla: opções marcáveis. */
  opcoes?: string[];
  /** nota: rótulos da escala (índice 0..n-1). Sem isto, usa 1..max. */
  escala?: string[];
  /** pontuacao: intervalo numérico permitido. */
  min?: number;
  max?: number;
  /** Campo que representa a decisão/recomendação — destacado nos painéis. */
  papel?: "decisao";
}

export interface FormularioCampo {
  id: number;
  ordem: number;
  tipo: TipoCampo;
  rotulo: string; // a pergunta
  ajuda: string | null;
  obrigatorio: boolean;
  config: CampoConfig;
}

export interface Formulario {
  id: number;
  nome: string;
  descricao: string | null;
  status: StatusFormulario;
  campos: FormularioCampo[];
  criadoEm?: string;
  atualizadoEm?: string;
}

/** Item da lista de formulários (sem os campos; só a contagem). */
export interface FormularioResumo {
  id: number;
  nome: string;
  descricao: string | null;
  status: StatusFormulario;
  campos: number;
  atualizadoEm: string;
}

/** Valor de um campo (string p/ texto e seleção única, array p/ múltipla,
 *  número p/ nota e pontuação). No transporte JSON as chaves são o id do campo. */
export type ValorCampo = string | string[] | number | null | undefined;
export type RespostaValores = Record<string, ValorCampo>;

/** Escala efetiva de um campo `nota`: rótulos explícitos ou 1..max (default 5). */
export function escalaDoCampo(campo: FormularioCampo): string[] {
  if (campo.config.escala?.length) return campo.config.escala;
  const max = campo.config.max && campo.config.max > 0 ? campo.config.max : 5;
  return Array.from({ length: max }, (_, i) => String(i + 1));
}

/** Um campo está preenchido? (para obrigatoriedade). */
export function valorPreenchido(tipo: TipoCampo, valor: ValorCampo): boolean {
  if (valor == null) return false;
  if (tipo === "selecao_multipla") return Array.isArray(valor) && valor.length > 0;
  if (tipo === "nota" || tipo === "pontuacao") return typeof valor === "number" && !Number.isNaN(valor);
  return typeof valor === "string" ? valor.trim().length > 0 : false;
}

/**
 * Valida as respostas contra a definição do formulário. Devolve um mapa
 * campoId -> mensagem de erro (vazio = tudo certo). Autoridade é o servidor, mas
 * o client usa o mesmo para feedback e para travar o envio.
 */
export function validarRespostas(
  campos: FormularioCampo[],
  valores: RespostaValores
): Record<number, string> {
  const erros: Record<number, string> = {};
  for (const c of campos) {
    const v = valores[String(c.id)];
    const preenchido = valorPreenchido(c.tipo, v);

    if (!preenchido) {
      if (c.obrigatorio) erros[c.id] = "Obrigatório";
      continue; // vazio não obrigatório: nada mais a validar
    }

    switch (c.tipo) {
      case "selecao_unica": {
        const opcoes = c.config.opcoes ?? [];
        if (opcoes.length && !opcoes.includes(String(v))) erros[c.id] = "Opção inválida";
        break;
      }
      case "selecao_multipla": {
        const opcoes = c.config.opcoes ?? [];
        const arr = Array.isArray(v) ? v : [];
        if (opcoes.length && arr.some((x) => !opcoes.includes(x))) erros[c.id] = "Opção inválida";
        break;
      }
      case "nota": {
        const n = Number(v);
        const total = escalaDoCampo(c).length;
        if (!Number.isInteger(n) || n < 0 || n >= total) erros[c.id] = "Nota inválida";
        break;
      }
      case "pontuacao": {
        const n = Number(v);
        const min = c.config.min ?? 0;
        const max = c.config.max ?? 100;
        if (Number.isNaN(n) || n < min || n > max) erros[c.id] = `Informe um número entre ${min} e ${max}`;
        break;
      }
      // texto_curto / texto_longo: qualquer texto não vazio serve
    }
  }
  return erros;
}
