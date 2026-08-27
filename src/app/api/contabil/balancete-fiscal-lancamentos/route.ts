import { pool } from "@/lib/db";
import { apiRoute, assertEmpresaVisivel } from "@/lib/api-route";
import { parseFilters, FilterError } from "@/lib/fiscal-filters";
import { balanceteFiscal, calibrarPorNatureza, type DetalheFiscal } from "@/lib/balancete-fiscal";
import { contasDoAlvo } from "@/lib/plano-contabil";
import type { BalanceteLancamento, BalanceteLancamentosResp } from "@/lib/types";

/**
 * Drill-down do lado FISCAL do balancete — o que compõe o valor ESPERADO (pelas
 * regras) de uma conta. Diferente do lado real, aqui não há lançamento pronto:
 * a lista mistura, somando exatamente a célula fiscal,
 * - `regra`: as notas que o motor usou, com o valor hipotético de cada uma;
 * - `espelho`: o movimento real que o balancete espelha (consolidação MOV,
 *   apuração IM, retenção RE, ou nota em conta sem regra) — igual ao real.
 *
 * A composição é a MESMA da rota do balancete: para a conta que o motor movimenta
 * (regrada), a nota entra pelo motor e o real de nota é ignorado; todo o resto do
 * real é espelhado.
 */
export const GET = apiRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  if (f.empresas.length !== 1) throw new FilterError("Selecione uma empresa");
  const empresa = f.empresas[0];
  await assertEmpresaVisivel(empresa);
  const classif = (sp.get("classif") ?? "").trim();
  if (!classif) throw new FilterError("classif é obrigatório");
  const natureza = sp.get("natureza") === "-1" ? -1 : 1;
  const natCol = natureza === 1 ? "contactbdeb" : "contactbcred";
  const conta = Number(sp.get("conta") ?? 0);
  const sintetica = sp.get("sintetica") === "1";

  const client = await pool.connect();
  try {
    const contas = await contasDoAlvo(client, empresa, classif, sintetica, conta);
    if (!contas.length) {
      return { lancamentos: [], total: 0 } satisfies BalanceteLancamentosResp;
    }
    const contasSet = new Set(contas);
    const p3 = [empresa, f.inicio, f.fim, contas] as const;
    // Filial: recorta a calibração (notaContas) E o real da conta, pra o drill
    // bater com a célula (filial-scoped) do balancete.
    const temEstab = f.estabs.length > 0;
    const estabNC = temEstab ? ` and codigoestab = any($4::int[])` : "";
    const ncParams = temEstab ? [empresa, f.inicio, f.fim, f.estabs] : [empresa, f.inicio, f.fim];

    // Contas que RECEBEM lançamento por nota (ME/MS) — calibra o motor: componente
    // cuja conta não aparece aqui vai na apuração, não na nota. Da empresa INTEIRA
    // (não só o alvo), pra o motor rodar idêntico ao da célula do balancete; a
    // mesma query dá as `lancadas` (notas com lançamento por nota — o gate do
    // componente principal fura pra elas).
    const notaContas = (
      await client.query<{ conta: number; natureza: number; chaveorigem: string }>(
        `select contactbdeb conta, 1 natureza, chaveorigem from lctoctb
          where codigoempresa=$1 and codigooriglctoctb='FI' and datalctoctb between $2 and $3
            and contactbdeb is not null and chaveorigem ~ '^M[ES][0-9]+$'${estabNC}
          group by contactbdeb, chaveorigem
         union all
         select contactbcred, -1, chaveorigem from lctoctb
          where codigoempresa=$1 and codigooriglctoctb='FI' and datalctoctb between $2 and $3
            and contactbcred is not null and chaveorigem ~ '^M[ES][0-9]+$'${estabNC}
          group by contactbcred, chaveorigem`,
        ncParams
      )
    ).rows;
    const NOTA_RE = /^(M[ES])0*(\d+)$/;
    const observadas = new Set<string>();
    const lancadas = new Set<string>();
    for (const r of notaContas) {
      observadas.add(`${r.natureza}:${r.conta}`);
      const m = NOTA_RE.exec(r.chaveorigem);
      if (m) lancadas.add(`${m[1]}:${m[2]}`);
    }

    // Lançamentos REAIS (itemizados) da conta, para o espelho e a origem.
    const realRows = (
      await client.query<BalanceteLancamento & { contraconta: number | null; histctb: number | null }>(
        `with lc as (
           select to_char(l.datalctoctb,'YYYY-MM-DD') data,
                  case when l.chaveorigem like 'MOV%' then 'MOV'
                       else substring(l.chaveorigem from 1 for 2) end origem,
                  case when l.chaveorigem ~ '^M[ES][0-9]+$'
                       then substring(l.chaveorigem from 3)::bigint end chave,
                  l.valorlctoctb::float valor, l.complhist hist, l.${natCol} conta,
                  l.${natCol === "contactbdeb" ? "contactbcred" : "contactbdeb"} contraconta,
                  l.codigohistctb histctb
             from lctoctb l
            where l.codigoempresa=$1 and l.codigooriglctoctb='FI'
              and l.datalctoctb between $2 and $3 and l.${natCol} = any($4::bigint[])${temEstab ? ` and l.codigoestab = any($5::int[])` : ""}
         )
         select lc.data, lc.origem, lc.chave, lc.valor, lc.conta, lc.contraconta, lc.histctb,
                coalesce(nullif(lc.hist,''), '') historico,
                coalesce(e.numeronf, s.numeronf) numero,
                upper(btrim(coalesce(e.especienf, s.especienf))) especie,
                coalesce(pe.nomepessoa, ps.nomepessoa) contraparte
           from lc
           left join lctofisent e on lc.origem='ME' and e.codigoempresa=$1 and e.chavelctofisent=lc.chave
           left join lctofissai s on lc.origem='MS' and s.codigoempresa=$1 and s.chavelctofissai=lc.chave
           left join pessoa pe on pe.codigopessoa=e.codigopessoa
           left join pessoa ps on ps.codigopessoa=s.codigopessoa
          order by lc.valor desc
          limit 2000`,
        temEstab ? [...p3, f.estabs] : [...p3]
      )
    ).rows;

    // Lado ESPERADO: o motor "replaya" cada nota; coleta a contribuição por nota.
    // `produzidas` recebe "origem:chave:natureza" das notas reproduzidas — o
    // espelho as exclui (a versão do motor substitui o real da nota).
    const produzidas = new Set<string>();
    // Natureza de serviço sem regra de conta: espelha sempre, igual à célula.
    const semRegraConta = new Set<string>();
    const porNotaConta = { produzidas: new Set<string>(), puladas: new Set<string>() };
    const detEnt: DetalheFiscal = { contas: contasSet, natureza, porNota: new Map(), regradas: new Set() };
    const detSai: DetalheFiscal = { contas: contasSet, natureza, porNota: new Map(), regradas: new Set() };
    const observadasPorNatureza = await calibrarPorNatureza(client, empresa, f.inicio, f.fim, f.estabs);
    const comum = {
      observadas, observadasPorNatureza, produzidas, lancadas,
      estabs: f.estabs, semRegraConta, porNotaConta,
    };
    const movEnt = await balanceteFiscal(client, empresa, f.inicio, f.fim, "ent", { ...comum, detalhe: detEnt });
    const movSai = await balanceteFiscal(client, empresa, f.inicio, f.fim, "sai", { ...comum, detalhe: detSai });
    const regradas = new Set<number>([...detEnt.regradas, ...detSai.regradas]);

    const regra: BalanceteLancamento[] = [...detEnt.porNota.values(), ...detSai.porNota.values()].map(
      (n) => ({
        tipo: "regra",
        data: n.data,
        origem: n.origem,
        chave: n.chave,
        conta: 0,
        valor: n.valor,
        historico: "",
        numero: n.numero,
        especie: n.especie,
        contraparte: n.contraparte,
      })
    );

    // Espelho: real que o balancete NÃO substitui pelo motor — sai do espelho a
    // nota em conta regrada E a nota que o motor reproduziu nesta natureza (em
    // qualquer conta: se foi lançada em conta errada, a versão do motor a
    // substitui — mesma regra da célula). O resto (MOV/IM/RE, nota sem regra)
    // espelha.
    const ehNota = (o: string) => o === "ME" || o === "MS";
    // Componente que a natureza fecha na apuração: a linha real dela sai do
    // espelho (é o que a célula faz) e entra como UMA linha de regra, com a soma
    // do período — senão a lista não fecha com a célula.
    const agregado = new Map<string, { valor: number; irmas: number[] }>();
    for (const mov of [movEnt, movSai]) {
      for (const [k, a] of mov.agregado) {
        if (!a.irmas.length) continue;
        const [natTxt, contaTxt] = k.split(":");
        if (Number(natTxt) !== natureza || !contasSet.has(Number(contaTxt))) continue;
        const atual = agregado.get(k);
        if (atual) atual.valor += a.valor;
        else agregado.set(k, { valor: a.valor, irmas: [...a.irmas] });
      }
    }
    const consumidas = new Set<(typeof realRows)[number]>();
    const apuracao: BalanceteLancamento[] = [];
    for (const [k, a] of agregado) {
      const [, contaTxt, histTxt] = k.split(":");
      const conta = Number(contaTxt);
      const casadas = realRows.filter(
        (r) =>
          !ehNota(r.origem) &&
          r.conta === conta &&
          r.contraconta != null &&
          a.irmas.includes(r.contraconta) &&
          String(r.histctb ?? 0) === histTxt
      );
      if (!casadas.length) continue;
      for (const r of casadas) consumidas.add(r);
      apuracao.push({
        tipo: "regra",
        data: f.fim,
        origem: "IM",
        chave: null,
        conta,
        valor: a.valor,
        historico: "Apuração do período",
        numero: null,
        especie: null,
        contraparte: null,
      });
    }

    const espelho: BalanceteLancamento[] = realRows
      .filter((r) => !consumidas.has(r))
      // Mesmo critério da célula: espelho por NOTA E CONTA.
      .filter((r) => {
        if (!ehNota(r.origem) || r.chave == null) return true;
        if (semRegraConta.has(`${r.origem}:${r.chave}`)) return true;
        const nc = `${r.origem}:${r.chave}:${natureza}:${r.conta}`;
        if (porNotaConta.produzidas.has(nc)) return false;
        if (porNotaConta.puladas.has(nc)) return true;
        return !(regradas.has(r.conta) || produzidas.has(`${r.origem}:${r.chave}:${natureza}`));
      })
      .map((r) => ({ ...r, tipo: "espelho" as const }));

    const todos = [...regra, ...apuracao, ...espelho].sort((a, b) => b.valor - a.valor);

    // Teto de linhas na resposta — o esperado por nota pode render muitas linhas
    // (uma por nota); acima disso a lista (e a soma) fica parcial, sinalizada por
    // `total > lancamentos.length`.
    return {
      lancamentos: todos.slice(0, 2000),
      total: todos.length,
    } satisfies BalanceteLancamentosResp;
  } finally {
    client.release();
  }
});
