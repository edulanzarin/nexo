-- Experiência passa a usar um FORMULÁRIO montado no builder (migration 011), em
-- vez dos critérios fixos no código. A RH escolhe qual formulário sai em cada
-- marco (45 e 90 dias) e com quantos dias de antecedência o lembrete dispara
-- (padrão 7). Os marcos continuam vindo do Questor — muda só o conteúdo do
-- formulário e a antecedência do aviso.

-- Configuração por marco: qual formulário e a antecedência do disparo. Sem linha
-- para um marco = experiência daquele marco não é enviada (a RH ainda não ligou
-- um formulário). formulario_id restringe: não deixa apagar um form em uso.
create table rh_experiencia_config (
  marco         smallint primary key check (marco in (45, 90)),
  formulario_id integer  not null references formulario (id),
  dias_antes    smallint not null default 7 check (dias_antes between 0 and 60),
  atualizado_em timestamptz not null default now()
);

-- Qual formulário foi usado nesta avaliação (snapshot no momento da
-- materialização — o público renderiza a partir dele).
alter table rh_experiencia
  add column formulario_id integer references formulario (id);

-- A "recomendação" deixa de ser um enum fixo: agora é apenas um campo de decisão
-- dentro do formulário (marcado com config.papel = 'decisao'). Guardamos o valor
-- escolhido em `recomendacao` (texto livre) para os painéis, e todas as respostas
-- em `respostas` (jsonb). Relaxa a coluna: nullable e sem o check antigo.
alter table rh_experiencia_resposta
  drop constraint if exists rh_experiencia_resposta_recomendacao_check;
alter table rh_experiencia_resposta
  alter column recomendacao drop not null;
