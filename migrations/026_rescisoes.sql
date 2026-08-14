-- Controle de RESCISÕES a pagar (DP). O Questor tem o FATO (funccontrato.datadem
-- + rescisao calculada) e o pagamento provável (a folha de rescisão, tipo 60,
-- em periodocalculo.datapgto/fechado); o que mora aqui é o que o Questor NÃO dá:
-- o prazo de pagamento configurável, quem recebe os avisos, o registro do que já
-- foi avisado (idempotência do cron) e o override manual de "resolvida/paga" —
-- porque o sinal de pagamento no Questor às vezes atrasa e o DP precisa fechar o
-- item na mão. Mesma doutrina do resto do app: fonte read-only no Questor, o
-- editável chaveado pela identidade dela no banco do app.

-- Prazo legal: CLT art. 477 §6 = pagamento das verbas em 10 dias corridos do fim
-- do contrato. Deixado configurável (não chumbado). Singleton: uma linha só.
create table rescisao_config (
  id            boolean primary key default true check (id),
  prazo_dias    integer not null default 10,   -- prazo de pagamento a partir de datadem
  dias_antes    integer not null default 3,    -- antecedência do 1º aviso (D-3)
  atualizado_em timestamptz not null default now()
);
insert into rescisao_config (id) values (true) on conflict (id) do nothing;

-- Quem é avisado das rescisões a pagar: o time do DP (não o gestor do setor do
-- funcionário — isto é trabalho do DP, não do gestor). Lista chapada, sem empresa.
create table rescisao_destinatario (
  id            serial primary key,
  nome          text not null,
  email         text not null unique,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- Override de "resolvida/paga": o DP marca a rescisão como quitada/homologada,
-- com a data real e uma observação. Chave = a rescisão no Questor (empresa +
-- contrato). Presente = item fechado, some da fila e para de avisar.
create table rescisao_resolvida (
  codigoempresa   integer not null,
  codigofunccontr integer not null,
  resolvida_em    date not null default current_date,   -- data do pagamento/homologação
  observacao      text,
  marcado_por     uuid references usuario (id),
  criado_em       timestamptz not null default now(),
  primary key (codigoempresa, codigofunccontr)
);

-- Log de aviso enviado (idempotência do cron, igual rh_experiencia_lembrete): um
-- registro por (rescisão, slot). slot = dias_antes (aviso único de antecedência)
-- ou dias negativos (atraso: um por dia, slot distinto por dia). O unique impede
-- reenviar o mesmo slot no mesmo dia.
create table rescisao_aviso (
  id              serial primary key,
  codigoempresa   integer not null,
  codigofunccontr integer not null,
  slot            integer not null,
  destinatarios   text,
  enviado_em      timestamptz not null default now(),
  unique (codigoempresa, codigofunccontr, slot)
);

create trigger rescisao_config_touch before update on rescisao_config
  for each row execute function conf_touch();
