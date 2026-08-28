/**
 * "Quem é essa pessoa do extrato na folha?" — casa a descrição de uma transação
 * bancária com os vínculos da folha do Questor.
 *
 * Por que existe: comissão paga por fora da folha cai no extrato como um PIX
 * qualquer, e o contábil precisa saber se o favorecido é funcionário para
 * decidir a conta. Hoje isso é caçado à mão, empresa por empresa.
 *
 * O casamento é conservador de propósito — errar a pessoa é pior que não achar:
 *
 * - **CPF manda**. Muito extrato de PIX traz o CPF mascarado ("***.456.789-**")
 *   e os dígitos expostos são o miolo, que é o pedaço discriminante. Batendo os
 *   dígitos conhecidos posição a posição, o achado é praticamente prova.
 * - **Nome só casa com sobrenome junto.** "JOAO" nunca casa; o primeiro nome
 *   tem de vir acompanhado, porque a base tem dezenas de homônimos parciais.
 * - **Empate não vira classificação.** Duas pessoas diferentes casando igual
 *   viram aviso de homônimo, não um selo afirmativo.
 *
 * Módulo PURO (roda no cliente e no servidor, testável sem banco): quem lê o
 * Questor é [[contabil-funcionarios]].
 */

/** Um vínculo da folha, no mínimo necessário para o casamento. */
export interface PessoaFolha {
  empresa: number;
  contrato: number;
  nome: string;
  cpf: string | null;
  dataadm: string | null;
  datadem: string | null;
}

/** Como a pessoa foi encontrada — do mais forte para o mais fraco. */
export type ViaCasamento = "cpf" | "nome" | "parcial";

/** O que a Conciliação carimba na linha do extrato. */
export interface SeloFolha {
  nome: string;
  empresa: number;
  /** Nome da empresa do vínculo — resolvido no servidor, para o selo dizer qual. */
  empresaNome?: string | null;
  contrato: number;
  via: ViaCasamento;
  /** Vínculo na empresa do extrato; falso = funcionário de outra da carteira. */
  mesmaEmpresa: boolean;
  dataadm: string | null;
  /** Preenchida = já desligado (comissão a ex-funcionário é caso comum). */
  datadem: string | null;
  /** Outras pessoas casaram igualmente bem — confira antes de classificar. */
  homonimos: number;
}

/** Sem acento, maiúsculas, só letras e dígitos separados por espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Palavras que o banco põe na descrição e que não são nome de gente. Sem esta
 * lista, "PIX" e "PAGTO" viram tokens e casam com qualquer coisa.
 */
const RUIDO = new Set([
  "PIX", "TED", "DOC", "TEV", "TEF", "PAGTO", "PAGAMENTO", "PAGAMENTOS", "PAG",
  "RECEBIDO", "RECEBIDA", "ENVIADO", "ENVIADA", "TRANSF", "TRANSFERENCIA",
  "TRANSFERENCIAS", "CREDITO", "DEBITO", "DEB", "CRED", "LIQUIDACAO", "LIQ",
  "COMPENSACAO", "CIP", "STR", "SPB", "ELETRONICA", "ELETRONICO", "ONLINE",
  "FAVORECIDO", "REMETENTE", "DESTINATARIO", "BENEFICIARIO", "CLIENTE",
  "BANCO", "BCO", "AGENCIA", "AG", "CONTA", "CC", "CP", "DES", "REM",
  "TITULO", "BOLETO", "COBRANCA", "TARIFA", "TAR", "TXA", "TAXA", "SALDO",
  "APLICACAO", "RESGATE", "RENDIMENTO", "JUROS", "MULTA", "DESCONTO",
  "SALARIO", "SALARIOS", "FOLHA", "ADIANTAMENTO", "COMISSAO", "COMISSOES",
  "VALE", "REEMBOLSO", "DEPOSITO", "SAQUE", "CHEQUE", "CH", "ORDEM",
  "MESMA", "TITULARIDADE", "TIT", "ID", "NR", "REF", "DOCTO", "NUM",
  "LTDA", "ME", "EPP", "EIRELI", "SA", "MEI", "CNPJ", "CPF",
]);

/** Conectivos de nome: não são discriminantes, mas também não são ruído. */
const CONECTIVOS = new Set(["DA", "DE", "DO", "DAS", "DOS", "DI", "DU", "E"]);

/** Tokens úteis de um nome próprio (fora conectivos e pedaços de 1 letra). */
export function tokensDeNome(nome: string): string[] {
  return normalizar(nome)
    .split(" ")
    .filter((t) => t.length > 1 && !CONECTIVOS.has(t) && !/^\d+$/.test(t));
}

/** Tokens da descrição do extrato que ainda podem ser nome de gente. */
export function tokensDeDescricao(descricao: string): string[] {
  return normalizar(descricao)
    .split(" ")
    .filter(
      (t) => t.length > 1 && !CONECTIVOS.has(t) && !RUIDO.has(t) && !/\d/.test(t)
    );
}

/**
 * Padrões de CPF na descrição: 11 posições, cada uma um dígito ou `*`. Aceita
 * mascarado ("***.456.789-**") e cheio. Espaço fica FORA da classe de propósito
 * — sem isso, "123 456 789 00" de campos vizinhos viraria um CPF inventado.
 */
export function padroesCpf(descricao: string): string[] {
  const achados: string[] = [];
  for (const m of descricao.matchAll(/[\d*xX][\d.\-*xX]{8,16}[\d*xX]/g)) {
    const limpo = m[0].replace(/[.\-]/g, "").replace(/[xX]/g, "*");
    // 11 = CPF. 14 (CNPJ) e restos de número caem fora sozinhos.
    if (limpo.length !== 11) continue;
    // Menos que isso não discrimina ninguém numa base de 19 mil pessoas.
    if ((limpo.match(/\d/g)?.length ?? 0) < 5) continue;
    achados.push(limpo);
  }
  return achados;
}

/** Só os dígitos de um CPF cadastrado; null quando não dá 11. */
function cpfLimpo(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

/** O padrão (com curingas) bate com este CPF em todas as posições conhecidas? */
export function cpfCasa(padrao: string, cpf: string): boolean {
  if (padrao.length !== 11 || cpf.length !== 11) return false;
  for (let i = 0; i < 11; i++) {
    if (padrao[i] !== "*" && padrao[i] !== cpf[i]) return false;
  }
  return true;
}

/**
 * Quanto do nome da pessoa aparece na descrição, de 0 a 1. Token exato vale
 * cheio; prefixo de 3+ letras vale metade — é o caso do banco que trunca
 * ("JOAO CARLOS DE OLIVE"), comum em memo de TED.
 */
function cobertura(tokensPessoa: string[], tokensDesc: string[]): number {
  if (!tokensPessoa.length) return 0;
  let soma = 0;
  for (const t of tokensPessoa) {
    if (tokensDesc.includes(t)) {
      soma += 1;
      continue;
    }
    const truncado = tokensDesc.some(
      (d) => (d.length >= 3 && t.startsWith(d)) || (t.length >= 3 && d.startsWith(t))
    );
    if (truncado) soma += 0.5;
  }
  return soma / tokensPessoa.length;
}

/** Cobertura mínima para um casamento fraco valer aviso. */
const MIN_PARCIAL = 0.6;

/** Avalia UMA pessoa contra a descrição já tokenizada. */
function avaliar(
  pessoa: PessoaFolha,
  tokensDesc: string[],
  cpfsDaDescricao: string[]
): ViaCasamento | null {
  const cpf = cpfLimpo(pessoa.cpf);
  if (cpf && cpfsDaDescricao.some((p) => cpfCasa(p, cpf))) return "cpf";

  const tp = tokensDeNome(pessoa.nome);
  // Nome de uma palavra só não casa por nome: não discrimina ninguém.
  if (tp.length < 2 || !tokensDesc.length) return null;
  // O primeiro nome é obrigatório: sem ele, sobrenome comum casaria meio mundo.
  if (!tokensDesc.includes(tp[0]) && !tokensDesc.some((d) => d.length >= 3 && tp[0].startsWith(d))) {
    return null;
  }

  const c = cobertura(tp, tokensDesc);
  if (c >= 0.999) return "nome";
  // Exige um sobrenome de verdade junto do primeiro nome, não só cobertura.
  const temSobrenome = tp.slice(1).some((t) => tokensDesc.includes(t));
  if (c >= MIN_PARCIAL && temSobrenome) return "parcial";
  return null;
}

const FORCA: Record<ViaCasamento, number> = { cpf: 3, nome: 2, parcial: 1 };

/**
 * Índice para não varrer as 19 mil pessoas a cada linha do extrato: candidato é
 * quem compartilha ao menos um token de nome com a descrição (ou o CPF).
 */
export interface IndicePessoas {
  porToken: Map<string, PessoaFolha[]>;
  /** Mesmo índice pelas 4 primeiras letras: acha o nome truncado pelo banco. */
  porPrefixo: Map<string, PessoaFolha[]>;
  comCpf: PessoaFolha[];
}

const TAM_PREFIXO = 4;

function acrescentar(mapa: Map<string, PessoaFolha[]>, chave: string, p: PessoaFolha): void {
  const lista = mapa.get(chave);
  if (lista) lista.push(p);
  else mapa.set(chave, [p]);
}

export function indexarPessoas(pessoas: PessoaFolha[]): IndicePessoas {
  const porToken = new Map<string, PessoaFolha[]>();
  const porPrefixo = new Map<string, PessoaFolha[]>();
  const comCpf: PessoaFolha[] = [];
  for (const p of pessoas) {
    for (const t of new Set(tokensDeNome(p.nome))) {
      acrescentar(porToken, t, p);
      if (t.length >= TAM_PREFIXO) acrescentar(porPrefixo, t.slice(0, TAM_PREFIXO), p);
    }
    if (cpfLimpo(p.cpf)) comCpf.push(p);
  }
  return { porToken, porPrefixo, comCpf };
}

/**
 * A pessoa da folha por trás de uma descrição do extrato, ou null.
 *
 * Preferência entre candidatos: força do casamento (CPF > nome > parcial), depois
 * empresa do extrato antes das outras, depois quem está ativo, depois o vínculo
 * mais recente. Dois candidatos DIFERENTES no topo viram `homonimos` — o selo
 * sai, mas dizendo que há mais de um.
 */
export function casarPessoa(
  descricao: string,
  indice: IndicePessoas,
  empresaDoExtrato: number
): SeloFolha | null {
  const tokensDesc = tokensDeDescricao(descricao);
  const cpfs = padroesCpf(descricao);
  if (!tokensDesc.length && !cpfs.length) return null;

  const candidatos = new Set<PessoaFolha>();
  for (const t of tokensDesc) {
    for (const p of indice.porToken.get(t) ?? []) candidatos.add(p);
    // Truncamento ("OLIVE" por "OLIVEIRA") não bate por chave exata — o índice
    // de prefixo acha sem varrer a base inteira a cada linha do extrato.
    if (t.length >= TAM_PREFIXO) {
      for (const p of indice.porPrefixo.get(t.slice(0, TAM_PREFIXO)) ?? []) candidatos.add(p);
    }
  }
  if (cpfs.length) for (const p of indice.comCpf) candidatos.add(p);

  const achados: { p: PessoaFolha; via: ViaCasamento }[] = [];
  for (const p of candidatos) {
    const via = avaliar(p, tokensDesc, cpfs);
    if (via) achados.push({ p, via });
  }
  if (!achados.length) return null;

  achados.sort((a, b) => {
    const forca = FORCA[b.via] - FORCA[a.via];
    if (forca) return forca;
    const empresa =
      Number(b.p.empresa === empresaDoExtrato) - Number(a.p.empresa === empresaDoExtrato);
    if (empresa) return empresa;
    const ativo = Number(b.p.datadem == null) - Number(a.p.datadem == null);
    if (ativo) return ativo;
    return (b.p.dataadm ?? "").localeCompare(a.p.dataadm ?? "");
  });

  const [melhor, ...resto] = achados;
  // Multi-vínculo da MESMA pessoa (dois contratos, mesmo CPF/nome) não é
  // homônimo: quem confunde o contábil é gente diferente com nome igual.
  const identidade = (p: PessoaFolha) => cpfLimpo(p.cpf) ?? normalizar(p.nome);
  const eu = identidade(melhor.p);
  const homonimos = new Set(
    resto.filter((a) => a.via === melhor.via).map((a) => identidade(a.p)).filter((id) => id !== eu)
  ).size;

  return {
    nome: melhor.p.nome,
    empresa: melhor.p.empresa,
    contrato: melhor.p.contrato,
    via: melhor.via,
    mesmaEmpresa: melhor.p.empresa === empresaDoExtrato,
    dataadm: melhor.p.dataadm,
    datadem: melhor.p.datadem,
    homonimos,
  };
}
