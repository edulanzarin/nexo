import { NextRequest, NextResponse } from "next/server";
import { FilterError } from "./fiscal-filters";
import { AppDbError } from "./app-db";
import { getSessaoOpcional, podeSecao, podeAcessarModuloSync, podeVerEmpresa } from "./sessao";
import { secoesDoEndpoint } from "./api-secoes";
import type { ModuloId } from "./modulos";

/** Contexto do route handler do Next (o 2º argumento). `params` é uma Promise
 *  no App Router — rotas dinâmicas (`[id]`) leem o segmento por ele. */
type RouteCtx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: RouteCtx) => Promise<unknown>;

/**
 * A rota declara o módulo pelo próprio caminho: /api/fiscal/..., /api/contabil/...
 * e /api/folha/... Assim o gate mora num lugar só e nenhuma rota nasce
 * desprotegida. (/api/empresas é compartilhado — basta estar logado; /api/admin
 * exige admin.)
 */
function moduloDaRota(pathname: string): ModuloId | undefined {
  const m = pathname.match(/^\/api\/(fiscal|contabil|folha|rh)(?:\/|$)/);
  return m ? (m[1] as ModuloId) : undefined;
}

/**
 * Trava de escopo por empresa para rotas que consultam UMA empresa direto (sem
 * passar pelo funil do `buildWhere`/escopo de lista). Chame logo após ler o
 * código da empresa. Recusa empresa fora do alcance da sessão — e, por tabela,
 * as empresas do RH (invisíveis fora daquele módulo, ver `podeVerEmpresa`).
 */
export async function assertEmpresaVisivel(codigo: number): Promise<void> {
  const sessao = await getSessaoOpcional();
  if (!sessao || !podeVerEmpresa(sessao, codigo)) {
    throw new FilterError("Empresa fora do seu escopo de acesso");
  }
}

export function apiRoute(handler: Handler) {
  return async (req: NextRequest, ctx: RouteCtx) => {
    try {
      const { pathname } = req.nextUrl;

      // 1) Autenticação: toda rota do app exige sessão válida.
      const sessao = await getSessaoOpcional();
      if (!sessao) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }

      // 2) Área administrativa: só admin.
      if (pathname.startsWith("/api/admin/")) {
        if (!sessao.usuario.admin) {
          return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
        }
      }

      // 3) Autorização por SEÇÃO (binária: acessa ou não). A seção vem do
      //    registro único (endpoint -> seções donas); libera se acessa ALGUMA
      //    seção dona. Endpoint não mapeado cai no gate de módulo.
      const modulo = moduloDaRota(pathname);
      if (modulo) {
        const resto = pathname.slice(`/api/${modulo}/`.length);
        const secoes = secoesDoEndpoint(modulo, resto);
        const ok = secoes
          ? secoes.some((s) => podeSecao(sessao, modulo, s))
          : podeAcessarModuloSync(sessao, modulo);
        if (!ok) {
          return NextResponse.json(
            { error: "Você não tem acesso a esta função" },
            { status: 403 }
          );
        }
      }

      const data = await handler(req, ctx);
      return NextResponse.json(data);
    } catch (err) {
      if (err instanceof FilterError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      // Falha no banco do app tem causa e solução próprias — não confundir com o
      // Questor, senão a mensagem manda investigar o banco errado.
      if (err instanceof AppDbError) {
        console.error("[api][app]", err.message);
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      // Erro de conexão do pg pode ter mensagem vazia (AggregateError): sem o
      // fallback, o log sai em branco e não se descobre a causa.
      const message = err instanceof Error && err.message ? err.message : String(err);
      console.error("[api]", message);
      const friendly = message.includes("statement timeout")
        ? "A consulta demorou demais — restrinja o período ou as empresas"
        : "Falha ao consultar o banco do Questor";
      return NextResponse.json({ error: friendly }, { status: 500 });
    }
  };
}
