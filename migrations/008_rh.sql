-- Módulo RH (interno da Navecon): gestores por setor e o acompanhamento do
-- contrato de EXPERIÊNCIA das empresas NAVECON (1) e FOUR (888).
--
-- Contexto que o Questor NÃO dá (por isso mora aqui, no banco próprio do app):
--   - Quem é o supervisor/coordenador de cada setor e o e-mail dele. O Questor
--     não tem relação gestor→funcionário (só `codigosupervisorestagio`, p/
--     estagiário) nem e-mail de ninguém — a RH cadastra à mão.
--   - O acompanhamento da experiência: cada marco (45 e 90 dias) vira uma
--     avaliação que o gestor responde por link público, com lembretes.
--
-- Setor é referenciado pela identidade do organograma do Questor
-- (codigoempresa, codigoestab, classiforgan) — sem FK cruzando bancos, igual
-- empresa_grupo_item faz com codigoempresa.

-- Gestores de um setor. N por setor (supervisores + coordenador, sem número
-- fixo). É o destinatário do formulário de experiência de quem trabalha nele.
create table rh_setor_gestor (
  id            serial primary key,
  codigoempresa integer not null,
  codigoestab   integer not null,
  classiforgan  text    not null,           -- organograma.classiforgan (varchar)
  nome          text    not null,
  email         citext  not null,
  papel         text    not null default 'supervisor'
                  check (papel in ('supervisor', 'coordenador', 'outro')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- mesmo e-mail não se repete no mesmo setor
  unique (codigoempresa, codigoestab, classiforgan, email)
);
create index rh_setor_gestor_setor_idx
  on rh_setor_gestor (codigoempresa, codigoestab, classiforgan) where ativo;

-- Uma avaliação de experiência por contrato × marco (45 ou 90 dias). É o app
-- que cria a linha quando o marco entra na janela (job diário); guarda o token
-- público (link sem login) e o status do ciclo.
create table rh_experiencia (
  id              serial primary key,
  codigoempresa   integer  not null,
  codigofunccontr integer  not null,
  marco           smallint not null check (marco in (45, 90)),
  data_admissao   date     not null,
  data_vencimento date     not null,        -- admissão + marco
  token           text     not null unique, -- opaco, gerado no app (link público)
  status          text     not null default 'pendente'
                    check (status in ('pendente', 'enviado', 'respondido', 'atraso')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (codigoempresa, codigofunccontr, marco)
);
create index rh_experiencia_status_idx on rh_experiencia (status, data_vencimento);

-- A resposta do gestor (uma por avaliação). `respostas` guarda os critérios em
-- jsonb pra o formulário evoluir sem migration; a recomendação é estruturada.
create table rh_experiencia_resposta (
  id                  serial primary key,
  experiencia_id      integer not null unique
                        references rh_experiencia (id) on delete cascade,
  respondido_por_nome text    not null,
  respondido_por_email citext,
  recomendacao        text    not null
                        check (recomendacao in
                          ('prorrogar', 'nao_prorrogar', 'efetivar', 'desligar')),
  respostas           jsonb   not null default '{}'::jsonb,
  comentarios         text,
  respondido_em       timestamptz not null default now()
);

-- Log de lembretes enviados, pra não duplicar (o job roda diário). `dias_antes`
-- = 15/10/5/1 antes do vencimento; 0 = aviso de atraso.
create table rh_experiencia_lembrete (
  id             serial primary key,
  experiencia_id integer  not null references rh_experiencia (id) on delete cascade,
  dias_antes     smallint not null,
  destinatarios  text     not null,   -- e-mails que receberam (registro)
  enviado_em     timestamptz not null default now(),
  unique (experiencia_id, dias_antes)
);

create trigger rh_setor_gestor_touch before update on rh_setor_gestor
  for each row execute function conf_touch();

create trigger rh_experiencia_touch before update on rh_experiencia
  for each row execute function conf_touch();
