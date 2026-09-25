import { NextRequest, NextResponse } from "next/server";
import { AppDbError } from "@/lib/app-db";
import { criarDenuncia } from "@/lib/denuncia";

/**
 * Registro PÚBLICO de denúncia (sem login). Não usa `apiRoute`: o canal é aberto
 * de propósito e não há credencial de entrada — a saída é o par protocolo+senha.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const r = await criarDenuncia({
      categoria: String(body.categoria ?? ""),
      relato: String(body.relato ?? ""),
      setorEnvolvido: body.setorEnvolvido ? String(body.setorEnvolvido) : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json(r.dados);
  } catch (err) {
    console.error("[denuncia:criar]", err);
    const msg = err instanceof AppDbError ? err.message : "Falha ao registrar a denúncia";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
