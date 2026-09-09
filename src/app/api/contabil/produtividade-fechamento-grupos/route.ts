import { apiRoute } from "@/lib/api-route";
import { estadoGrupos, gruposDaCarteira, sincronizarGrupos } from "@/lib/carteira-grupos";
import { empresasPermitidas, getSessaoOpcional } from "@/lib/sessao";

/**
 * Os GRUPOS DE EMPRESA do Acessórias: a lista para o filtro, o estado da
 * varredura e a atualização sob demanda.
 *
 * O POST não espera terminar. São ~13 minutos (uma chamada por grupo, 425
 * ativos, ~1,8 s cada) — muito além do que o navegador aguenta. Abre a varredura
 * e devolve; quem acompanha faz GET, que lê a batida gravada a cada grupo.
 *
 * A lista sai recortada pelo escopo da sessão: grupo cujas empresas o usuário
 * não alcança não é opção de filtro, é opção que devolve vazio.
 */
export const GET = apiRoute(async () => {
  const sessao = await getSessaoOpcional();
  const escopo = sessao ? empresasPermitidas(sessao) : [];
  const [grupos, estado] = await Promise.all([
    gruposDaCarteira(escopo === "todas" ? null : escopo),
    estadoGrupos(),
  ]);
  return { grupos, estado };
});

export const POST = apiRoute(async () => {
  const aberta = await sincronizarGrupos();
  return { iniciada: aberta !== null, estado: await estadoGrupos() };
});
