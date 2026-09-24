import "server-only";
import { pool } from "./db";
import { appQuery } from "./app-db";
import { FilterError } from "./fiscal-filters";
import { textoDoPdf } from "./pdf-texto";
import { parsearBalancetePdf } from "./implantacao-pdf";
import { casarBalancete, carregarAlvos, carregarOverrides } from "./implantacao-depara";
import type { ConfigImplantacao, LinhaCasada, LinhaOrigem } from "./implantacao-tipos";

/**
 * Orquestração server-side da implantação: junta o parser (PDF), o de-para
 * (Questor read-only + overrides do app) e a config. As rotas ficam finas; a
 * regra mora aqui. Nada escreve no Questor — só o app (config e overrides).
 */

/** PDF do balancete → linhas canônicas → casadas contra o plano da empresa. */
export async function casarPdf(
  empresa: number,
  bytes: Buffer,
  senha?: string
): Promise<LinhaCasada[]> {
  const texto = await textoDoPdf(bytes, senha);
  const linhas = parsearBalancetePdf(texto);
  if (!linhas.length) {
    throw new FilterError(
      "Não encontrei contas com saldo no PDF — confira se é um balancete com texto (não digitalizado)"
    );
  }
  return casarLinhas(empresa, linhas);
}

/**
 * Núcleo do de-para: casa linhas canônicas contra o plano da empresa (Questor
 * read-only) aplicando os overrides salvos. Reusado pelo casar (do PDF) e pelo
 * gerar (das linhas que a tela já tem em mãos, sem reprocessar o PDF).
 */
export async function casarLinhas(
  empresa: number,
  linhas: LinhaOrigem[]
): Promise<LinhaCasada[]> {
  const client = await pool.connect();
  try {
    const alvos = await carregarAlvos(client, empresa);
    if (!alvos.length) {
      throw new FilterError("A empresa não tem plano de contas no Questor");
    }
    const overrides = await carregarOverrides(empresa);
    return casarBalancete(linhas, alvos, overrides);
  } finally {
    client.release();
  }
}

/** Config resolvida: linha da empresa sobrepõe o padrão global (empresa 0). */
export async function resolverConfig(empresa: number): Promise<ConfigImplantacao> {
  const rows = await appQuery<{
    codigo_empresa: number;
    conta_implantacao: number | null;
    codigo_historico: number | null;
    complemento: string | null;
  }>(
    `select codigo_empresa, conta_implantacao, codigo_historico, complemento
       from implantacao_config where codigo_empresa in (0, $1)`,
    [empresa]
  );
  const global = rows.find((r) => r.codigo_empresa === 0);
  const daEmpresa = rows.find((r) => r.codigo_empresa === empresa);
  const pega = <T>(campo: (r: (typeof rows)[number]) => T): T | null =>
    (daEmpresa && campo(daEmpresa) != null ? campo(daEmpresa) : global ? campo(global) : null) ?? null;
  return {
    contaImplantacao: pega((r) => r.conta_implantacao),
    codigoHistorico: pega((r) => r.codigo_historico),
    complemento: pega((r) => r.complemento),
  };
}

/** Salva a config (empresa = 0 grava o padrão global). */
export async function salvarConfig(
  empresa: number,
  cfg: ConfigImplantacao
): Promise<void> {
  await appQuery(
    `insert into implantacao_config
        (codigo_empresa, conta_implantacao, codigo_historico, complemento)
     values ($1, $2, $3, $4)
     on conflict (codigo_empresa) do update set
        conta_implantacao = excluded.conta_implantacao,
        codigo_historico  = excluded.codigo_historico,
        complemento       = excluded.complemento`,
    [empresa, cfg.contaImplantacao, cfg.codigoHistorico, cfg.complemento]
  );
}

/** Salva/atualiza um casamento confirmado pelo humano (vira override). */
export async function salvarOverride(
  empresa: number,
  chave: string,
  descr: string | null,
  conta: number | null
): Promise<void> {
  await appQuery(
    `insert into implantacao_depara
        (codigo_empresa, origem_chave, origem_descr, conta_questor, confirmado)
     values ($1, $2, $3, $4, true)
     on conflict (codigo_empresa, origem_chave) do update set
        origem_descr  = excluded.origem_descr,
        conta_questor = excluded.conta_questor,
        confirmado    = true`,
    [empresa, chave, descr, conta]
  );
}
