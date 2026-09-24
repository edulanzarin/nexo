-- Implantação de saldos: quando uma empresa entra no escritório, o balancete de
-- abertura da contabilidade anterior é lançado no Questor. O Nexo NÃO escreve no
-- Questor (produção, read-only) — ele prepara o arquivo de importação
-- (layout "C;empresa;estab;..." de lançamentos contábeis) que o Questor engole.
--
-- Aqui, no banco PRÓPRIO do app, moram só duas coisas: os padrões da implantação
-- (conta transitória de contrapartida + histórico) e o de-para aprendido entre a
-- conta da contabilidade de origem e a conta reduzida do plano da empresa.

-- Padrões da implantação. A linha codigo_empresa = 0 é o PADRÃO GLOBAL; uma linha
-- por empresa sobrepõe o global. Assim "alguém quer mudar" é editar um registro,
-- não mexer em código.
create table implantacao_config (
  codigo_empresa    integer primary key,   -- 0 = padrão global
  -- Conta reduzida (planoespec.contactb) usada como contrapartida transitória
  -- ("Saldos a Implantar"). Cada saldo do balancete é lançado contra ela; como o
  -- balancete fecha, ela zera no fim.
  conta_implantacao bigint,
  -- Histórico padrão (historicoctb.codigohistctb) do lançamento de implantação.
  codigo_historico  integer,
  -- Complemento de histórico (texto livre) padrão.
  complemento       text,
  atualizado_em     timestamptz not null default now()
);

-- De-para conta da origem -> conta do Questor, por empresa. A implantação de uma
-- empresa é feita uma vez, mas o de-para é salvo para permitir salvar o progresso
-- da conferência e regerar o arquivo sem refazer o casamento à mão.
--
-- origem_chave: identificador da conta no balancete de origem (código reduzido ou
-- classificação — o que o parser daquele software expõe como chave estável).
-- confirmado: true quando um humano validou o casamento (vs. sugestão automática).
create table implantacao_depara (
  id             serial primary key,
  codigo_empresa integer not null,
  origem_chave   text not null,
  origem_descr   text,
  -- Conta reduzida de destino (planoespec.contactb). Null = ainda sem conta.
  conta_questor  bigint,
  confirmado     boolean not null default false,
  atualizado_em  timestamptz not null default now(),
  unique (codigo_empresa, origem_chave)
);

create index implantacao_depara_empresa_idx on implantacao_depara (codigo_empresa);

create or replace function implantacao_touch() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger implantacao_config_touch before update on implantacao_config
  for each row execute function implantacao_touch();

create trigger implantacao_depara_touch before update on implantacao_depara
  for each row execute function implantacao_touch();

-- Semente do padrão global vazio: a tela edita esta linha.
insert into implantacao_config (codigo_empresa) values (0)
  on conflict (codigo_empresa) do nothing;
