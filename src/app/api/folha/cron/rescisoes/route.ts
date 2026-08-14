import { NextRequest, NextResponse } from "next/server";
import { rodarCronRescisoes } from "@/lib/rescisoes";

/**
 * Job diário dos avisos de rescisão a pagar. Igual aos crons do RH: NÃO passa
 * pelo apiRoute (não há sessão) — protegido pelo mesmo segredo `RH_CRON_SECRET`,
 * batido pelo scheduler embutido (scripts/scheduler.mjs, serviço nexo-scheduler),
 * às SCHEDULER_RESCISOES_HORA. Também pode ser disparado à mão:
 *   curl -H "x-cron-secret: ..." http://<host>/api/folha/cron/rescisoes
 * Sem o segredo configurado, a rota fica desabilitada (não roda aberta).
 */
async function handler(req: NextRequest) {
  const segredo = process.env.RH_CRON_SECRET;
  const enviado = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!segredo || enviado !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const resumo = await rodarCronRescisoes();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[folha:cron:rescisoes]", err);
    return NextResponse.json({ error: "Falha ao rodar o job" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
