// Semeia (ou reseta) o usuário admin a partir de ADMIN_EMAIL / ADMIN_PASSWORD.
// Idempotente: rode quantas vezes quiser — cria o usuário se não existe, atualiza
// a senha, garante o cargo "Administrador" (acesso total) e o vínculo entre os
// dois. Toda a permissão vem do cargo. Uso: node scripts/seed-admin.mjs
//
// Migration é SQL puro e não hasheia senha; por isso o seed é um script JS. O
// formato do hash espelha src/lib/auth.ts (scrypt$N$salt_hex$hash_hex).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Mesma precedência do Next: .env.local ganha do .env; shell ganha das duas.
for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(join(raiz, arquivo), "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const email = process.env.ADMIN_EMAIL;
const senha = process.env.ADMIN_PASSWORD;
if (!email || !senha) {
  console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env (ou .env.local).");
  process.exit(1);
}

const SCRYPT_N = 16384;
async function hashSenha(s) {
  const salt = randomBytes(16);
  const hash = await scrypt(s, salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

if (!process.env.APP_DB_URL) {
  console.error("Defina APP_DB_URL no .env (ex.: postgres://navex:SENHA@localhost:5083/navex).");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.APP_DB_URL });

await client.connect();
try {
  const senhaHash = await hashSenha(senha);
  const { rows } = await client.query(
    `insert into usuario (nome, email, senha_hash, ativo)
       values ('Administrador', $1, $2, true)
     on conflict (email) do update
       set senha_hash = excluded.senha_hash, ativo = true
     returning id, (xmax = 0) as criado`,
    [email, senhaHash]
  );
  const usuarioId = rows[0].id;

  // Cargo "Administrador" (acesso total) e o vínculo — a permissão vem daqui.
  const { rows: cargoRows } = await client.query(
    `insert into cargo (nome, admin, todas_empresas, descricao)
       values ('Administrador', true, true, 'Acesso total ao sistema')
     on conflict (nome) do update set admin = true, todas_empresas = true
     returning id`
  );
  await client.query(
    `insert into usuario_cargo (usuario_id, cargo_id) values ($1, $2)
     on conflict do nothing`,
    [usuarioId, cargoRows[0].id]
  );

  console.log(rows[0].criado ? `Admin criado: ${email}` : `Admin atualizado: ${email}`);
} catch (err) {
  console.error(`FALHOU: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
