import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/cookie-nome";

/**
 * Redirecionamento OTIMISTA para o login: sem cookie de sessão, uma página do
 * app manda para /login. É só conveniência — barato, sem tocar o banco na edge.
 * A tranca de verdade é `getSessao` (páginas/layouts) e `apiRoute` (rotas). As
 * rotas /api ficam de fora: quem não tem sessão recebe 401 em JSON, não um
 * redirect para uma página de login.
 *
 * `proxy` é a convenção nova do Next 16 (o antigo `middleware` foi renomeado).
 */
/**
 * O Post Mortem foi módulo do escritório por duas semanas (set/2026) e voltou
 * para dentro do setor, que é onde ele nasceu: cada módulo de área tem as suas
 * duas seções, e o gestor de cada área lê a área dele.
 *
 * O redirecionamento mora AQUI, e não numa página em `/post-mortem`, porque a
 * pasta do módulo antigo deixou de existir — não há layout onde pendurá-lo.
 *
 * A Visão geral não tem para onde ir: ela cruzava setor, e é justamente o que
 * deixou de existir. Cai no launcher, que mostra os módulos que a pessoa tem.
 */
function postMortemVoltouProSetor(pathname: string): string | null {
  if (pathname !== "/post-mortem" && !pathname.startsWith("/post-mortem/")) return null;
  // Índice, Visão geral e qualquer caminho que não seja de setor caem no
  // launcher: não sobrou tela equivalente para eles.
  const m = pathname.match(/^\/post-mortem\/([a-z]+)(?:\/(\d+))?$/);
  const modulo = m && MODULO_DO_SETOR[m[1]];
  if (!m || !modulo) return "/";
  return m[2] ? `/${modulo}/post-mortem/${m[2]}` : `/${modulo}/post-mortem`;
}

/**
 * O setor -> o módulo onde ele mora. Cópia rasa de `postmortem-setores` de
 * propósito: o proxy roda na edge e não deve arrastar o catálogo (nem o que ele
 * importa) para lá por causa de um redirecionamento de compatibilidade.
 */
const MODULO_DO_SETOR: Record<string, string> = {
  dp: "folha",
  fiscal: "fiscal",
  contabil: "contabil",
  societario: "societario",
};

export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE_SESSAO)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  const destino = postMortemVoltouProSetor(req.nextUrl.pathname);
  if (destino) {
    const url = req.nextUrl.clone();
    url.pathname = destino;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Tudo, exceto: rotas de API, assets do Next, o próprio /login, os formulários
  // PÚBLICOS por token (`/f/...` unificado e o legado `/experiencia/...`), o canal
  // ANÔNIMO do RH (`/denuncia...` e `/clima/...`, acessados por link sem login) e
  // arquivos estáticos com extensão (logo, favicon...). `f/` leva a barra de
  // propósito: sem ela, pegaria /fiscal e /folha. `denuncia`/`clima` ficam sem
  // barra e só batem no início do path — `/rh/denuncias` e `/rh/clima` seguem
  // protegidos (começam com `rh`).
  matcher: [
    "/((?!api|_next/static|_next/image|login|experiencia|f/|denuncia|clima|.*\\.[\\w]+$).*)",
  ],
};
