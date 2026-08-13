"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, Building2, Briefcase } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FacetaDropdown } from "@/components/filters/faceta-dropdown";
import { Badge, Card, Segmented } from "@/components/ui";
import type { Faceta } from "@/lib/types";
import type { UsuarioLista } from "../dados";

const inputBusca =
  "h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

type Status = "todos" | "ativos" | "inativos";

function acessoLegivel(iso: string | null): string {
  if (!iso) return "nunca acessou";
  const d = new Date(iso.replace(" ", "T"));
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} ${hora}`;
}

/** Conta ocorrências de um rótulo e devolve facetas ordenadas por nome. */
function facetar(valores: (string | null)[]): Faceta[] {
  const cont = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    cont.set(v, (cont.get(v) ?? 0) + 1);
  }
  return [...cont.entries()]
    .map(([valor, qtd]) => ({ valor, rotulo: null, qtd }))
    .sort((a, b) => a.valor.localeCompare(b.valor));
}

export function UsuariosTabela({ usuarios }: { usuarios: UsuarioLista[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [cargos, setCargos] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("todos");

  const facCargo = useMemo(() => facetar(usuarios.flatMap((u) => u.cargos)), [usuarios]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (q && !u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (cargos.length && !u.cargos.some((c) => cargos.includes(c))) return false;
      if (status === "ativos" && !u.ativo) return false;
      if (status === "inativos" && u.ativo) return false;
      return true;
    });
  }, [usuarios, busca, cargos, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou email…"
            className={inputBusca}
          />
        </div>
        <FacetaDropdown
          rotulo="Cargo"
          icone={<Briefcase className="size-4" />}
          opcoes={facCargo}
          selecionados={cargos}
          onMudar={setCargos}
          buscavel
        />
        <Segmented<Status>
          aria-label="Filtrar por status"
          options={[
            { value: "todos", label: "Todos" },
            { value: "ativos", label: "Ativos" },
            { value: "inativos", label: "Inativos" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      <Card padding="none" animate="none" overflow className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Cargos</th>
                <th className="px-4 py-2.5 font-medium">Empresas</th>
                <th className="px-4 py-2.5 font-medium">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Nenhum usuário com esses filtros.
                  </td>
                </tr>
              )}
              {filtrados.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/admin/usuarios/${u.id}`)}
                  className="cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        id={u.id}
                        nome={u.nome}
                        temFoto={u.avatarVersao != null}
                        versao={u.avatarVersao}
                        size={34}
                        className={u.ativo ? "" : "opacity-50 grayscale"}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{u.nome}</span>
                          {u.admin && (
                            <Badge tone="ent" size="xs" className="shrink-0">
                              <ShieldCheck className="size-3" /> admin
                            </Badge>
                          )}
                          {!u.ativo && (
                            <Badge tone="critical" size="xs" className="shrink-0">
                              inativo
                            </Badge>
                          )}
                        </div>
                        <span className="truncate text-xs text-muted">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {u.cargos.length ? u.cargos.join(", ") : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-muted" />
                      {u.admin || u.todasEmpresas ? "todas" : "restritas"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{acessoLegivel(u.ultimo_acesso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
