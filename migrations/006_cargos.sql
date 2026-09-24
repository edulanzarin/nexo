-- Cargos (grupos de permissão) e setores.
--
-- Antes a permissão era solta por usuário (usuario_secao + usuario_grupo +
-- usuario_empresa, um a um). Não escala: repetir o mesmo conjunto em cada
-- "Analista Contábil" é trabalhoso e inconsistente.
--
-- Agora o CARGO é o molde reutilizável: empacota um conjunto de seções
-- (cargo_secao) e grupos de empresa (cargo_grupo). O usuário recebe UM cargo
-- (usuario.cargo_id) e herda tudo dele. O que já existia por usuário vira
-- camada de AJUSTE por cima do cargo:
--   - seção: usuario_secao passa a ser OVERRIDE (vence o cargo), inclusive
--     'none' para NEGAR uma seção que o cargo concede;
--   - empresa: usuario_grupo/usuario_empresa somam ao escopo do cargo.
--
-- SETOR agrupa cargos (Contábil, Fiscal, RH…); o usuário herda o setor via cargo.

-- Setor: rótulo organizacional que agrupa cargos.
create table setor (
  id            serial primary key,
  nome          text not null unique,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Cargo = grupo de permissão. As permissões moram nas tabelas-filhas abaixo.
create table cargo (
  id            serial primary key,
  nome          text not null unique,
  setor_id      integer references setor (id) on delete set null,
  descricao     text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Seções que o cargo concede (a base herdada por quem tem o cargo).
create table cargo_secao (
  cargo_id  integer not null references cargo (id) on delete cascade,
  modulo    text not null,
  secao     text not null,
  nivel     text not null check (nivel in ('view', 'edit')),
  primary key (cargo_id, modulo, secao)
);

-- Grupos de empresa que o cargo concede (escopo herdado).
create table cargo_grupo (
  cargo_id integer not null references cargo (id) on delete cascade,
  grupo_id integer not null references empresa_grupo (id) on delete cascade,
  primary key (cargo_id, grupo_id)
);

-- O usuário recebe UM cargo. Nulo = sem cargo (ex.: admin, que ignora tudo).
alter table usuario add column cargo_id integer references cargo (id) on delete set null;

-- usuario_secao deixa de ser a fonte da permissão e vira OVERRIDE do cargo:
-- 'none' passa a ser válido para negar explicitamente uma seção herdada.
alter table usuario_secao drop constraint usuario_secao_nivel_check;
alter table usuario_secao add constraint usuario_secao_nivel_check
  check (nivel in ('none', 'view', 'edit'));

-- Cargo e setor herdam identidade; as colunas texto de perfil viram estruturadas.
alter table usuario drop column cargo;
alter table usuario drop column setor;

create trigger setor_touch before update on setor
  for each row execute function conf_touch();

create trigger cargo_touch before update on cargo
  for each row execute function conf_touch();
