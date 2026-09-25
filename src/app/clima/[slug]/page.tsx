import type { Metadata } from "next";
import { AvisoPublico, CascaPublica } from "@/componentes/casca/casca-publica";
import { rodadaAbertaPorSlug } from "@/lib/clima";
import type { RodadaPublica } from "@/lib/clima-tipos";
import { ClimaForm } from "./clima-form";

// A rodada abre e encerra no banco do app, e a página lê o banco a cada acesso:
// rodada encerrada deixa de abrir na hora. Fica explícito para nenhuma
// otimização de cache futura guardar a página com a rodada de ontem.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { absolute: "Avaliação · RH da Navecon" } };

/**
 * Avaliação anônima da empresa, por link aberto de cada rodada, sem login. A
 * rodada se resolve aqui no servidor; link que não existe ou rodada encerrada
 * viram aviso, sem formulário.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let rodada: RodadaPublica | null = null;
  let falhou = false;
  try {
    rodada = await rodadaAbertaPorSlug(slug);
  } catch (err) {
    console.error("[clima:pagina]", err);
    falhou = true;
  }

  return (
    <CascaPublica>
      {falhou ? (
        <AvisoPublico titulo="Não deu para abrir a avaliação" texto="Tente de novo em alguns minutos." />
      ) : !rodada ? (
        <AvisoPublico
          titulo="Avaliação indisponível"
          texto="Este link não existe ou a avaliação já foi encerrada. Fale com o RH da Navecon."
        />
      ) : rodada.campos.length === 0 ? (
        <AvisoPublico titulo="Avaliação sem perguntas" texto="Fale com o RH da Navecon." />
      ) : (
        <ClimaForm rodada={rodada} />
      )}
    </CascaPublica>
  );
}
