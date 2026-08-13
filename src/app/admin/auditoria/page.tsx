import Link from "next/link";
import { assertAdmin } from "@/lib/sessao";
import { listarAuditoria } from "@/lib/auditoria";
import { MODULOS } from "@/lib/modulos";
import { tituloPagina } from "@/lib/marca";

/**
 * Trilha de auditoria (só admin). Server component: o filtro por módulo/busca
 * vem da query string, sem estado no cliente. Mostra os eventos mais recentes —
 * ver ficha, gerar laudo, exportar.
 */
export const metadata = { title: tituloPagina("Auditoria") };

const PAGINA = 100;

/** Rótulos legíveis das ações registradas. */
const ROTULO_ACAO: Record<string, string> = {
  "folha.ficha.ver": "Viu ficha (Folha)",
  "rh.ficha.ver": "Viu ficha (RH)",
  "contabil.laudo.gerar": "Gerou laudo",
  "fiscal.export": "Exportou (Fiscal)",
  "contabil.export": "Exportou (Contábil)",
  "folha.export": "Exportou (Folha)",
  "rh.export": "Exportou (RH)",
};

function rotuloAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao;
}

function formatarQuando(iso: string): string {
  const [data, hora] = iso.split("T");
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a} ${hora?.slice(0, 5) ?? ""}`.trim();
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; busca?: string; pagina?: string }>;
}) {
  await assertAdmin();
  const sp = await searchParams;
  const modulo = MODULOS.some((m) => m.id === sp.modulo) ? sp.modulo : undefined;
  const busca = sp.busca?.trim() || undefined;
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const { linhas, total } = await listarAuditoria({
    modulo,
    busca,
    limite: PAGINA,
    offset: (pagina - 1) * PAGINA,
  });
  const paginas = Math.max(1, Math.ceil(total / PAGINA));

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      ativo ? "bg-ent/12 text-ent" : "text-ink-2 hover:bg-surface-2"
    }`;

  const comFiltro = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    if (modulo) q.set("modulo", modulo);
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/admin/auditoria?${s}` : "/admin/auditoria";
  };

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-sm text-muted">
          {total} {total === 1 ? "evento" : "eventos"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={comFiltro({ modulo: undefined, pagina: undefined })} className={chip(!modulo)}>
          Todos
        </Link>
        {MODULOS.map((m) => (
          <Link
            key={m.id}
            href={comFiltro({ modulo: m.id, pagina: undefined })}
            className={chip(modulo === m.id)}
          >
            {m.titulo}
          </Link>
        ))}
        <form action="/admin/auditoria" className="ml-auto flex items-center gap-2">
          {modulo && <input type="hidden" name="modulo" value={modulo} />}
          <input
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Buscar por pessoa ou alvo…"
            className="h-9 w-64 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent/50"
          />
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Quando</th>
              <th className="px-4 py-2.5 font-medium">Quem</th>
              <th className="px-4 py-2.5 font-medium">Ação</th>
              <th className="px-4 py-2.5 font-medium">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.id} className="border-t border-hairline">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">
                    {formatarQuando(l.criado_em)}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{l.usuario_nome}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{rotuloAcao(l.acao)}</td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {l.alvo ?? "—"}
                    {l.codigoempresa != null && (
                      <span className="ml-1.5 text-xs text-muted">· empresa {l.codigoempresa}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Página {pagina} de {paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={comFiltro({ pagina: String(pagina - 1) })}
                className="rounded-lg border border-hairline px-3 py-1.5 hover:bg-surface-2"
              >
                Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link
                href={comFiltro({ pagina: String(pagina + 1) })}
                className="rounded-lg border border-hairline px-3 py-1.5 hover:bg-surface-2"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
