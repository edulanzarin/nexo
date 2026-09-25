import { redirect } from "next/navigation";

/**
 * Endereço antigo da avaliação de experiência. Os formulários por link foram
 * unificados em `/f/<token>`, mas e-mail já enviado continua apontando para cá:
 * o link segue valendo e só muda de endereço.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/f/${encodeURIComponent(token)}`);
}
