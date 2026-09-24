"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Icone } from "@/componentes/primitivos/icone";
import { entrar, type EstadoLogin } from "./actions";

export function FormularioLogin({ destino }: { destino?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [verSenha, setVerSenha] = useState(false);
  return (
    <form action={acao} className="nx-vidro w-full max-w-[380px] rounded-flutua p-7">
      <h2 className="nx-titulo text-titulo text-tinta">Entrar</h2>
      <p className="mt-1 text-corpo text-apagado">Use o e-mail da Navecon.</p>
      <input type="hidden" name="destino" value={destino ?? ""} />
      <div className="mt-6 flex flex-col gap-4">
        <Rotulado rotulo="E-mail" htmlFor="email">
          <Campo
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            icone="email"
            required
            autoFocus
            defaultValue={estado.email}
            aria-invalid={!!estado.erro || undefined}
          />
        </Rotulado>
        <Rotulado rotulo="Senha" htmlFor="senha">
          <Campo
            id="senha"
            name="senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            icone="chave"
            required
            aria-invalid={!!estado.erro || undefined}
            fim={
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                className="grid size-7 place-items-center rounded-chip text-apagado hover:text-tinta"
              >
                <Icone nome={verSenha ? "esconder" : "ver"} tamanho={15} />
              </button>
            }
          />
        </Rotulado>
        {estado.erro && (
          <p role="alert" className="flex items-center gap-1.5 text-corpo text-perigo">
            <Icone nome="erro" tamanho={15} />
            {estado.erro}
          </p>
        )}
        <Botao type="submit" variante="primario" carregando={enviando} className="mt-1 w-full">
          Entrar
        </Botao>
      </div>
    </form>
  );
}
