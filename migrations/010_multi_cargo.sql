-- Permissão passa a vir SÓ do cargo, e a pessoa pode ter VÁRIOS cargos.
--
-- Antes: usuário tinha UM cargo (usuario.cargo_id) + ajuste fino por pessoa
-- (usuario_secao/grupo/empresa) + flags admin/todas_empresas no próprio usuário.
-- Isso espalhava a permissão em vários lugares e virava exceção por gente.
--
-- Agora: o CARGO concentra tudo (seções + grupos de empresa + os flags admin e
-- "vê todas as empresas"), e a pessoa ACUMULA cargos — o acesso é a UNIÃO deles.
-- Precisou de algo diferente? Cria/atribui outro cargo. Ser admin = ter um cargo
-- com admin=true. As tabelas de ajuste por usuário ficam sem uso (não removidas
-- aqui) e param de ser lidas pelo servidor.

-- Cargo ganha os dois flags de acesso amplo.
alter table cargo add column admin          boolean not null default false;
alter table cargo add column todas_empresas boolean not null default false;

-- Vínculo N:N — a pessoa acumula cargos; o acesso é a união deles.
create table usuario_cargo (
  usuario_id uuid    not null references usuario (id) on delete cascade,
  cargo_id   integer not null references cargo (id) on delete cascade,
  primary key (usuario_id, cargo_id)
);

-- Cargo "Administrador": acesso total. Idempotente por nome (o seed também
-- garante este cargo e o vínculo com o usuário admin).
insert into cargo (nome, admin, todas_empresas, descricao)
values ('Administrador', true, true, 'Acesso total ao sistema')
on conflict (nome) do update
  set admin = true, todas_empresas = true;

-- Migra o cargo único atual (usuario.cargo_id) para o vínculo N:N.
insert into usuario_cargo (usuario_id, cargo_id)
select id, cargo_id from usuario where cargo_id is not null
on conflict do nothing;

-- Quem era admin pelo flag do usuário herda o cargo Administrador, pra não
-- perder o acesso na virada.
insert into usuario_cargo (usuario_id, cargo_id)
select u.id, c.id
  from usuario u
  cross join cargo c
 where u.admin = true and c.nome = 'Administrador'
on conflict do nothing;
