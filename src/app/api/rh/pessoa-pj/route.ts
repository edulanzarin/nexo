import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { appQuery } from "@/lib/app-db";
import { ehEmpresaRh } from "@/lib/rh";
import type { PessoaPj } from "@/lib/rh-tipos";

/**
 * Pessoas PJ do RH (rh_pessoa_pj): prestadores que não existem no Questor e a RH
 * inclui à mão. Aparecem no Diretório e podem ser editadas pela mesma ficha. O
 * cadastro (POST) traz os campos básicos; a edição pela ficha (PATCH) recebe um
 * `campos` no formato da FolhaFicha e distribui entre colunas e `extra`.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT = `select id, codigoempresa, nome, cpf_cnpj as "cpfCnpj", cargo,
        classiforgan, email::text as email,
        to_char(data_inicio, 'YYYY-MM-DD') as "dataInicio", ativo
   from rh_pessoa_pj`;

export const GET = apiRoute(() =>
  appQuery<PessoaPj>(`${SELECT} where ativo order by nome`)
);

function limpar(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export const POST = apiRoute(async (req) => {
  const b = (await req.json()) as Record<string, unknown>;
  const codigoempresa = Number(b.codigoempresa);
  const nome = limpar(b.nome);
  const email = limpar(b.email)?.toLowerCase() ?? null;
  if (!ehEmpresaRh(codigoempresa)) throw new FilterError("Empresa inválida");
  if (!nome) throw new FilterError("Informe o nome");
  if (email && !EMAIL_RE.test(email)) throw new FilterError("E-mail inválido");

  const [row] = await appQuery<PessoaPj>(
    `insert into rh_pessoa_pj
        (codigoempresa, nome, cpf_cnpj, cargo, classiforgan, email, data_inicio)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, codigoempresa, nome, cpf_cnpj as "cpfCnpj", cargo, classiforgan,
               email::text as email, to_char(data_inicio, 'YYYY-MM-DD') as "dataInicio", ativo`,
    [codigoempresa, nome, limpar(b.cpfCnpj), limpar(b.cargo), limpar(b.classiforgan), email, limpar(b.dataInicio)]
  );
  return row;
});

// Campos da ficha (FolhaFicha) que viram COLUNAS do PJ; o resto vai para `extra`.
const EXTRA_KEYS = ["salario", "nascimento", "cidade", "uf", "escolaridade", "funcao"] as const;

/** Edição pela ficha: body = { id, campos } (campos no formato FolhaFicha). */
export const PATCH = apiRoute(async (req) => {
  const b = (await req.json()) as { id?: unknown; campos?: Record<string, unknown> };
  const id = Number(b.id);
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  const campos = b.campos ?? {};

  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if ("nome" in campos) {
    const nome = limpar(campos.nome);
    if (!nome) throw new FilterError("Informe o nome");
    push("nome", nome);
  }
  if ("cpf" in campos) push("cpf_cnpj", limpar(campos.cpf));
  if ("cargo" in campos) push("cargo", limpar(campos.cargo));
  if ("classiforgan" in campos) push("classiforgan", limpar(campos.classiforgan));
  if ("dataadm" in campos) push("data_inicio", limpar(campos.dataadm));

  // Campos sem coluna própria acumulam em `extra` (merge, preservando o resto).
  const extra: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) if (k in campos) extra[k] = campos[k];
  if (Object.keys(extra).length) {
    params.push(JSON.stringify(extra));
    sets.push(`extra = extra || $${params.length}::jsonb`);
  }

  if (!sets.length) throw new FilterError("Nada para atualizar");

  const [row] = await appQuery<PessoaPj>(
    `update rh_pessoa_pj set ${sets.join(", ")} where id = $1
     returning id, codigoempresa, nome, cpf_cnpj as "cpfCnpj", cargo, classiforgan,
               email::text as email, to_char(data_inicio, 'YYYY-MM-DD') as "dataInicio", ativo`,
    params
  );
  if (!row) throw new FilterError("Pessoa não encontrada");
  return row;
});

export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  await appQuery(`update rh_pessoa_pj set ativo = false where id = $1`, [id]);
  return { ok: true };
});
