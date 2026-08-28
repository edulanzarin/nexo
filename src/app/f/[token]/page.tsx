import { MarcaPublicaRh } from "@/components/logo-marca";
import { Card } from "@/components/ui";
import { resolverTokenPublico } from "@/lib/formulario-publico";
import { FormularioPublicoView } from "./formulario-publico-view";

/**
 * Formulário PÚBLICO por token (sem login) — serve tanto a experiência quanto as
 * campanhas. Fora do matcher do proxy e sem apiRoute: o token é a credencial.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dados = await resolverTokenPublico(token);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <MarcaPublicaRh className="mb-6" />

        {!dados ? (
          <Aviso
            titulo="Link inválido"
            texto="Este link não existe, expirou ou o formulário foi removido. Verifique com o RH da Navecon."
          />
        ) : dados.jaRespondido ? (
          <Aviso
            titulo={dados.avisoFechado?.titulo ?? "Formulário já respondido"}
            texto={dados.avisoFechado?.texto ?? "Este formulário já foi enviado. Obrigado!"}
          />
        ) : (
          <FormularioPublicoView token={token} dados={dados} />
        )}
      </div>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card padding="none" animate="none" className="px-6 py-8 text-center">
      <h1 className="text-lg font-semibold text-ink">{titulo}</h1>
      <p className="mt-2 text-sm text-muted">{texto}</p>
    </Card>
  );
}
