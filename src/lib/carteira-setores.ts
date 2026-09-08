import "server-only";
import { appQuery } from "./app-db";
import { query } from "./db";
import { listarEmpresas, type EmpresaAcessorias } from "./acessorias";
import type { EstadoCarteira, ItemCarteira } from "./carteira-setores-tipos";

/**
 * DE QUEM É A EMPRESA — o responsável por setor, vindo do Acessórias.
 *
 * O Questor sabe o que foi lançado; não sabe de quem é a empresa. A atribuição
 * mora no Acessórias, e é o que permite medir trabalho POR PESSOA sobre um dado
 * que o ERP só sabe contar por empresa.
 *
 * Duas portas de entrada, de propósito:
 *
 *  - o job de obrigações já lista a carteira inteira no primeiro passo dele, e
 *    agora essa listagem vem com os setores — `guardarSetores` é chamada de lá,
 *    sem uma requisição a mais;
 *  - `sincronizarCarteira` faz SÓ a listagem (~2,5 min contra os ~46 min do job
 *    inteiro), para a tela que depende disto poder se virar sozinha em vez de
 *    esperar a madrugada.
 */

/**
 * Setor "Contábil - Balanço Balancetes" no Acessórias.
 *
 * O id é do cadastro deles e é estável; o NOME muda quando alguém renomeia o
 * setor na tela, então casar por nome quebraria calado numa tarde qualquer. Há
 * outros setores contábeis lá — "Lançamentos" (27), preenchido igual, e "Célula
 * Contábil" (50), vazio em toda a carteira. Este é o que nomeia quem responde
 * pelo balanço e pelo balancete.
 */
export const SETOR_CONTABIL = 1;

/** Varredura que não bate há esse tempo morreu (deploy, queda) e libera a trava. */
const BATIDA_MORTA_MS = 120_000;

/**
 * A carteira ATIVA de um setor. Empresa sem responsável entra do mesmo jeito:
 * "de ninguém" é uma resposta, e escondê-la faria a carteira parecer menor do
 * que é — justamente as empresas que ninguém cobra sumiriam do relatório.
 */
export async function carteiraDoSetor(setorId: number): Promise<ItemCarteira[]> {
  return appQuery<ItemCarteira>(
    `select e.cnpj,
            e.razao,
            e.fantasia,
            e.codigoempresa,
            nullif(btrim(coalesce(s.resp_nome, '')), '') as "respNome",
            nullif(btrim(coalesce(s.resp_email, '')), '') as "respEmail"
       from obr_empresa e
       left join obr_empresa_setor s on s.cnpj = e.cnpj and s.setor_id = $1
      where e.status = 'Ativa'
      order by e.razao`,
    [setorId]
  );
}

export async function estadoCarteira(setorId = SETOR_CONTABIL): Promise<EstadoCarteira> {
  const [contagem] = await appQuery<{
    empresas: number;
    casadas: number;
    comResponsavel: number;
  }>(
    `select count(*)::int as empresas,
            count(e.codigoempresa)::int as casadas,
            count(s.resp_nome)::int as "comResponsavel"
       from obr_empresa e
       left join obr_empresa_setor s
              on s.cnpj = e.cnpj and s.setor_id = $1 and btrim(coalesce(s.resp_nome, '')) <> ''
      where e.status = 'Ativa'`,
    [setorId]
  );

  const [ultima] = await appQuery<{ terminado: string | null; erro: string | null }>(
    `select to_char(terminado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as terminado, erro
       from obr_carteira_sync
      where terminado_em is not null
      order by terminado_em desc limit 1`
  );

  const [rodando] = await appQuery<{
    id: number;
    paginas: number;
    empresas: number;
    desde: string;
  }>(
    `select id, paginas, empresas,
            to_char(iniciado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as desde
       from obr_carteira_sync
      where terminado_em is null
        and batida_em > now() - ($1 || ' milliseconds')::interval
      order by iniciado_em desc limit 1`,
    [BATIDA_MORTA_MS]
  );

  return {
    empresas: contagem?.empresas ?? 0,
    casadas: contagem?.casadas ?? 0,
    comResponsavel: contagem?.comResponsavel ?? 0,
    atualizadoEm: ultima?.terminado ?? null,
    erro: ultima?.erro ?? null,
    rodando: rodando ?? null,
  };
}

/**
 * Grava os setores das empresas varridas. Chamada pelo job de obrigações (que já
 * tem a lista na mão) e pela varredura própria.
 *
 * Apaga os setores das empresas desta leva antes de reinserir: setor sai da
 * empresa quando o Acessórias deixa de listá-lo, e sem o apagar um responsável
 * antigo sobreviveria a uma troca de time.
 */
export async function guardarSetores(empresas: EmpresaAcessorias[]): Promise<void> {
  const comSetor = empresas.filter((e) => e.Identificador && e.Departamentos?.length);
  if (!comSetor.length) return;

  // Em lotes: um insert com dezenas de milhares de linhas estoura o limite de
  // parâmetros do protocolo.
  const LOTE = 200;
  for (let i = 0; i < comSetor.length; i += LOTE) {
    const fatia = comSetor.slice(i, i + LOTE);
    const cnpjs = fatia.map((e) => e.Identificador.trim());
    await appQuery(`delete from obr_empresa_setor where cnpj = any($1::text[])`, [cnpjs]);

    const valores: unknown[][] = [];
    for (const e of fatia) {
      for (const s of e.Departamentos ?? []) {
        const setorId = Number(s.ID);
        if (!Number.isInteger(setorId)) continue;
        valores.push([
          e.Identificador.trim(),
          setorId,
          s.Nome?.trim() || `Setor ${setorId}`,
          s.RespNome?.trim() || null,
          s.RespEmail?.trim() || null,
        ]);
      }
    }
    if (!valores.length) continue;

    const placeholders = valores
      .map((_, k) => `(${Array.from({ length: 5 }, (_, j) => `$${k * 5 + j + 1}`).join(",")})`)
      .join(",");
    await appQuery(
      `insert into obr_empresa_setor (cnpj, setor_id, setor_nome, resp_nome, resp_email)
       values ${placeholders}
       on conflict (cnpj, setor_id) do update set
         setor_nome = excluded.setor_nome,
         resp_nome = excluded.resp_nome,
         resp_email = excluded.resp_email`,
      valores.flat()
    );
  }
}

const soDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * CNPJ (só dígitos) → codigoempresa do Questor. Casa por QUALQUER
 * estabelecimento, não só a matriz: o Acessórias cadastra filial como empresa
 * própria, e casar só por `codigoestab = 1` perdia 179 numa amostra de 1.200.
 */
async function mapaCnpjQuestor(): Promise<Map<string, number>> {
  const linhas = await query<{ codigoempresa: number; inscrfederal: string }>(
    `select codigoempresa, inscrfederal
       from estab
      where inscrfederal is not null and btrim(inscrfederal) <> ''`
  );
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    const k = soDigitos(l.inscrfederal);
    if (k && !mapa.has(k)) mapa.set(k, l.codigoempresa);
  }
  return mapa;
}

/** Abre a varredura se não houver outra viva — duas ao mesmo tempo dobrariam o
 *  consumo do teto da API e se atrapalhariam no upsert. */
async function abrirSync(): Promise<number | null> {
  const [viva] = await appQuery<{ id: number }>(
    `select id from obr_carteira_sync
      where terminado_em is null
        and batida_em > now() - ($1 || ' milliseconds')::interval
      limit 1`,
    [BATIDA_MORTA_MS]
  );
  if (viva) return null;

  const [nova] = await appQuery<{ id: number }>(
    `insert into obr_carteira_sync default values returning id`
  );
  return nova.id;
}

/**
 * Varre só a carteira (empresas + setores) e a grava. Roda em BACKGROUND: dois
 * minutos e meio de request pendente é tempo em que o navegador desiste, o proxy
 * corta e ninguém sabe se o trabalho continuou. Quem acompanha lê
 * `estadoCarteira`, que a batida por página mantém vivo.
 */
export async function sincronizarCarteira(): Promise<{ id: number } | null> {
  const id = await abrirSync();
  if (id === null) return null;

  void (async () => {
    try {
      let paginas = 0;
      const empresas = await listarEmpresas(false, async () => {
        paginas++;
        await appQuery(
          `update obr_carteira_sync set paginas = $2, batida_em = now() where id = $1`,
          [id, paginas]
        );
      });

      const mapa = await mapaCnpjQuestor();
      await guardarEmpresas(empresas, mapa);
      await guardarSetores(empresas);

      const casadas = empresas.filter((e) => mapa.has(soDigitos(e.Identificador))).length;
      await appQuery(
        `update obr_carteira_sync
            set terminado_em = now(), empresas = $2, casadas = $3, batida_em = now()
          where id = $1`,
        [id, empresas.length, casadas]
      );
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : String(err);
      console.error("[acessorias:carteira]", msg);
      await appQuery(
        `update obr_carteira_sync
            set terminado_em = now(), erro = $2, batida_em = now()
          where id = $1`,
        [id, msg.slice(0, 500)]
      ).catch(() => {});
    }
  })();

  return { id };
}

/**
 * Upsert da identidade da empresa. Mesma gravação que o job de obrigações faz —
 * mantida aqui para a varredura própria não depender de importar metade do
 * módulo de obrigações (e criar ciclo de import entre os dois).
 */
async function guardarEmpresas(
  empresas: EmpresaAcessorias[],
  mapa: Map<string, number>
): Promise<void> {
  if (!empresas.length) return;
  const LOTE = 200;
  for (let i = 0; i < empresas.length; i += LOTE) {
    const fatia = empresas.slice(i, i + LOTE);
    const valores = fatia.map((e) => [
      e.Identificador,
      e.Razao?.trim() || e.Identificador,
      null,
      e.Status?.trim() || "?",
      mapa.get(soDigitos(e.Identificador)) ?? null,
    ]);
    const placeholders = valores
      .map((_, k) => `(${Array.from({ length: 5 }, (_, j) => `$${k * 5 + j + 1}`).join(",")})`)
      .join(",");
    await appQuery(
      `insert into obr_empresa (cnpj, razao, fantasia, status, codigoempresa)
       values ${placeholders}
       on conflict (cnpj) do update set
         razao = excluded.razao,
         status = excluded.status,
         codigoempresa = excluded.codigoempresa,
         atualizado_em = now()`,
      valores.flat()
    );
  }
}
