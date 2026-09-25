"use client";

import { useState, type ComponentProps } from "react";
import { AvisoPublico } from "@/componentes/casca/casca-publica";
import { FolhaFormulario } from "@/componentes/produto/rh/formulario-folha";
import { mutar } from "@/hooks/mutar";

type PropsFolha = Omit<ComponentProps<typeof FolhaFormulario>, "onEnviar" | "className">;

/**
 * O lado do navegador da página aberta: a folha e o envio. O servidor já
 * resolveu o token e desenhou o que cabe a ele (link inválido, já respondido);
 * aqui só chega formulário que aceita resposta.
 */
export function FormularioPorLink({ token, ...folha }: PropsFolha & { token: string }) {
  const [enviado, setEnviado] = useState(false);

  if (enviado)
    return (
      <AvisoPublico
        tom="ok"
        titulo="Resposta enviada"
        texto="Obrigado. O RH da Navecon já recebeu a sua resposta."
      />
    );

  return (
    <FolhaFormulario
      {...folha}
      onEnviar={async (r) => {
        await mutar(`/api/f/${encodeURIComponent(token)}`, "POST", r);
        setEnviado(true);
        // No celular o botão fica no fim de uma página longa: o agradecimento
        // aparece no alto, e sem subir a pessoa veria uma tela em branco.
        window.scrollTo({ top: 0 });
      }}
    />
  );
}
