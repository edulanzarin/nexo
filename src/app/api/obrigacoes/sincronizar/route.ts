import { apiRoute } from "@/lib/api-route";
import { sincronizacaoEmAndamento, sincronizarObrigacoes } from "@/lib/obrigacoes";

/**
 * Disparo MANUAL da varredura, para quem não quer esperar o job das 5h.
 *
 * Não espera terminar: a varredura leva ~30 minutos (uma chamada por empresa a
 * 45/min, o teto medido), tempo demais para uma requisição. A rota INICIA e
 * responde; o progresso a tela lê pelo bloco `sync` da fila, que diz se há uma
 * rodando e de quando é o último retrato.
 *
 * Isso depende de o processo do app continuar vivo depois da resposta — vale
 * aqui porque o Nexo roda como servidor Node no compose, não em função efêmera.
 * Se um dia virar serverless, este disparo tem que passar a enfileirar.
 *
 * Só a seção `geral` alcança (ver api-secoes): varrer é ação de escritório, não
 * de quem cuida de um setor.
 */
export const POST = apiRoute(async () => {
  if (await sincronizacaoEmAndamento()) {
    return { iniciada: false, motivo: "Já existe uma varredura em andamento." };
  }

  // Sem await de propósito. O erro é registrado em `obr_sync` pela própria
  // função, então aqui basta não derrubar o processo com uma rejeição solta.
  void sincronizarObrigacoes().catch((err) => {
    console.error("[obrigacoes:sincronizar] varredura falhou:", err);
  });

  return { iniciada: true };
});
