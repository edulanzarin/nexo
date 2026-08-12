-- Diretório do RH editável: camada gravável (app-db) por cima do Questor, que é
-- produção e SOMENTE LEITURA. O Questor continua a base; aqui moram:
--   - correções de funcionário (o cadastro no Questor vem bagunçado e não dá pra
--     escrever lá) — overlay campo a campo;
--   - pessoas PJ, que não existem no Questor e a RH inclui à mão;
--   - setores editáveis (renomear os do Questor e criar setores próprios).
--
-- Igual rh_setor_gestor (008), a identidade do Questor é referenciada sem FK
-- cruzando bancos: (codigoempresa, codigofunccontr) e classiforgan são só valores.

-- Setores editáveis. A CHAVE é o classiforgan: para um setor do Questor é o
-- classiforgan real (a linha só existe quando renomeado); para um setor próprio
-- é um código gerado no app (ex.: 'PJ01'). Assim tudo que já chaveia por
-- classiforgan (gestores, envios "sobre colaborador") segue funcionando igual.
create table rh_setor (
  classiforgan  text    primary key,
  nome          text    not null,
  origem        text    not null default 'questor'
                  check (origem in ('questor', 'app')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Correções sobre um funcionário do Questor. `campos` guarda SÓ o que foi
-- sobrescrito (nome, cargo, classiforgan, salario, ...) — jsonb pelo mesmo motivo
-- de rh_experiencia_resposta.respostas: o formato evolui sem migration. A tela
-- faz coalesce(override, valor do Questor). `oculto` some do Diretório sem apagar.
create table rh_funcionario_override (
  codigoempresa   integer not null,
  codigofunccontr integer not null,
  campos          jsonb   not null default '{}'::jsonb,
  oculto          boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (codigoempresa, codigofunccontr)
);

-- Pessoa PJ: prestador que não existe no Questor. Vive 100% aqui. Recebe um
-- "contrato" sintético (PJ_CONTRATO_OFFSET + id, ver src/lib/rh.ts) só quando
-- precisa se passar por colaborador nos envios — o id é a identidade real.
create table rh_pessoa_pj (
  id            serial primary key,
  codigoempresa integer not null,               -- uma das empresas do RH (1/888/746)
  nome          text    not null,
  cpf_cnpj      text,
  cargo         text,
  classiforgan  text,                            -- setor (rh_setor.classiforgan)
  email         citext,
  data_inicio   date,
  ativo         boolean not null default true,
  extra         jsonb   not null default '{}'::jsonb,  -- demais campos da ficha
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index rh_pessoa_pj_empresa_idx on rh_pessoa_pj (codigoempresa) where ativo;

create trigger rh_setor_touch before update on rh_setor
  for each row execute function conf_touch();

create trigger rh_funcionario_override_touch before update on rh_funcionario_override
  for each row execute function conf_touch();

create trigger rh_pessoa_pj_touch before update on rh_pessoa_pj
  for each row execute function conf_touch();
