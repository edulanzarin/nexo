-- "Este CFOP gera lançamento?" aprendido do histórico da empresa.
--
-- A config do Questor (cfop.codigotabctbfis*) não é confiável para isso: tem
-- CFOP com tabela configurada que nunca lança, e CFOP sem tabela que lança.
-- O sinal confiável é o histórico: quantas notas do CFOP foram de fato
-- contabilizadas nos últimos 12 meses. Este cadastro guarda esse aprendizado
-- (é semeado a partir do Questor, que é read-only), por empresa+estab+cfop.
--
-- Precedência na Conferência: override (conf_regra) > este aprendido > config
-- do Questor. Ao contrário da conferência antiga, que reaprendia do MÊS da tela
-- (e por isso classificava tudo como "não exige" num mês ainda não fechado).

create table if not exists conf_cfop_contabiliza (
  codigo_empresa integer not null,
  codigo_estab   integer not null,
  codigo_cfop    integer not null,
  -- veredito: o CFOP gera lançamento nota a nota?
  contabiliza    boolean not null,
  -- evidência do aprendizado (últimos 12 meses), para a tela explicar o porquê
  notas          integer not null default 0,
  contabilizadas integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  primary key (codigo_empresa, codigo_estab, codigo_cfop)
);

create index if not exists conf_cfop_contabiliza_empresa_idx
  on conf_cfop_contabiliza (codigo_empresa);
