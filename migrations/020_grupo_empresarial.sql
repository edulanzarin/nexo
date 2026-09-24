-- Grupo de empresa de NEGÓCIO: agrupa empresas do Questor por grupo econômico /
-- marca (ex.: "U FIT" reúne todas as empresas da U FIT). É config de domínio,
-- gerida no módulo Configurações, e usada por features (o Relatório Post Mortem
-- tagueia o grupo do incidente).
--
-- NÃO confundir com `empresa_grupo` (migration 006), que é grupo de PERMISSÃO
-- (quais empresas um cargo enxerga). Mesma forma, propósito oposto — por isso
-- tabela e nome próprios.

create table grupo_empresarial (
  id            serial primary key,
  nome          text not null unique,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- N:N — uma empresa pode estar em vários grupos de negócio.
create table grupo_empresarial_item (
  grupo_id      integer not null references grupo_empresarial (id) on delete cascade,
  codigoempresa integer not null,
  primary key (grupo_id, codigoempresa)
);

create trigger grupo_empresarial_touch before update on grupo_empresarial
  for each row execute function conf_touch();

-- O Relatório Post Mortem passa a apontar para o grupo de NEGÓCIO, não o de
-- permissão. Sem dados reais ainda (grupo_id nasceu nulo), a troca é segura.
alter table folha_postmortem drop constraint if exists folha_postmortem_grupo_id_fkey;
alter table folha_postmortem
  add constraint folha_postmortem_grupo_id_fkey
  foreign key (grupo_id) references grupo_empresarial (id);
