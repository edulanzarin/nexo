-- Avaliação de DESEMPENHO: trilha própria no RH, irmã da experiência.
--
-- Até aqui "avaliar o desempenho de alguém" era um modo escondido da campanha
-- genérica (envio/envio_destinatario, migrations 013/014): a avaliação morava
-- numa linha de destinatário, aceitava UMA resposta e só aparecia na aba Envios
-- — sem filtro e sem histórico por pessoa. Vira seção própria porque é outra
-- coisa: a avaliação é SOBRE um colaborador, se repete no tempo (a mesma pessoa
-- é avaliada várias vezes) e aceita VÁRIAS respostas — cada gestor do setor
-- responde a sua, identificando-se pelo nome no formulário público.
--
-- Três tabelas: a RODADA (um disparo — avulso ou o escritório inteiro), a
-- AVALIAÇÃO (uma por colaborador dentro da rodada, dona do token público) e as
-- RESPOSTAS (N por avaliação). Diferente da experiência, não há marco nem
-- unique por colaborador: o histórico é a sucessão de rodadas.

-- Um disparo. Guarda o que é comum às avaliações que saíram juntas: formulário,
-- assunto e mensagem do e-mail.
create table rh_desempenho_rodada (
  id            serial primary key,
  formulario_id integer not null references formulario (id),
  titulo        text    not null,          -- assunto do e-mail / nome da rodada
  mensagem      text,                      -- texto opcional no corpo do e-mail
  escopo        text    not null default 'avulso'
                  check (escopo in ('avulso', 'escritorio')),
  criado_por    text,                      -- usuario.id (audit, sem FK cruzada)
  criado_em     timestamptz not null default now()
);

-- Uma avaliação = um colaborador dentro de uma rodada. Dona do token público
-- (mesmo link para todos os gestores do setor, cada um responde a sua).
-- codigoempresa+codigofunccontr identificam o contrato no Questor (PJ usa o
-- contrato sintético); classiforgan é o departamento que resolve os gestores no
-- disparo; funcionario_nome é snapshot (o Questor pode mudar).
-- `encerrado_em` fecha o link: até lá a avaliação segue aceitando respostas.
create table rh_desempenho (
  id               serial primary key,
  rodada_id        integer not null references rh_desempenho_rodada (id) on delete cascade,
  codigoempresa    integer not null,
  codigofunccontr  integer not null,
  funcionario_nome text    not null,
  classiforgan     text,
  token            text    not null unique,
  status           text    not null default 'pendente'
                     check (status in ('pendente', 'enviado', 'respondido', 'erro')),
  enviado_em       timestamptz,
  encerrado_em     timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  -- o mesmo colaborador não entra duas vezes na mesma rodada (mas entra em
  -- quantas rodadas quiser — é assim que nasce o histórico).
  unique (rodada_id, codigoempresa, codigofunccontr)
);
-- Histórico de uma pessoa: as avaliações dela, da mais nova pra mais velha.
create index rh_desempenho_colab_idx
  on rh_desempenho (codigoempresa, codigofunccontr, criado_em desc);
create index rh_desempenho_status_idx on rh_desempenho (status, criado_em desc);
create index rh_desempenho_rodada_idx on rh_desempenho (rodada_id);

-- N respostas por avaliação. O nome de quem respondeu é obrigatório: é o que
-- distingue um gestor do outro quando vários respondem pelo mesmo link.
-- `valores` guarda o mapa campo_id -> resposta (plano, sem embrulho).
create table rh_desempenho_resposta (
  id                   serial primary key,
  desempenho_id        integer not null references rh_desempenho (id) on delete cascade,
  respondido_por_nome  text    not null,
  respondido_por_email citext,
  valores              jsonb   not null default '{}'::jsonb,
  respondido_em        timestamptz not null default now()
);
create index rh_desempenho_resposta_idx
  on rh_desempenho_resposta (desempenho_id, respondido_em);

create trigger rh_desempenho_touch before update on rh_desempenho
  for each row execute function conf_touch();

-- ── Mudança das avaliações que já existem ────────────────────────────────────
-- As campanhas "sobre um colaborador" viram rodadas de desempenho, com token
-- preservado (os links já enviados continuam valendo) e a resposta única virando
-- a primeira das N. A rodada herda o id do envio: fica fácil rastrear a origem.

insert into rh_desempenho_rodada (id, formulario_id, titulo, mensagem, escopo, criado_por, criado_em)
select e.id, e.formulario_id, e.titulo, e.mensagem, 'avulso', e.criado_por, e.criado_em
  from envio e
 where exists (
   select 1 from envio_destinatario d
    where d.envio_id = e.id and d.codigofunccontr is not null
 );
select setval(
  pg_get_serial_sequence('rh_desempenho_rodada', 'id'),
  coalesce((select max(id) from rh_desempenho_rodada), 0) + 1,
  false
);

insert into rh_desempenho
    (rodada_id, codigoempresa, codigofunccontr, funcionario_nome, classiforgan,
     token, status, enviado_em, criado_em)
select d.envio_id, d.codigoempresa, d.codigofunccontr,
       coalesce(nullif(btrim(d.funcionario_nome), ''), nullif(btrim(d.nome), ''), 'Colaborador'),
       d.classiforgan, d.token, d.status, d.enviado_em, e.criado_em
  from envio_destinatario d
  join envio e on e.id = d.envio_id
 where d.codigofunccontr is not null;

-- A resposta única do destinatário vira a primeira resposta da avaliação. O
-- `valores` da campanha era embrulhado ({"valores": {...}}) — aqui entra plano.
insert into rh_desempenho_resposta (desempenho_id, respondido_por_nome, valores, respondido_em)
select a.id,
       coalesce(nullif(btrim(d.respondido_por_nome), ''), 'Não informado'),
       coalesce(d.valores -> 'valores', '{}'::jsonb),
       coalesce(d.respondido_em, now())
  from envio_destinatario d
  join rh_desempenho a on a.token = d.token
 where d.codigofunccontr is not null and d.status = 'respondido';

-- ── Envio volta a ser só campanha genérica ───────────────────────────────────
-- Sem as linhas de colaborador, as colunas da migration 014 ficam sem uso e o
-- e-mail volta a ser obrigatório (era ele que a 014 relaxou). Campanha que só
-- tinha colaborador some junto — ela agora é uma rodada de desempenho.

delete from envio_destinatario where codigofunccontr is not null;
delete from envio e
 where not exists (select 1 from envio_destinatario d where d.envio_id = e.id);

drop index if exists envio_destinatario_colab_uk;
alter table envio_destinatario
  drop column codigoempresa,
  drop column codigofunccontr,
  drop column classiforgan,
  drop column funcionario_nome;
alter table envio_destinatario alter column email set not null;

-- Regra recorrente "sobre um colaborador" não tem para onde ir: desempenho é
-- disparo manual (por enquanto). Em vez de apagar a configuração de alguém, a
-- regra é DESLIGADA — fica visível na aba Automático para a RH decidir. Sem a
-- coluna `escopo`, uma regra dessas reativada volta como campanha genérica.
update envio_regra set ativo = false where escopo = 'sobre_colaborador';
alter table envio_regra drop column escopo;

-- ── Permissão ────────────────────────────────────────────────────────────────
-- Quem já enviava avaliação de desempenho fazia isso pela seção Formulários:
-- herda a seção nova, senão perderia o acesso na mudança.
insert into cargo_secao (cargo_id, modulo, secao)
select cargo_id, 'rh', 'desempenho'
  from cargo_secao where modulo = 'rh' and secao = 'formularios'
on conflict do nothing;
