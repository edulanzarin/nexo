"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { salvarUsuario, excluirUsuario } from "../actions";
import type { UsuarioDetalhe, CargoOpcao } from "../dados";
import { AvatarCampo } from "./avatar-campo";

const input =
  "h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";
const check = "size-4 accent-[var(--ent)]";

/**
 * Cria ou edita um usuário. Toda a permissão vem dos CARGOS — a pessoa recebe um
 * ou mais, e o acesso é a união deles. Não há ajuste por usuário: precisou de
 * algo diferente, cria/atribui outro cargo. Form client sobre Server Action; a
 * checagem admin mora na action.
 */
export function UsuarioForm({
  usuario,
  cargos,
}: {
  usuario: UsuarioDetalhe | null;
  cargos: CargoOpcao[];
}) {
  return (
    <form action={salvarUsuario} className="flex flex-col gap-6">
      {usuario && <input type="hidden" name="id" value={usuario.id} />}

      <AvatarCampo
        id={usuario?.id ?? "novo"}
        nome={usuario?.nome ?? ""}
        temFoto={usuario ? usuario.avatarVersao != null : false}
        versao={usuario?.avatarVersao ?? null}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Nome</span>
          <input name="nome" required defaultValue={usuario?.nome ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Email</span>
          <input name="email" type="email" required defaultValue={usuario?.email ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Telefone</span>
          <input name="telefone" defaultValue={usuario?.telefone ?? ""} className={input} placeholder="(00) 00000-0000" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">
            Senha {usuario && <span className="text-muted">(deixe em branco para manter)</span>}
          </span>
          <input
            name="senha"
            type="password"
            autoComplete="new-password"
            required={!usuario}
            className={input}
            placeholder="••••••••"
          />
        </label>
      </section>

      <section className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={usuario ? usuario.ativo : true} className={check} />
          Ativo
        </label>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Cargos</h2>
        {cargos.length === 0 ? (
          <p className="card mt-3 px-4 py-3 text-sm text-muted">
            Nenhum cargo criado.{" "}
            <Link href="/admin/cargos/novo" className="text-accent hover:underline">
              Crie um cargo
            </Link>{" "}
            antes de cadastrar o usuário.
          </p>
        ) : (
          <div className="card mt-3 max-h-72 divide-y divide-hairline overflow-auto">
            {cargos.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                <input
                  type="checkbox"
                  name="cargos"
                  value={c.id}
                  defaultChecked={usuario?.cargos.includes(c.id) ?? false}
                  className={check}
                />
                <span className="min-w-0 truncate">{c.nome}</span>
                {c.setorNome && <span className="shrink-0 text-xs text-muted">· {c.setorNome}</span>}
                {c.admin && (
                  <span className="ml-auto flex shrink-0 items-center gap-1 rounded bg-ent/12 px-1.5 py-0.5 text-[10px] font-medium text-ent">
                    <ShieldCheck className="size-3" /> acesso total
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        {usuario ? (
          <button
            type="submit"
            formAction={excluirUsuario}
            className="h-9 rounded-lg border border-critical/40 px-3 text-sm font-medium text-critical transition-colors hover:bg-critical/10"
          >
            Excluir
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {usuario ? "Salvar" : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
