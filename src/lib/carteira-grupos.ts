import "server-only";
import { appQuery } from "./app-db";
import { empresasDoGrupo, listarGrupos } from "./acessorias";
import type { EstadoGrupos, GrupoCarteira } from "./carteira-grupos-tipos";

/**
 * O GRUPO DE EMPRESA do Acessórias, materializado.
 *
 * O Questor não tem grupo, e o Acessórias não devolve o grupo junto da empresa:
 * medido em set/2026, `/companies/ListAll` não traz o campo e a flag `groups` é
 * aceita e ignorada. O vínculo só sai perguntando grupo a grupo — 425 ativos a
 * ~1,8 s cada, **~13 min**. Não cabe em request de tela: materializa.
 *
 * Varredura PRÓPRIA, não pendurada na da carteira (~2,5 min). São trabalhos de
 * tamanho diferente, e juntá-los faria o botão da carteira ficar seis vezes mais
 * lento sem que a tela soubesse dizer por quê — mesma razão que separou a
 * carteira da varredura de entregas na migration 035.
 */

/** Varredura que não bate há esse tempo morreu (deploy, queda) e libera a trava. */
const BATIDA_MORTA_MS = 120_000;

/**
 * Os grupos que servem de filtro: só os que têm ao menos uma empresa DENTRO do
 * escopo de quem pergunta. Grupo vazio na tela é escolha que não muda nada, e
 * grupo cheio de empresa que o usuário não alcança é promessa falsa.
 *
 * `escopo` null = sem recorte (vê todas). Lista vazia = não alcança empresa
 * nenhuma do Questor, e só sobram os grupos de empresa sem par.
 */
export async function gruposDaCarteira(escopo: number[] | null): Promise<GrupoCarteira[]> {
  // Empresa SEM par no Questor entra sempre, como na tabela do Fechamento: não
  // há código para conferir contra o escopo, e escondê-la faria o grupo parecer
  // menor do que é justamente onde o cadastro está incompleto
  // ([[Dado externo sem par no cadastro local não tem escopo]]).
  const filtro = escopo
    ? `and (e.codigoempresa is null or e.codigoempresa = any($1::int[]))`
    : "";
  return appQuery<GrupoCarteira>(
    `select g.id,
            g.nome,
            (g.status = 'Ativo') as ativo,
            count(*)::int as empresas
       from obr_grupo g
       join obr_empresa_grupo eg on eg.grupo_id = g.id
       join obr_empresa e on e.cnpj = eg.cnpj
      where e.status = 'Ativa' ${filtro}
      group by g.id, g.nome, g.status
      order by g.nome`,
    escopo ? [escopo] : []
  );
}

/** CNPJ → nomes dos grupos dele. Uma consulta para toda a tabela da tela. */
export async function gruposPorCnpj(): Promise<Map<string, string[]>> {
  const linhas = await appQuery<{ cnpj: string; nome: string }>(
    `select eg.cnpj, g.nome
       from obr_empresa_grupo eg
       join obr_grupo g on g.id = eg.grupo_id
      order by g.nome`
  );
  const mapa = new Map<string, string[]>();
  for (const l of linhas) {
    const atual = mapa.get(l.cnpj);
    if (atual) atual.push(l.nome);
    else mapa.set(l.cnpj, [l.nome]);
  }
  return mapa;
}

/** Os CNPJs de um conjunto de grupos — o filtro da tela vira recorte no servidor. */
export async function cnpjsDosGrupos(grupoIds: number[]): Promise<Set<string>> {
  if (!grupoIds.length) return new Set();
  const linhas = await appQuery<{ cnpj: string }>(
    `select distinct cnpj from obr_empresa_grupo where grupo_id = any($1::int[])`,
    [grupoIds]
  );
  return new Set(linhas.map((l) => l.cnpj));
}

export async function estadoGrupos(): Promise<EstadoGrupos> {
  const [contagem] = await appQuery<{ grupos: number; vinculos: number }>(
    `select (select count(*) from obr_grupo)::int as grupos,
            (select count(*) from obr_empresa_grupo)::int as vinculos`
  );

  const [ultima] = await appQuery<{
    terminado: string | null;
    erro: string | null;
    fora: number;
  }>(
    `select to_char(terminado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as terminado,
            erro, fora_da_carteira as fora
       from obr_grupo_sync
      where terminado_em is not null
      order by terminado_em desc limit 1`
  );

  const [rodando] = await appQuery<{ id: number; grupos: number; desde: string }>(
    `select id, grupos, to_char(iniciado_em, 'YYYY-MM-DD"T"HH24:MI:SS') as desde
       from obr_grupo_sync
      where terminado_em is null
        and batida_em > now() - ($1 || ' milliseconds')::interval
      order by iniciado_em desc limit 1`,
    [BATIDA_MORTA_MS]
  );

  return {
    grupos: contagem?.grupos ?? 0,
    vinculos: contagem?.vinculos ?? 0,
    foraDaCarteira: ultima?.fora ?? 0,
    atualizadoEm: ultima?.terminado ?? null,
    erro: ultima?.erro ?? null,
    rodando: rodando ?? null,
  };
}

/** Abre a varredura se não houver outra viva — duas ao mesmo tempo consumiriam
 *  o teto da API em dobro e se atrapalhariam no upsert. */
async function abrirSync(): Promise<number | null> {
  const [viva] = await appQuery<{ id: number }>(
    `select id from obr_grupo_sync
      where terminado_em is null
        and batida_em > now() - ($1 || ' milliseconds')::interval
      limit 1`,
    [BATIDA_MORTA_MS]
  );
  if (viva) return null;

  const [nova] = await appQuery<{ id: number }>(
    `insert into obr_grupo_sync default values returning id`
  );
  return nova.id;
}

/**
 * Varre os grupos e os vínculos. Roda em BACKGROUND: treze minutos de request
 * pendente é tempo em que o navegador desiste e o proxy corta, e ninguém saberia
 * se o trabalho continuou. Quem acompanha lê `estadoGrupos`, que a batida por
 * grupo mantém vivo.
 *
 * Devolve null quando já há uma varredura viva.
 */
export async function sincronizarGrupos(): Promise<{ id: number } | null> {
  const id = await abrirSync();
  if (id === null) return null;

  void (async () => {
    try {
      const grupos = await listarGrupos();
      await guardarGrupos(grupos);

      // Só os ativos são perguntados: o inativo continua no cadastro para
      // explicar vínculo antigo, mas gastar 1,8 s com ele é comprar treze
      // minutos de varredura para uma opção que ninguém vai filtrar.
      const ativos = grupos.filter((g) => g.status === "Ativo");

      // O conjunto de CNPJs da carteira, uma vez: a alternativa é uma consulta
      // de existência por empresa, 1.500 idas ao banco para nada.
      const naCarteira = await cnpjsDaCarteira();

      let feitos = 0;
      let vinculos = 0;
      let fora = 0;
      const paresPorGrupo = new Map<number, string[]>();

      for (const g of ativos) {
        const gid = Number(g.id);
        if (!Number.isInteger(gid)) continue;
        const empresas = await empresasDoGrupo(gid);
        const cnpjs: string[] = [];
        for (const e of empresas) {
          const cnpj = e.cnpj?.trim();
          if (!cnpj) continue;
          if (naCarteira.has(cnpj)) cnpjs.push(cnpj);
          else fora++;
        }
        paresPorGrupo.set(gid, cnpjs);
        vinculos += cnpjs.length;

        feitos++;
        await appQuery(
          `update obr_grupo_sync set grupos = $2, batida_em = now() where id = $1`,
          [id, feitos]
        );
      }

      await guardarVinculos(paresPorGrupo);

      await appQuery(
        `update obr_grupo_sync
            set terminado_em = now(), grupos = $2, vinculos = $3,
                fora_da_carteira = $4, batida_em = now()
          where id = $1`,
        [id, feitos, vinculos, fora]
      );
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : String(err);
      console.error("[acessorias:grupos]", msg);
      await appQuery(
        `update obr_grupo_sync
            set terminado_em = now(), erro = $2, batida_em = now()
          where id = $1`,
        [id, msg.slice(0, 500)]
      ).catch(() => {});
    }
  })();

  return { id };
}

async function cnpjsDaCarteira(): Promise<Set<string>> {
  const linhas = await appQuery<{ cnpj: string }>(`select cnpj from obr_empresa`);
  return new Set(linhas.map((l) => l.cnpj));
}

/** Upsert do cadastro de grupos. Grupo que sai da lista não se apaga: vínculo
 *  antigo aponta para ele, e o nome é o que torna a linha legível. */
async function guardarGrupos(
  grupos: { id: string; nome: string; status: string }[]
): Promise<void> {
  const validos = grupos
    .map((g) => ({ id: Number(g.id), nome: g.nome.trim(), status: g.status?.trim() || "?" }))
    .filter((g) => Number.isInteger(g.id) && g.nome);
  if (!validos.length) return;

  const LOTE = 200;
  for (let i = 0; i < validos.length; i += LOTE) {
    const fatia = validos.slice(i, i + LOTE);
    const placeholders = fatia
      .map((_, k) => `($${k * 3 + 1},$${k * 3 + 2},$${k * 3 + 3})`)
      .join(",");
    await appQuery(
      `insert into obr_grupo (id, nome, status) values ${placeholders}
       on conflict (id) do update set
         nome = excluded.nome,
         status = excluded.status,
         atualizado_em = now()`,
      fatia.flatMap((g) => [g.id, g.nome, g.status])
    );
  }
}

/**
 * Reescreve os vínculos dos grupos varridos. Apaga por GRUPO antes de inserir:
 * empresa sai do grupo lá, e sem apagar ela continuaria aqui para sempre — o
 * filtro devolveria empresa que não é mais daquele cliente.
 *
 * Só os grupos que foram perguntados são apagados; um grupo que a varredura não
 * alcançou mantém o que tinha. E a escrita acontece UMA vez, no fim: varredura
 * que morre no grupo 400 não deixa a tabela pela metade — deixa a de ontem
 * inteira, que é a resposta certa quando não se sabe o resto.
 */
async function guardarVinculos(porGrupo: Map<number, string[]>): Promise<void> {
  const ids = [...porGrupo.keys()];
  if (!ids.length) return;

  await appQuery(`delete from obr_empresa_grupo where grupo_id = any($1::int[])`, [ids]);

  const pares: [string, number][] = [];
  for (const [gid, cnpjs] of porGrupo) for (const c of cnpjs) pares.push([c, gid]);
  if (!pares.length) return;

  const LOTE = 500;
  for (let i = 0; i < pares.length; i += LOTE) {
    const fatia = pares.slice(i, i + LOTE);
    const placeholders = fatia.map((_, k) => `($${k * 2 + 1},$${k * 2 + 2})`).join(",");
    await appQuery(
      `insert into obr_empresa_grupo (cnpj, grupo_id) values ${placeholders}
       on conflict do nothing`,
      fatia.flat()
    );
  }
}
