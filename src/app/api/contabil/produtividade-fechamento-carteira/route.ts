import { apiRoute } from "@/lib/api-route";
import { estadoCarteira, sincronizarCarteira } from "@/lib/carteira-setores";

/**
 * A carteira do Acessórias: estado e atualização sob demanda.
 *
 * O POST NÃO espera a varredura terminar. São ~2,5 minutos (páginas de 20, teto
 * de ~45 req/min), tempo em que o navegador desiste e o proxy corta — e uma
 * resposta perdida faria parecer que o trabalho falhou, quando ele seguiu no
 * servidor. Ele abre a varredura e devolve na hora; quem acompanha faz GET, que
 * lê a batida gravada a cada página.
 *
 * A carteira também é atualizada pelo job noturno de obrigações, que já lista as
 * mesmas empresas. Este botão existe para a tela não depender da madrugada.
 */
export const GET = apiRoute(async () => estadoCarteira());

export const POST = apiRoute(async () => {
  const aberta = await sincronizarCarteira();
  return { iniciada: aberta !== null, estado: await estadoCarteira() };
});
