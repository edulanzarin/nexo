// Agendador embutido dos jobs do app. Roda como um serviço próprio no compose
// (nexo-scheduler) e bate as rotas de cron do app sozinho — assim o disparo
// automático (experiência, campanhas/regras e rescisões) NÃO depende de um
// crontab no host.
// Uso: node scripts/scheduler.mjs
//
// Config (via ambiente / .env):
//   RH_CRON_SECRET     obrigatório — segredo das rotas de cron (x-cron-secret).
//   SCHEDULER_APP_URL  base do app (default http://app:3000, nome do serviço na
//                      rede do compose).
//   SCHEDULER_ENVIOS_MIN   intervalo das campanhas/regras (min, default 15).
//   SCHEDULER_EXPERIENCIA_HORA  hora local do disparo diário da experiência
//                      (0-23, default 8).
//   SCHEDULER_RESCISOES_HORA  hora local do disparo diário das rescisões
//                      (0-23, default 8).
//   SCHEDULER_OBRIGACOES_HORA  hora local da varredura do Acessórias (0-23,
//                      default 5). Cedo de propósito: são ~1.200 chamadas
//                      espaçadas pelo teto de 100 req/min, então a varredura
//                      leva dezenas de minutos e deve terminar antes do
//                      expediente — a fila do dia é o que o time abre de manhã.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Carrega .env como o migrate.mjs (variável já no ambiente ganha do arquivo).
for (const arquivo of [".env.local", ".env"]) {
  try {
    for (const linha of readFileSync(join(raiz, arquivo), "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const SEGREDO = process.env.RH_CRON_SECRET;
const BASE = (process.env.SCHEDULER_APP_URL ?? "http://app:3000").replace(/\/$/, "");
const ENVIOS_MS = Math.max(1, Number(process.env.SCHEDULER_ENVIOS_MIN ?? 15)) * 60_000;
const HORA_EXPERIENCIA = Math.min(23, Math.max(0, Number(process.env.SCHEDULER_EXPERIENCIA_HORA ?? 8)));
const HORA_RESCISOES = Math.min(23, Math.max(0, Number(process.env.SCHEDULER_RESCISOES_HORA ?? 8)));
const HORA_OBRIGACOES = Math.min(23, Math.max(0, Number(process.env.SCHEDULER_OBRIGACOES_HORA ?? 5)));

if (!SEGREDO) {
  console.error("[scheduler] RH_CRON_SECRET não definido — nada a agendar. Encerrando.");
  process.exit(1);
}

function log(msg) {
  console.log(`[scheduler] ${new Date().toISOString()} ${msg}`);
}

async function bater(rota) {
  const url = `${BASE}${rota}`;
  try {
    const r = await fetch(url, { headers: { "x-cron-secret": SEGREDO } });
    const corpo = await r.json().catch(() => ({}));
    if (r.ok) log(`${rota} ok ${JSON.stringify(corpo)}`);
    else log(`${rota} FALHOU (${r.status}) ${JSON.stringify(corpo)}`);
  } catch (err) {
    log(`${rota} erro de rede: ${err?.message ?? err}`);
  }
}

// Job diário: dispara na virada da hora configurada. Checa de minuto em minuto e
// bate quando entra na hora certa (idempotente no servidor — pode rodar mais de
// uma vez no dia sem duplicar). Fecha sobre `ultimoDia` próprio por rota.
function agendarDiario(rota, hora) {
  let ultimoDia = null;
  setInterval(() => {
    const agora = new Date();
    const dia = agora.toISOString().slice(0, 10);
    if (agora.getHours() === hora && ultimoDia !== dia) {
      ultimoDia = dia;
      bater(rota);
    }
  }, 60_000);
}

// Campanhas agendadas + regras recorrentes: a cada N minutos.
log(
  `iniciado — base=${BASE}, envios a cada ${ENVIOS_MS / 60_000}min, ` +
    `experiência às ${HORA_EXPERIENCIA}h, rescisões às ${HORA_RESCISOES}h, ` +
    `obrigações às ${HORA_OBRIGACOES}h`,
);
bater("/api/rh/cron/envios");
setInterval(() => bater("/api/rh/cron/envios"), ENVIOS_MS);

// Experiência (RH): lembrete diário de 45/90 dias.
agendarDiario("/api/rh/cron/experiencia", HORA_EXPERIENCIA);

// Rescisões (DP): aviso diário de rescisões a pagar dentro/fora do prazo.
agendarDiario("/api/folha/cron/rescisoes", HORA_RESCISOES);

// Obrigações: varredura diária do Acessórias, que materializa a fila de
// entregas. É a única rota do agendador que demora dezenas de minutos — a API
// de origem cobra uma chamada por empresa sob teto de 100 req/min.
agendarDiario("/api/obrigacoes/cron/sincronizar", HORA_OBRIGACOES);
