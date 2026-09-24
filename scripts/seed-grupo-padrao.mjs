// Cria (ou atualiza) o grupo de empresas padrão "Todas menos NAVECON": todas as
// empresas do Questor exceto as do próprio escritório (nome com "NAVECON").
// Uso: node scripts/seed-grupo-padrao.mjs
//
// O grupo nasce no modo "exceto" (migration 038): o que se grava são as empresas
// NAVECON, e o resto do Questor entra na leitura — inclusive a empresa que for
// cadastrada depois. Idempotente (recria os itens e crava o modo); antes era uma
// foto da lista de dentro, que precisava rodar de novo a cada empresa nova.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(join(raiz, arquivo), "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const NOME = "Todas menos NAVECON";

const questor = new pg.Client({
  host: process.env.QUESTOR_DB_HOST,
  port: Number(process.env.QUESTOR_DB_PORT ?? 5432),
  database: process.env.QUESTOR_DB_NAME,
  user: process.env.QUESTOR_DB_USER,
  password: process.env.QUESTOR_DB_PASSWORD,
});
if (!process.env.APP_DB_URL) {
  console.error("Defina APP_DB_URL no .env (ex.: postgres://navex:SENHA@localhost:5083/navex).");
  process.exit(1);
}
const app = new pg.Client({ connectionString: process.env.APP_DB_URL });

await questor.connect();
await app.connect();
try {
  const { rows } = await questor.query(
    `select codigoempresa from empresa where nomeempresa ilike '%navecon%' order by codigoempresa`
  );
  const codigos = rows.map((r) => r.codigoempresa);

  await app.query("begin");
  const g = await app.query(
    `insert into empresa_grupo (nome, modo) values ($1, 'exceto')
     on conflict (nome) do update set modo = 'exceto'
     returning id`,
    [NOME]
  );
  const grupoId = g.rows[0].id;
  await app.query(`delete from empresa_grupo_item where grupo_id = $1`, [grupoId]);
  // Insert em lote via unnest — uma ida ao banco.
  await app.query(
    `insert into empresa_grupo_item (grupo_id, codigoempresa)
       select $1, x from unnest($2::int[]) as x`,
    [grupoId, codigos]
  );
  await app.query("commit");
  console.log(`Grupo "${NOME}" (id ${grupoId}): todas as empresas, exceto ${codigos.length} NAVECON.`);
} catch (err) {
  await app.query("rollback");
  console.error(`FALHOU: ${err.message}`);
  process.exitCode = 1;
} finally {
  await questor.end();
  await app.end();
}
