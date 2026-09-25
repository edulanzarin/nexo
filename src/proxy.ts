import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/cookie-nome";

/**
 * Redirecionamento OTIMISTA para o login: sem cookie de sessão, uma página do
 * app manda para /login. É só conveniência, barata e sem tocar o banco. A
 * tranca de verdade é `getSessao` (páginas e layouts) e `apiRoute` (rotas): a
 * API fica de fora daqui e responde 401 em JSON, não um redirecionamento.
 *
 * `proxy` é a convenção do Next 16 (o antigo `middleware`).
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE_SESSAO)) {
    const url = req.nextUrl.clone();
    url.search = "";
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Tudo, exceto: API, assets do Next, o /login, o catálogo de componentes
  // (/sistema, só dado de mentira), as páginas públicas do RH e arquivos
  // estáticos com extensão. As do RH são abertas por link, sem conta: o
  // formulário por token (`f/`, com a barra para não pegar /fiscal e /folha, e
  // o `experiencia/` dos e-mails antigos), a denúncia e a avaliação de clima.
  // `/rh/denuncias` e `/rh/clima` seguem protegidas, porque começam com `rh`.
  matcher: ["/((?!api|_next/static|_next/image|login|sistema|f/|experiencia/|denuncia|clima|.*\.[\w]+$).*)"],
};
