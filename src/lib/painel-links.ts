/**
 * Links dos painéis do DP para as telas que resolvem cada pendência, já com os
 * filtros ATIVOS (`ap=1`) e o período coerente com o que o painel contou — assim
 * clicar num card/item cai direto na tela com dados, sem passar pelo "Executar".
 * Quando o item tem uma empresa, o link já a seleciona (telas por empresa, como
 * Férias e eSocial, abrem prontas).
 */

function addDiasISO(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

function montar(path: string, inicio: string, fim: string, empresa?: number): string {
  const qs = new URLSearchParams({ ap: "1", inicio, fim });
  if (empresa != null) qs.set("empresas", String(empresa));
  return `${path}?${qs.toString()}`;
}

/** Rescisões a pagar — mesma janela do painel (últimos 180 dias). */
export function linkRescisoes(hoje: string, empresa?: number): string {
  return montar("/folha/rescisoes", addDiasISO(hoje, -180), hoje, empresa);
}

/** Controle de férias — referência é o fim; a tela exige uma empresa. */
export function linkFerias(hoje: string, empresa?: number): string {
  return montar("/folha/ferias", addDiasISO(hoje, -30), hoje, empresa);
}

/** eSocial — mesma janela do painel (últimos 90 dias). */
export function linkEsocial(hoje: string, empresa?: number): string {
  return montar("/folha/esocial", addDiasISO(hoje, -90), hoje, empresa);
}
