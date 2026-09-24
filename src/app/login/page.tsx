import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarcaNavex } from "@/componentes/casca/marca";
import { getSessaoOpcional } from "@/lib/sessao";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  if (await getSessaoOpcional().catch(() => null)) redirect("/");
  const { destino } = await searchParams;
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between gap-10 px-8 pt-10 pb-8 sm:px-14 lg:py-14">
        <div className="flex items-center gap-2 text-corpo text-apagado">
          <MarcaNavex tamanho={18} />
          Navecon
        </div>
        <div className="max-w-xl">
          <MarcaNavex tamanho={88} desenhar className="-ml-2" />
          <h1 className="mt-6 text-[56px] leading-[0.95] font-[680] tracking-[-0.035em] text-tinta [font-stretch:88%]">
            NaveX
          </h1>
          <p className="mt-4 max-w-md text-medio text-tinta-2">
            A plataforma de trabalho da Navecon sobre o Questor: conciliação, conferência, balancetes e a
            produtividade de cada setor.
          </p>
        </div>
        <p className="text-pequeno text-apagado">O Questor é lido, nunca alterado.</p>
      </section>
      <section className="flex items-center justify-center px-6 pb-14 lg:py-14">
        <FormularioLogin destino={destino} />
      </section>
    </main>
  );
}
