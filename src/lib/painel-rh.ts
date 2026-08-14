import "server-only";
import { appQuery } from "./app-db";
import type { PainelRh, RhPanorama, RhPendencias } from "./painel-rh-tipos";

/**
 * PAINEL DO RH — a home do módulo interno da Navecon. Diferente do Contábil
 * (placar de automação) e do DP (fila operacional dos clientes): aqui é o
 * retrato do RH da CASA — o que cobra ação (experiências a decidir, denúncias
 * abertas, clima) e o que fluiu no mês. Materializa [[A home de um módulo é o
 * resumo que carrega sozinho; automação não abre sozinha]].
 *
 * Tudo é banco do app (as trilhas de experiência/denúncia/clima/envio vivem lá,
 * não no Questor) — carrega rápido, testável, sem escopo de empresa (é o pessoal
 * interno). Cada bloco é independente (`allSettled`).
 */

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function primeiroDiaMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
}

async function blocoPendencias(): Promise<RhPendencias> {
  const [row] = await appQuery<{
    exp_pendentes: number;
    exp_atrasadas: number;
    den_abertas: number;
    den_recebidas: number;
    clima_abertas: number;
    clima_respostas: number;
  }>(
    `select
        (select count(*) from rh_experiencia where status <> 'respondido')::int as exp_pendentes,
        (select count(*) from rh_experiencia where status = 'atraso')::int as exp_atrasadas,
        (select count(*) from denuncia where status in ('recebida', 'em_analise'))::int as den_abertas,
        (select count(*) from denuncia where status = 'recebida')::int as den_recebidas,
        (select count(*) from clima_rodada where status = 'aberta')::int as clima_abertas,
        (select count(*) from clima_resposta cr
           join clima_rodada r on r.id = cr.rodada_id
          where r.status = 'aberta')::int as clima_respostas`
  );
  return {
    experienciasPendentes: row?.exp_pendentes ?? 0,
    experienciasAtrasadas: row?.exp_atrasadas ?? 0,
    denunciasAbertas: row?.den_abertas ?? 0,
    denunciasRecebidas: row?.den_recebidas ?? 0,
    climaRodadasAbertas: row?.clima_abertas ?? 0,
    climaRespostasAbertas: row?.clima_respostas ?? 0,
  };
}

async function blocoPanorama(inicioMes: string): Promise<RhPanorama> {
  const [row] = await appQuery<{
    exp_resp: number;
    den_mes: number;
    campanhas: number;
    clima_resp: number;
  }>(
    `select
        (select count(*) from rh_experiencia where status = 'respondido' and atualizado_em >= $1)::int as exp_resp,
        (select count(*) from denuncia where criado_em >= $1)::int as den_mes,
        (select count(*) from envio where coalesce(disparado_em, criado_em) >= $1)::int as campanhas,
        (select count(*) from clima_resposta where criado_em >= $1)::int as clima_resp`,
    [inicioMes]
  );
  return {
    experienciasRespondidas: row?.exp_resp ?? 0,
    denunciasRecebidasMes: row?.den_mes ?? 0,
    campanhasEnviadas: row?.campanhas ?? 0,
    respostasClima: row?.clima_resp ?? 0,
  };
}

function colher<T>(r: PromiseSettledResult<T>, nome: string): T | null {
  if (r.status === "fulfilled") return r.value;
  console.error(`[painel-rh] bloco '${nome}' falhou:`, r.reason);
  return null;
}

export async function montarPainelRh(): Promise<PainelRh> {
  const fim = hojeISO();
  const inicio = primeiroDiaMes(fim);

  const [pendencias, panorama] = await Promise.allSettled([blocoPendencias(), blocoPanorama(inicio)]);

  return {
    periodo: { inicio, fim },
    pendencias: colher(pendencias, "pendencias"),
    panorama: colher(panorama, "panorama"),
  };
}
