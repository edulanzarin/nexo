-- Relatório Post Mortem do DP (Departamento Pessoal): análise de incidente
-- preenchida por um analista LOGADO (diferente dos formulários do RH, que são
-- anônimos por link). O DONO é o autor: o analista vê os SEUS (seção
-- "post-mortem"); o gestor vê TODOS (seção "post-mortem-gestao"). A posse por
-- linha é garantida no servidor pelo autor_id.
--
-- Os campos que viram INDICADOR/filtro (nº, criticidade, grupo, datas) são
-- COLUNA; o texto livre e as tabelas repetíveis do formulário (linha do tempo,
-- 5 porquês, fatores, ações) ficam em jsonb — servem leitura e IA, não agregação.

-- Nº sequencial do relatório: alocado só no ENVIO (rascunho tem numero null).
-- Sequence dá numeração sem corrida entre envios simultâneos.
create sequence if not exists folha_postmortem_numero_seq;

create table folha_postmortem (
  id                    serial primary key,
  numero                integer unique,                 -- sequencial; null enquanto rascunho
  status                text not null default 'rascunho'
                          check (status in ('rascunho', 'enviado')),
  autor_id              uuid not null references usuario (id),   -- dono do relatório

  -- 1. Identificação
  criticidade           text check (criticidade in ('baixa', 'media', 'alta', 'critica')),
  grupo_id              integer references empresa_grupo (id),   -- grupo de empresa (admin)
  empresa_afetada       text,
  funcionarios_afetados integer,
  processo              text,
  data_ocorrido         date,
  data_identificado     date,
  quem_identificou      text,
  como_identificou      text,

  -- 2..7. Narrativa + repetíveis (jsonb)
  descricao             text,
  linha_tempo           jsonb not null default '[]'::jsonb,   -- [{data, evento, responsavel}]
  impactos              jsonb not null default '{}'::jsonb,   -- {financeiro, trabalhista, cliente, funcionarios, reputacional, outros}
  cinco_porques         jsonb not null default '[]'::jsonb,   -- ["por que 1", ... até 5]
  fatores               jsonb not null default '{}'::jsonb,   -- {processo, pessoas, sistema, comunicacao, prazo}
  causa_raiz            text,
  acoes_corretivas      jsonb not null default '[]'::jsonb,   -- [{acao, responsavel, prazo, status}]
  acoes_preventivas     jsonb not null default '[]'::jsonb,   -- [{acao, responsavel, prazo, validacao, status}]
  licoes                text,

  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

-- Lista do analista (os seus, mais recentes primeiro).
create index folha_postmortem_autor_idx on folha_postmortem (autor_id, atualizado_em desc);
-- Lista/filtros do gestor (por situação, criticidade, grupo).
create index folha_postmortem_gestao_idx on folha_postmortem (status, criticidade, grupo_id);

-- Toca atualizado_em a cada update — mesma função dos outros módulos.
create trigger folha_postmortem_touch before update on folha_postmortem
  for each row execute function conf_touch();
