-- Plano de contabilização: overrides do que o Questor já configura.
--
-- O Questor guarda, por empresa+estabelecimento, qual tabela de contabilização
-- cada CFOP usa (cfop.codigotabctbfis*) e quais lançamentos essa tabela gera
-- (tabelactbfislctoctb: natureza, conta, regra de valor). Esse plano é lido
-- direto do Questor e vale como padrão. Quando existe override aqui, ele
-- SUBSTITUI o plano do Questor para aquele CFOP.

create table conf_regra (
  id             serial primary key,
  codigo_empresa integer not null,
  -- 0 = vale para todos os estabelecimentos da empresa
  codigo_estab   integer not null default 0,
  codigo_cfop    integer not null,
  -- false = esse CFOP não deve gerar lançamento (remessa, retorno, comodato…)
  contabiliza    boolean not null default true,
  observacao     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (codigo_empresa, codigo_estab, codigo_cfop)
);

create index conf_regra_empresa_idx on conf_regra (codigo_empresa, codigo_estab);

-- Uma linha por lançamento esperado. Espelha tabelactbfislctoctb do Questor.
create table conf_regra_linha (
  id           serial primary key,
  regra_id     integer not null references conf_regra (id) on delete cascade,
  seq          smallint not null,
  -- 1 = débito, -1 = crédito (mesma convenção de tabelactbfislctoctb.naturlctoctb)
  natureza     smallint not null check (natureza in (1, -1)),
  -- conta fixa esperada; null quando a conta é variável (fornecedor/cliente)
  conta        bigint,
  -- 0 = conta fixa, 1 e 2 = conta variável (vem da pessoa/produto no Questor)
  origem_conta smallint not null default 0,
  -- fórmula do Questor, ex.: 'vlrICMS', 'vlrContabil-vlrIPI-vlrICMS'
  regra_valor  text,
  -- rótulo legível: 'Mercadoria', 'ICMS', 'PIS retido'…
  rotulo       text,
  unique (regra_id, seq),
  -- conta fixa exige conta preenchida; conta variável exige conta nula
  check ((origem_conta = 0) = (conta is not null))
);

create index conf_regra_linha_regra_idx on conf_regra_linha (regra_id);

create or replace function conf_touch() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger conf_regra_touch before update on conf_regra
  for each row execute function conf_touch();
