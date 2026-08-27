import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { balanceteFiscal, CONTA_CONTRAPARTIDA } from "@/lib/balancete-fiscal";

/** VALIDAÇÃO (temporária): mede a reprodução do motor fiscal contra os
 *  lançamentos ME/MS reais nas notas contabilizadas do período. */
export const GET = apiRoute(async (req) => {
  const f = parseFilters(req.nextUrl.searchParams);
  if (f.empresas.length !== 1) throw new FilterError("Selecione uma empresa");
  const emp = f.empresas[0];
  await assertEmpresaVisivel(emp);
  const tipo = req.nextUrl.searchParams.get("tipo") === "sai" ? "sai" : "ent";
  const prefix = tipo === "ent" ? "ME" : "MS";

  const client = await pool.connect();
  try {
    const p = [emp, f.inicio, f.fim] as const;
    const estab = f.estabs.length ? ` and codigoestab = any($4::int[])` : "";
    const pE = f.estabs.length ? [...p, f.estabs] : [...p];
    const booked = await client.query<{ chave: number }>(
      `select distinct substring(chaveorigem from 3)::bigint chave from lctoctb
        where codigoempresa=$1 and codigooriglctoctb='FI' and chaveorigem like '${prefix}%'
          and datalctoctb between $2 and $3${estab}`,
      pE
    );
    const chaves = booked.rows.map((r) => r.chave);

    // real ME/MS por conta (deb e cred)
    const real = await client.query<{ conta: number; deb: number; cred: number }>(
      `select contactbdeb::bigint conta, sum(valorlctoctb)::float deb, 0::float cred from lctoctb
        where codigoempresa=$1 and codigooriglctoctb='FI' and chaveorigem like '${prefix}%'
          and datalctoctb between $2 and $3 and contactbdeb is not null${estab} group by contactbdeb
       union all
       select contactbcred::bigint, 0::float, sum(valorlctoctb)::float from lctoctb
        where codigoempresa=$1 and codigooriglctoctb='FI' and chaveorigem like '${prefix}%'
          and datalctoctb between $2 and $3 and contactbcred is not null${estab} group by contactbcred`,
      pE
    );
    const realPorConta = new Map<number, { deb: number; cred: number }>();
    const observadas = new Set<string>();
    let realTotal = 0;
    for (const r of real.rows) {
      const m = realPorConta.get(r.conta) ?? { deb: 0, cred: 0 };
      m.deb += r.deb;
      m.cred += r.cred;
      realPorConta.set(r.conta, m);
      realTotal += r.deb + r.cred;
      if (r.deb > 0) observadas.add(`1:${r.conta}`);
      if (r.cred > 0) observadas.add(`-1:${r.conta}`);
    }

    const mov = await balanceteFiscal(client, emp, f.inicio, f.fim, tipo, {
      chavesFiltro: chaves,
      observadas,
    });

    let engineFixo = 0;
    let contrapartida = 0;
    const difs: Array<Record<string, number>> = [];
    for (const [conta, m] of mov.porConta) {
      if (conta === CONTA_CONTRAPARTIDA) {
        contrapartida = m.debito + m.credito;
        continue;
      }
      engineFixo += m.debito + m.credito;
      const r = realPorConta.get(conta) ?? { deb: 0, cred: 0 };
      const dif = Math.abs(m.debito - r.deb) + Math.abs(m.credito - r.cred);
      if (dif > 0.5)
        difs.push({
          conta,
          engDeb: Math.round(m.debito),
          realDeb: Math.round(r.deb),
          engCred: Math.round(m.credito),
          realCred: Math.round(r.cred),
          dif: Math.round(dif),
        });
    }
    difs.sort((a, b) => b.dif - a.dif);

    return {
      notasContabilizadas: chaves.length,
      notasNoMotor: mov.notas,
      componentesPulados: mov.pulados,
      engineFixoTotal: Math.round(engineFixo),
      engineContrapartida: Math.round(contrapartida),
      realFI_total: Math.round(realTotal),
      topDiferencasPorConta: difs.slice(0, 15),
    };
  } finally {
    client.release();
  }
});
