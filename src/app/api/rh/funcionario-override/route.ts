import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { appQuery } from "@/lib/app-db";
import { ehEmpresaRh } from "@/lib/rh";

/**
 * Correções (overlay) sobre um funcionário do Questor. O Questor é somente
 * leitura; a RH corrige aqui e o Diretório/ficha aplicam por cima (coalesce).
 * `campos` guarda só o que foi sobrescrito, no formato da FolhaFicha; a ficha
 * ignora valores vazios (campo em branco = volta ao valor do Questor).
 */

// Campos aceitos (subconjunto da FolhaFicha + classiforgan para reatribuir setor).
const PERMITIDOS = new Set([
  "nome", "cpf", "cargo", "classiforgan", "dataadm",
  "salario", "nascimento", "cidade", "uf", "escolaridade",
]);

export const PUT = apiRoute(async (req) => {
  const b = (await req.json()) as {
    empresa?: unknown;
    contrato?: unknown;
    campos?: Record<string, unknown>;
  };
  const empresa = Number(b.empresa);
  const contrato = Number(b.contrato);
  if (!ehEmpresaRh(empresa)) throw new FilterError("Empresa inválida");
  if (!Number.isInteger(contrato)) throw new FilterError("Contrato inválido");

  const campos: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b.campos ?? {})) {
    if (!PERMITIDOS.has(k)) continue;
    if (k === "salario") campos[k] = typeof v === "number" ? v : null;
    else campos[k] = typeof v === "string" ? v.trim() : null;
  }
  if (!Object.keys(campos).length) throw new FilterError("Nada para corrigir");

  const [row] = await appQuery<{ campos: Record<string, unknown> }>(
    `insert into rh_funcionario_override (codigoempresa, codigofunccontr, campos)
     values ($1, $2, $3::jsonb)
     on conflict (codigoempresa, codigofunccontr) do update
       set campos = rh_funcionario_override.campos || excluded.campos
     returning campos`,
    [empresa, contrato, JSON.stringify(campos)]
  );
  return row;
});

export const DELETE = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const empresa = Number(sp.get("empresa"));
  const contrato = Number(sp.get("contrato"));
  if (!Number.isInteger(empresa) || !Number.isInteger(contrato)) {
    throw new FilterError("Informe empresa e contrato");
  }
  await appQuery(
    `delete from rh_funcionario_override where codigoempresa = $1 and codigofunccontr = $2`,
    [empresa, contrato]
  );
  return { ok: true };
});
