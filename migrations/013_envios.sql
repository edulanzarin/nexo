-- Campanhas de envio de formulário: a RH escolhe um formulário (ativo) e dispara
-- para gestores (todos ou alguns) e/ou e-mails avulsos, AGORA ou AGENDADO. Cada
-- destinatário recebe um token próprio (link público /f/<token>) e responde uma
-- vez. É o caminho "outros formulários" — a experiência tem trilha própria
-- (rh_experiencia), mas o formulário público e a submissão são os mesmos.

create table envio (
  id            serial primary key,
  formulario_id integer not null references formulario (id),
  tipo          text    not null default 'manual' check (tipo in ('manual', 'agendado')),
  titulo        text    not null,          -- assunto do e-mail / título da tela
  mensagem      text,                      -- texto opcional no corpo do e-mail
  agendado_para timestamptz,               -- quando disparar (null = imediato)
  criado_por    text,                      -- usuario.id (audit, sem FK cruzada)
  criado_em     timestamptz not null default now(),
  disparado_em  timestamptz                -- quando os e-mails saíram (null = ainda não)
);
create index envio_agendado_idx on envio (agendado_para) where disparado_em is null;

-- Um destinatário de uma campanha: e-mail + token + estado da resposta. Guarda
-- as respostas em `valores` (jsonb) — mesma forma da experiência.
create table envio_destinatario (
  id                  serial primary key,
  envio_id            integer not null references envio (id) on delete cascade,
  nome                text,
  email               citext  not null,
  gestor_id           integer references rh_setor_gestor (id) on delete set null,
  token               text    not null unique,
  status              text    not null default 'pendente'
                        check (status in ('pendente', 'enviado', 'respondido', 'erro')),
  valores             jsonb,
  respondido_por_nome text,
  enviado_em          timestamptz,
  respondido_em       timestamptz
);
create index envio_destinatario_envio_idx on envio_destinatario (envio_id);
