import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { appQuery } from "@/lib/app-db";
import type { GestorRh } from "@/lib/rh-tipos";

const PAPEIS = ["supervisor", "coordenador", "outro"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gestores por DEPARTAMENTO (classiforgan) — recebem o formulário de experiência.
 *  As empresas do RH compartilham os departamentos, então o gestor não tem empresa. */
export const GET = apiRoute(async (req) => {
  const classiforgan = req.nextUrl.searchParams.get("classiforgan");
  const conds: string[] = ["ativo"];
  const params: unknown[] = [];
  if (classiforgan) {
    params.push(classiforgan);
    conds.push(`classiforgan = $${params.length}`);
  }
  return appQuery<GestorRh>(
    `select id, classiforgan, nome, email, papel, ativo
       from rh_setor_gestor
      where ${conds.join(" and ")}
      order by classiforgan, papel, nome`,
    params
  );
});

function validar(body: Record<string, unknown>) {
  const classiforgan = String(body.classiforgan ?? "").trim();
  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const papel = String(body.papel ?? "supervisor");
  if (!classiforgan) throw new FilterError("Setor inválido");
  if (!nome) throw new FilterError("Informe o nome do gestor");
  if (!EMAIL_RE.test(email)) throw new FilterError("E-mail inválido");
  if (!(PAPEIS as readonly string[]).includes(papel)) throw new FilterError("Papel inválido");
  return { classiforgan, nome, email, papel };
}

export const POST = apiRoute(async (req) => {
  const g = validar(await req.json());
  try {
    const [row] = await appQuery<GestorRh>(
      `insert into rh_setor_gestor (classiforgan, nome, email, papel)
       values ($1, $2, $3, $4)
       returning id, classiforgan, nome, email, papel, ativo`,
      [g.classiforgan, g.nome, g.email, g.papel]
    );
    return row;
  } catch (err) {
    if (err instanceof Error && /duplicate key/.test(err.message)) {
      throw new FilterError("Esse e-mail já está cadastrado neste departamento");
    }
    throw err;
  }
});

export const PATCH = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const papel = String(body.papel ?? "supervisor");
  if (!nome) throw new FilterError("Informe o nome do gestor");
  if (!EMAIL_RE.test(email)) throw new FilterError("E-mail inválido");
  if (!(PAPEIS as readonly string[]).includes(papel)) throw new FilterError("Papel inválido");
  const [row] = await appQuery<GestorRh>(
    `update rh_setor_gestor set nome = $2, email = $3, papel = $4
      where id = $1
      returning id, classiforgan, nome, email, papel, ativo`,
    [id, nome, email, papel]
  );
  if (!row) throw new FilterError("Gestor não encontrado");
  return row;
});

export const DELETE = apiRoute(async (req) => {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) throw new FilterError("ID inválido");
  await appQuery(`delete from rh_setor_gestor where id = $1`, [id]);
  return { ok: true };
});
