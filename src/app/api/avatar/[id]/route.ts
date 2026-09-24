import { NextRequest, NextResponse } from "next/server";
import { appQuery } from "@/lib/app-db";
import { getSessaoOpcional } from "@/lib/sessao";

/**
 * Serve a foto de perfil de um usuário. Binário, então não passa pelo `apiRoute`
 * (que embrulha em JSON) — faz a própria checagem: basta estar logado (avatar não
 * é sensível; aparece na lista do admin e no cabeçalho). 404 quando não há foto.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSessaoOpcional())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const [row] = await appQuery<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from usuario_avatar where usuario_id = $1`,
    [id]
  );
  if (!row) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      // Privado e curto: a foto pode mudar; o cache-buster (?v=) no <img> cuida
      // da atualização imediata quando troca.
      "Cache-Control": "private, max-age=300",
    },
  });
}
