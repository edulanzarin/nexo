// Runner de migrations do banco PRÓPRIO do app (não toca no Questor).
// Uso: node scripts/migrate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env sem dependência extra. Mesma precedência do Next: .env.local ganha do
// .env, e variável já exportada no shell ganha das duas.
for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(join(raiz, arquivo), "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

if (!process.env.APP_DB_URL) {
  console.error("Defina APP_DB_URL no .env (ex.: postgres://navex:SENHA@localhost:5083/navex).");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.APP_DB_URL });

await client.connect();
await client.query(`
  create table if not exists _migrations (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);

const { rows } = await client.query("select nome from _migrations");
const aplicadas = new Set(rows.map((r) => r.nome));
const pasta = join(raiz, "migrations");
const pendentes = readdirSync(pasta)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !aplicadas.has(f));

if (!pendentes.length) console.log("Nada a aplicar — banco em dia.");

for (const nome of pendentes) {
  process.stdout.write(`aplicando ${nome}… `);
  // cada migration roda numa transação: ou aplica inteira, ou nada
  try {
    await client.query("begin");
    await client.query(readFileSync(join(pasta, nome), "utf8"));
    await client.query("insert into _migrations (nome) values ($1)", [nome]);
    await client.query("commit");
    console.log("ok");
  } catch (err) {
    await client.query("rollback");
    console.error(`FALHOU\n${err.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
