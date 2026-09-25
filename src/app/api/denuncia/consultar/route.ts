import { NextRequest, NextResponse } from "next/server";
import { AppDbError } from "@/lib/app-db";
import { consultarDenuncia } from "@/lib/denuncia";

/**
 * Acompanhamento PÚBLICO de uma denúncia por protocolo+senha. A senha é a
 * credencial (verificada por hash); protocolo/senha inválidos caem no mesmo 404,
 * para não revelar se um protocolo existe.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const protocolo = String(body.protocolo ?? "").trim();
    const senha = String(body.senha ?? "").trim();
    if (!protocolo || !senha) {
      return NextResponse.json({ error: "Informe protocolo e senha" }, { status: 400 });
    }
    const d = await consultarDenuncia(protocolo, senha);
    if (!d) return NextResponse.json({ error: "Protocolo ou senha inválidos" }, { status: 404 });
    return NextResponse.json(d);
  } catch (err) {
    console.error("[denuncia:consultar]", err);
    const msg = err instanceof AppDbError ? err.message : "Falha ao consultar a denúncia";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
