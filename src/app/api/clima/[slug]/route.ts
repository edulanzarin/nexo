import { NextRequest, NextResponse } from "next/server";
import { AppDbError } from "@/lib/app-db";
import { salvarRespostaClima } from "@/lib/clima";
import type { RespostaValores } from "@/lib/formularios-tipos";

/**
 * Submissão PÚBLICA e ANÔNIMA de uma resposta de clima (link aberto por rodada).
 * Sem `apiRoute` e sem nome: nada amarra a resposta a uma pessoa.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const r = await salvarRespostaClima(slug, {
      valores: (body.valores ?? {}) as RespostaValores,
    });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clima:responder]", err);
    const msg = err instanceof AppDbError ? err.message : "Falha ao enviar a avaliação";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
