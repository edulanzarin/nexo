import "server-only";
import { query } from "./db";
import { appQuery } from "./app-db";
import { EMPRESAS_RH, PJ_CONTRATO_OFFSET, ehContratoPj, pjIdDoContrato } from "./rh";
import { fichaFuncionario } from "./funcionario-ficha";
import type { FuncionarioDiretorio } from "./rh-tipos";
import type { FolhaFicha } from "./types";

/**
 * Montagem do Diretório do RH: o Questor é a BASE (somente leitura) e o app-db
 * guarda a camada gravável — correções (overlay) sobre quem veio do Questor e as
 * pessoas PJ, que não existem lá. Tudo casado em TS (sem SQL cruzando bancos).
 */

export interface OverrideRow {
  codigoempresa: number;
  codigofunccontr: number;
  campos: Record<string, unknown>;
  oculto: boolean;
}

const chaveOverride = (empresa: number, contrato: number) => `${empresa}:${contrato}`;

/** Correções por (empresa, contrato). Uma linha por funcionário do Questor editado. */
export async function carregarOverrides(): Promise<Map<string, OverrideRow>> {
  const rows = await appQuery<OverrideRow>(
    `select codigoempresa, codigofunccontr, campos, oculto from rh_funcionario_override`
  );
  const m = new Map<string, OverrideRow>();
  for (const r of rows) m.set(chaveOverride(r.codigoempresa, r.codigofunccontr), r);
  return m;
}

/**
 * Nome de cada setor por classiforgan — organograma do Questor com o nome limpo
 * de `rh_setor` sobrepondo (setor renomeado) e incluindo os setores próprios
 * (origem 'app', que não existem no Questor).
 */
export async function nomesDeSetor(): Promise<Map<string, string>> {
  const [questor, app] = await Promise.all([
    query<{ classiforgan: string; nome: string }>(
      `select o.classiforgan, (array_agg(nullif(btrim(o.descrorgan), '')))[1] as nome
         from organograma o
        where o.codigoempresa = any($1::int[]) and nullif(btrim(o.descrorgan), '') is not null
        group by o.classiforgan`,
      [[...EMPRESAS_RH]]
    ),
    appQuery<{ classiforgan: string; nome: string }>(
      `select classiforgan, nome from rh_setor where ativo`
    ),
  ]);
  const m = new Map<string, string>();
  for (const r of questor) if (r.nome) m.set(r.classiforgan, r.nome);
  for (const r of app) m.set(r.classiforgan, r.nome); // app-db vence
  return m;
}

interface QuestorRow {
  codigoempresa: number;
  contrato: number;
  nome: string;
  cargo: string | null;
  setor: string | null;
  classiforgan: string | null;
  dataadm: string;
}

interface PjRow {
  id: number;
  codigoempresa: number;
  nome: string;
  cargo: string | null;
  classiforgan: string | null;
  data_inicio: string | null;
}

/** String não-vazia de um valor de overlay (jsonb), senão null. */
function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Diretório unificado: funcionários do Questor (com overlay) + pessoas PJ. */
export async function listarDiretorio(): Promise<FuncionarioDiretorio[]> {
  const [questor, pjs, overrides, setores] = await Promise.all([
    query<QuestorRow>(
      `select f.codigoempresa, f.codigofunccontr as contrato, f.nomefunc as nome,
              nullif(btrim(ca.descrcargo), '') as cargo,
              nullif(btrim(o.descrorgan), '') as setor,
              f.classiforgan,
              to_char(f.dataadm, 'YYYY-MM-DD') as dataadm
         from funcionario f
         left join cargo ca on ca.codigocargo = f.codigocargo
         left join organograma o
           on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab
          and o.classiforgan = f.classiforgan
        where f.codigoempresa = any($1::int[])
          and f.datadem is null`,
      [[...EMPRESAS_RH]]
    ),
    appQuery<PjRow>(
      `select id, codigoempresa, nome, cargo, classiforgan,
              to_char(data_inicio, 'YYYY-MM-DD') as data_inicio
         from rh_pessoa_pj where ativo`
    ),
    carregarOverrides(),
    nomesDeSetor(),
  ]);

  const lista: FuncionarioDiretorio[] = [];

  for (const f of questor) {
    const ov = overrides.get(chaveOverride(f.codigoempresa, f.contrato));
    if (ov?.oculto) continue;
    const c = ov?.campos ?? {};
    const classiforgan = texto(c.classiforgan) ?? f.classiforgan;
    const setor =
      texto(c.setor) ??
      (classiforgan ? setores.get(classiforgan) ?? null : null) ??
      f.setor;
    lista.push({
      codigoempresa: f.codigoempresa,
      contrato: f.contrato,
      nome: texto(c.nome) ?? f.nome,
      cargo: texto(c.cargo) ?? f.cargo,
      setor,
      classiforgan,
      dataadm: texto(c.dataadm) ?? f.dataadm,
      origem: "questor",
      editado: !!ov && Object.keys(c).length > 0,
    });
  }

  for (const p of pjs) {
    lista.push({
      codigoempresa: p.codigoempresa,
      contrato: PJ_CONTRATO_OFFSET + p.id,
      nome: p.nome,
      cargo: p.cargo,
      setor: p.classiforgan ? setores.get(p.classiforgan) ?? null : null,
      classiforgan: p.classiforgan,
      dataadm: p.data_inicio ?? "",
      origem: "pj",
      editado: false,
    });
  }

  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return lista;
}

// ── Ficha (com overlay / PJ) ──────────────────────────────────────────────────

/** Campos-texto da ficha que o overlay pode sobrepor direto (mesmos nomes de FolhaFicha). */
const CAMPOS_FICHA_TEXTO = [
  "nome", "cpf", "cargo", "funcao", "estabelecimento", "categoria", "tipoVinculo",
  "sexo", "nascimento", "escolaridade", "tipoSalario", "cidade", "uf",
  "dataadm", "datadem", "motivoDesligamento", "setor",
] as const;

/** Idade em anos a partir de uma data 'YYYY-MM-DD', ou null. */
function idadeDe(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  return anos;
}

/**
 * Ficha do RH: mesma ficha da Folha, mas com as correções (overlay) aplicadas e
 * resolvendo pessoas PJ (contrato sintético). NÃO altera `fichaFuncionario`, que
 * a Folha usa crua.
 */
export async function fichaRh(empresa: number, contrato: number): Promise<FolhaFicha | null> {
  if (ehContratoPj(contrato)) return fichaPj(contrato);

  const base = await fichaFuncionario(empresa, contrato);
  if (!base) return null;
  const [ov] = await appQuery<{ campos: Record<string, unknown> }>(
    `select campos from rh_funcionario_override
      where codigoempresa = $1 and codigofunccontr = $2`,
    [empresa, contrato]
  );
  const c = ov?.campos;
  if (!c || !Object.keys(c).length) return base;

  const out = { ...base } as FolhaFicha & Record<string, unknown>;
  for (const k of CAMPOS_FICHA_TEXTO) {
    const v = c[k];
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  if (typeof c.salario === "number") out.salario = c.salario;
  // Setor por classiforgan (fonte de verdade): resolve o nome vivo do setor.
  if (typeof c.classiforgan === "string" && c.classiforgan.trim()) {
    const nomes = await nomesDeSetor();
    out.classiforgan = c.classiforgan;
    out.setor = nomes.get(c.classiforgan) ?? out.setor;
  }
  if (typeof c.nascimento === "string" && c.nascimento.trim()) out.idade = idadeDe(out.nascimento);
  return out;
}

/** Ficha de uma pessoa PJ (rh_pessoa_pj) no formato FolhaFicha. */
async function fichaPj(contrato: number): Promise<FolhaFicha | null> {
  const id = pjIdDoContrato(contrato);
  const [p] = await appQuery<{
    nome: string;
    cpf_cnpj: string | null;
    cargo: string | null;
    classiforgan: string | null;
    data_inicio: string | null;
    extra: Record<string, unknown>;
  }>(
    `select nome, cpf_cnpj, cargo, classiforgan,
            to_char(data_inicio, 'YYYY-MM-DD') as data_inicio, extra
       from rh_pessoa_pj where id = $1 and ativo`,
    [id]
  );
  if (!p) return null;

  const nomes = await nomesDeSetor();
  const e = p.extra ?? {};
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  const nascimento = str(e.nascimento);
  const dias =
    p.data_inicio && !Number.isNaN(Date.parse(p.data_inicio))
      ? Math.max(0, Math.floor((Date.now() - Date.parse(p.data_inicio)) / 86_400_000))
      : null;

  return {
    contrato,
    nome: p.nome,
    cpf: p.cpf_cnpj,
    dataadm: p.data_inicio,
    datadem: null,
    tempoCasaDias: dias,
    cargo: p.cargo,
    funcao: str(e.funcao),
    setor: p.classiforgan ? nomes.get(p.classiforgan) ?? null : null,
    classiforgan: p.classiforgan,
    estabelecimento: str(e.estabelecimento),
    categoria: str(e.categoria) ?? "PJ",
    tipoVinculo: str(e.tipoVinculo) ?? "PJ",
    sexo: str(e.sexo) ?? "—",
    nascimento,
    idade: idadeDe(nascimento),
    escolaridade: str(e.escolaridade),
    salario: typeof e.salario === "number" ? e.salario : null,
    tipoSalario: str(e.tipoSalario),
    motivoDesligamento: null,
    cidade: str(e.cidade),
    uf: str(e.uf),
  };
}
