import type { Metadata } from "next";
import { CascaPublica } from "@/componentes/casca/casca-publica";
import { AcompanharView } from "./acompanhar-view";

export const metadata: Metadata = { title: { absolute: "Acompanhar Denúncia · RH da Navecon" } };

/**
 * Acompanhamento aberto de uma denúncia, por protocolo e senha, sem login. O
 * `p` da URL traz o protocolo do recibo; a senha nunca vem pelo endereço.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { p } = await searchParams;
  return (
    <CascaPublica>
      <AcompanharView protocoloInicial={typeof p === "string" ? p : ""} />
    </CascaPublica>
  );
}
