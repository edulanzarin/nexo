import "server-only";
import { query } from "./db";
import { rotuloEscolaridade } from "./folha-turnover";
import type { FolhaFicha } from "./types";

/**
 * Ficha completa de um contrato a partir da view `funcionario`. A QUERY é
 * compartilhada entre a Folha e o RH (que mostram a mesma ficha); cada módulo
 * serve pela SUA rota e faz o próprio gate de empresa — ver
 * [[O que dois módulos compartilham é a query, não a rota]]. A rota decide se
 * pode ver a empresa; aqui só se busca.
 */
interface Row {
  contrato: number;
  nome: string;
  cpf: string | null;
  dataadm: string | null;
  datadem: string | null;
  tempocasadias: number | null;
  cargo: string | null;
  funcao: string | null;
  setor: string | null;
  classiforgan: string | null;
  estabelecimento: string | null;
  categoria: string | null;
  tipovinculo: string | null;
  sexo: number | null;
  nascimento: string | null;
  idade: number | null;
  grauinstr: number | null;
  salario: number | null;
  tiposalario: number | null;
  descrsal: string | null;
  motivo: string | null;
  cidade: string | null;
  uf: string | null;
}

export async function fichaFuncionario(
  empresa: number,
  contrato: number
): Promise<FolhaFicha | null> {
  const [r] = await query<Row>(
    `select f.codigofunccontr as contrato, f.nomefunc as nome, f.cpffunc as cpf,
            to_char(f.dataadm, 'YYYY-MM-DD') as dataadm,
            to_char(f.datadem, 'YYYY-MM-DD') as datadem,
            case when f.datadem is not null and f.dataadm is not null then (f.datadem - f.dataadm) end as tempocasadias,
            nullif(btrim(ca.descrcargo), '') as cargo,
            nullif(btrim(fu.descrfuncao), '') as funcao,
            nullif(btrim(o.descrorgan), '') as setor,
            f.classiforgan,
            coalesce(nullif(btrim(es.apelidoestab), ''), nullif(btrim(es.nomeestab), '')) as estabelecimento,
            f.categoria, f.tipovinculo,
            f.sexo, to_char(f.datanasc, 'YYYY-MM-DD') as nascimento,
            case when f.datanasc is not null then extract(year from age(current_date, f.datanasc))::int end as idade,
            f.grauinstr, f.valorsal as salario, f.tiposalario, nullif(btrim(f.descrsal), '') as descrsal,
            cd.descrcausa as motivo,
            nullif(btrim(mu.nomemunic), '') as cidade, f.siglaestado as uf
       from funcionario f
       left join cargo ca on ca.codigocargo = f.codigocargo
       -- codigofuncao = 0 é "sem função" (a maioria só tem cargo); há um registro
       -- lixo em funcao com código 0 ("MOTORISTA DE CAMINHÃO MUNCK") que casaria
       -- para todo mundo — nullif evita puxá-lo.
       left join funcao fu on fu.codigofuncao = nullif(f.codigofuncao, 0)
       left join organograma o
         on o.codigoempresa = f.codigoempresa and o.codigoestab = f.codigoestab and o.classiforgan = f.classiforgan
       left join estab es on es.codigoempresa = f.codigoempresa and es.codigoestab = f.codigoestab
       left join lateral (
         select codigocausa from rescisao r
          where r.codigoempresa = f.codigoempresa and r.codigofunccontr = f.codigofunccontr
          order by complementar limit 1
       ) rr on true
       left join causademissao cd on cd.codigocausa = rr.codigocausa
       left join municipio mu on mu.siglaestado = f.siglaestado and mu.codigomunic = f.codigomunic
      where f.codigoempresa = $1 and f.codigofunccontr = $2`,
    [empresa, contrato]
  );

  if (!r) return null;

  return {
    contrato: r.contrato,
    nome: r.nome,
    cpf: r.cpf,
    dataadm: r.dataadm,
    datadem: r.datadem,
    tempoCasaDias: r.tempocasadias,
    cargo: r.cargo,
    funcao: r.funcao,
    setor: r.setor,
    classiforgan: r.classiforgan,
    estabelecimento: r.estabelecimento,
    categoria: r.categoria,
    tipoVinculo: r.tipovinculo,
    sexo: r.sexo === 1 ? "Masculino" : r.sexo === 2 ? "Feminino" : "—",
    nascimento: r.nascimento,
    idade: r.idade,
    escolaridade: rotuloEscolaridade(r.grauinstr),
    salario: r.salario,
    tipoSalario: r.descrsal ?? (r.tiposalario === 1 ? "Mensal" : r.tiposalario === 7 ? "Horista" : null),
    motivoDesligamento: r.motivo,
    cidade: r.cidade,
    uf: r.uf,
  };
}
