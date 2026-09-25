import { NextRequest, NextResponse } from "next/server";
import { processarEnviosAgendados } from "@/lib/envios";
import { processarRegrasRecorrentes } from "@/lib/envio-regras";

/**
 * Job das campanhas AGENDADAS. Igual ao cron da experiência: fora do apiRoute
 * (não há sessão), protegido pelo mesmo segredo `RH_CRON_SECRET`, batido por um
 * cron do host. Sem o segredo configurado, a rota fica desabilitada.
 *
 * O compose do NaveX ainda não sobe o navex-scheduler: enquanto o nexo2 estiver
 * em produção, é ele quem dispara. Dois agendadores mandariam a campanha em dobro.
 */
async function handler(req: NextRequest) {
  const segredo = process.env.RH_CRON_SECRET;
  const enviado = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!segredo || enviado !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    // Campanhas agendadas (one-shot) + regras recorrentes materializam campanhas.
    const [agendados, regras] = await Promise.all([
      processarEnviosAgendados(),
      processarRegrasRecorrentes(),
    ]);
    return NextResponse.json({ ok: true, agendados, regras });
  } catch (err) {
    console.error("[rh:cron:envios]", err);
    return NextResponse.json({ error: "Falha ao rodar o job" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
