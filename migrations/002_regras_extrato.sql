-- Regras de contrapartida para importar extrato bancário.
--
-- A ideia: o extrato traz uma descrição por transação ("PAGTO MAGALHAES
-- COMERCIO LTDA"). A regra diz em que conta contábil aquilo cai, separando
-- pagamento de recebimento. A conta do banco em si (ex.: "Banco Viacredi" =
-- conta 16 na empresa 1200) vem do plano de contas do Questor, que é
-- read-only — por isso aqui só guardamos o número, sem FK.
--
-- Lançamento gerado:
--   recebimento → DÉBITO na conta do banco, CRÉDITO na contrapartida
--   pagamento   → CRÉDITO na conta do banco, DÉBITO na contrapartida

create table conf_conta_banco (
  id             serial primary key,
  codigo_empresa integer not null,
  -- conta do banco no plano da empresa (planoespec.contactb)
  conta          bigint  not null,
  -- nome curto do usuário; se vazio, a tela mostra a descrição do plano
  apelido        text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (codigo_empresa, conta)
);

create table conf_regra_extrato (
  id              serial primary key,
  conta_banco_id  integer not null references conf_conta_banco (id) on delete cascade,
  -- termo procurado na descrição da transação, já normalizado (sem acento,
  -- maiúsculas, espaços colapsados) para o casamento não depender de digitação
  termo           text    not null,
  -- como foi digitado, para exibir de volta ao usuário
  termo_original  text    not null,
  -- 'exato' = descrição inteira igual; 'parcial' = contém o termo
  tipo            text    not null check (tipo in ('exato', 'parcial')),
  -- contrapartida por sentido; nula = essa regra não trata esse sentido
  conta_pagamento   bigint,
  conta_recebimento bigint,
  -- texto livre que vai no histórico do lançamento; vazio usa a descrição
  historico       text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  -- o mesmo termo pode existir como exato E como parcial, mas não duplicado
  unique (conta_banco_id, termo, tipo),
  -- regra que não aponta conta nenhuma não faz nada
  check (conta_pagamento is not null or conta_recebimento is not null)
);

create index conf_regra_extrato_conta_idx on conf_regra_extrato (conta_banco_id);

create trigger conf_conta_banco_touch before update on conf_conta_banco
  for each row execute function conf_touch();

create trigger conf_regra_extrato_touch before update on conf_regra_extrato
  for each row execute function conf_touch();
