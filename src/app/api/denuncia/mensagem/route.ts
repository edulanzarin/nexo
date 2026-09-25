import { NextRequest, NextResponse } from "next/server";
import { AppDbError } from "@/lib/app-db";
import { adicionarMensagemDenunciante } from "@/lib/denuncia";

/**
 * Denunciante ANÔNIMO adiciona informação à própria denúncia (protocolo+senha).
 * Público, sem `apiRoute`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const r = await adicionarMensagemDenunciante(
      String(body.protocolo ?? "").trim(),
      String(body.senha ?? "").trim(),
      String(body.corpo ?? "")
    );
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[denuncia:mensagem]", err);
    const msg = err instanceof AppDbError ? err.message : "Falha ao enviar a mensagem";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
