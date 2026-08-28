import { NextRequest, NextResponse } from "next/server";
import { sincronizarObrigacoes } from "@/lib/obrigacoes";

/**
 * Job da varredura do Acessórias. Como os demais crons, NÃO passa pelo apiRoute
 * (não há sessão): é protegido pelo mesmo `RH_CRON_SECRET` e batido pelo
 * scheduler embutido (scripts/scheduler.mjs, serviço nexo-scheduler) às
 * SCHEDULER_OBRIGACOES_HORA. Também dá para disparar à mão:
 *   curl -H "x-cron-secret: ..." http://<host>/api/obrigacoes/cron/sincronizar
 *
 * Demora: uma chamada por empresa, a 80/min — cerca de 20 minutos para a
 * carteira. É o piso que a API impõe (não há endpoint em lote para entregas),
 * não folga de implementação. É por isso que ela existe como job e não como rota de
 * tela — nenhum request espera por isso.
 */
async function handler(req: NextRequest) {
  const segredo = process.env.RH_CRON_SECRET;
  const enviado = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!segredo || enviado !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const resumo = await sincronizarObrigacoes();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[obrigacoes:cron:sincronizar]", err);
    return NextResponse.json({ error: "Falha ao sincronizar" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;

// A varredura é longa: sem isso o runtime corta no timeout padrão.
export const maxDuration = 3600;
