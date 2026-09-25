import { NextRequest, NextResponse } from "next/server";
import { AppDbError } from "@/lib/app-db";
import { salvarRespostaPublica } from "@/lib/formulario-publico";
import type { RespostaValores } from "@/lib/formularios-tipos";

/**
 * Submissão PÚBLICA de um formulário por token (experiência ou campanha). Sem
 * apiRoute (não exige sessão) — o token é a credencial. A validação real (campos
 * obrigatórios, opções válidas) roda no servidor a partir da definição.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const r = await salvarRespostaPublica(token, {
      respondidoPorNome: String(body.respondidoPorNome ?? ""),
      respondidoPorEmail: body.respondidoPorEmail ? String(body.respondidoPorEmail) : null,
      valores: (body.valores ?? {}) as RespostaValores,
    });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[formulario:submit]", err);
    const msg = err instanceof AppDbError ? err.message : "Falha ao enviar o formulário";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
