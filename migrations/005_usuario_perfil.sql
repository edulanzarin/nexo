-- Perfil de usuário mais rico (e extensível para o que vier).
--
-- Campos de identidade/contato ficam na própria linha do usuário; a foto vai
-- numa tabela à parte (bytea) para não engordar o SELECT do usuário — a foto só
-- é lida quando alguém pede a imagem, pela rota de avatar.

alter table usuario
  add column cargo         text,
  add column setor         text,   -- rótulo (quem a pessoa é); o perfil é a regra
  add column telefone      text,
  add column ultimo_acesso timestamptz;

-- Foto de perfil no próprio banco do app (self-contained, sem storage externo).
-- Servida por rota com checagem de sessão; upload limitado no servidor.
create table usuario_avatar (
  usuario_id    uuid primary key references usuario (id) on delete cascade,
  mime          text not null,
  bytes         bytea not null,
  atualizado_em timestamptz not null default now()
);
