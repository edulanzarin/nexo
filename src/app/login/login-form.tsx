"use client";

import { useActionState } from "react";
import { entrar, type LoginState } from "./actions";

const INICIAL: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, INICIAL);

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
          placeholder="voce@navecon.com.br"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-2">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
          placeholder="••••••••"
        />
      </label>

      {state.erro && (
        <p role="alert" className="text-xs font-medium text-critical">
          {state.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-accent mt-2 h-10 px-3 text-sm"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
