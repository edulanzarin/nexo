import type { Metadata } from "next";
import { CascaPublica } from "@/componentes/casca/casca-publica";
import { DenunciaForm } from "./denuncia-form";

export const metadata: Metadata = { title: { absolute: "Canal de Denúncia · RH da Navecon" } };

/**
 * Canal de denúncia aberto, sem login: fica fora do layout do módulo e o
 * proxy deixa passar. O relato é anônimo; ao enviar, a pessoa recebe protocolo
 * e senha para acompanhar.
 */
export default function Page() {
  return (
    <CascaPublica>
      <DenunciaForm />
    </CascaPublica>
  );
}
