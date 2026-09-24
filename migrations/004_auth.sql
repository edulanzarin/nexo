-- Login e permissões do Hub.
--
-- Três eixos de autorização, todos no banco PRÓPRIO do app (o Questor é
-- produção e read-only): MÓDULO (derivado das seções), SEÇÃO (o grão da
-- regra, view/edit por aba) e EMPRESA (o que o usuário enxerga, via grupos
-- reutilizáveis + extras individuais). Empresas são referenciadas por
-- codigoempresa (int) do Questor — sem FK cruzando bancos.
--
-- A permissão se valida no servidor (getSessao lê estas tabelas a cada
-- requisição); alterar um perfil aqui vale já na requisição seguinte.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- email sem depender de caixa

create table usuario (
  id             uuid primary key default gen_random_uuid(),
  nome           text  not null,
  email          citext not null unique,
  -- hash no formato PHC 'scrypt$N$salt_hex$hash_hex' (ver src/lib/auth.ts)
  senha_hash     text  not null,
  ativo          boolean not null default true,
  admin          boolean not null default false,
  -- atalho de escopo: vê todas as empresas, ignorando grupos/extras. Sempre
  -- true para admin; opcional para "power users".
  todas_empresas boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Sessão OPAQUE no banco: o cookie carrega só o token aleatório; a validade e
-- as permissões vêm daqui. Assim logout e revogação são imediatos e a expiração
-- é server-side (cookie roubado morre com a linha).
create table sessao (
  token       text primary key,
  usuario_id  uuid not null references usuario (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  ultimo_uso  timestamptz not null default now()
);

create index sessao_usuario_idx on sessao (usuario_id);
create index sessao_expira_idx on sessao (expira_em);

-- O GRÃO da autorização: nível por (usuário, módulo, seção). Acesso ao módulo é
-- derivado (ter ≥1 seção nele). Ausência da linha = sem acesso àquela seção.
create table usuario_secao (
  usuario_id  uuid not null references usuario (id) on delete cascade,
  modulo      text not null,
  secao       text not null,
  nivel       text not null check (nivel in ('view', 'edit')),
  primary key (usuario_id, modulo, secao)
);

-- Grupos de empresa reutilizáveis: monta uma vez ("Carteira Sul"), atribui a N
-- usuários. O acesso a empresa de um usuário = união dos grupos dele + extras.
create table empresa_grupo (
  id            serial primary key,
  nome          text not null unique,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table empresa_grupo_item (
  grupo_id      integer not null references empresa_grupo (id) on delete cascade,
  codigoempresa integer not null,
  primary key (grupo_id, codigoempresa)
);

create table usuario_grupo (
  usuario_id  uuid not null references usuario (id) on delete cascade,
  grupo_id    integer not null references empresa_grupo (id) on delete cascade,
  primary key (usuario_id, grupo_id)
);

-- Empresas soltas atribuídas direto ao usuário, fora de qualquer grupo.
create table usuario_empresa (
  usuario_id    uuid not null references usuario (id) on delete cascade,
  codigoempresa integer not null,
  primary key (usuario_id, codigoempresa)
);

-- Reusa conf_touch() (migration 001) para manter atualizado_em.
create trigger usuario_touch before update on usuario
  for each row execute function conf_touch();

create trigger empresa_grupo_touch before update on empresa_grupo
  for each row execute function conf_touch();
