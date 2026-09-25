import { NextRequest, NextResponse } from "next/server";
import { rodarCronExperiencia } from "@/lib/rh-experiencia-dados";

/**
 * Job diário dos lembretes de experiência. NÃO passa por apiRoute (não há
 * sessão de usuário) — é protegido por um SEGREDO próprio (`RH_CRON_SECRET`),
 * batido por um cron do host: `curl -H "x-cron-secret: ..." .../api/rh/cron/experiencia`.
 * Sem o segredo configurado, a rota fica desabilitada (não roda aberta).
 *
 * O compose do NaveX ainda não sobe o navex-scheduler: enquanto o nexo2 estiver
 * em produção, é ele quem cobra. Dois agendadores mandariam o lembrete em dobro.
 */
async function handler(req: NextRequest) {
  const segredo = process.env.RH_CRON_SECRET;
  const enviado = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!segredo || enviado !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const resumo = await rodarCronExperiencia();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[rh:cron]", err);
    return NextResponse.json({ error: "Falha ao rodar o job" }, { status: 500 });
  }
}

// Aceita GET (cron simples via curl) e POST.
export const GET = handler;
export const POST = handler;
