-- Módulo RH: construtor de FORMULÁRIOS (tipo Google Forms). A gestora do RH monta
-- avaliações/pesquisas próprias, sem depender de código: um formulário tem N
-- campos ordenados, de tipos variados. As RESPOSTAS não moram aqui — moram junto
-- do envio que gerou o token (experiência em rh_experiencia_resposta, campanhas
-- em envio_destinatario; ver migrations 012/013). Assim o mesmo formulário serve
-- vários envios.

create table formulario (
  id            serial primary key,
  nome          text not null,
  descricao     text,
  status        text not null default 'rascunho'
                  check (status in ('rascunho', 'ativo', 'arquivado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Campo (pergunta) de um formulário. `tipo` governa como renderiza e valida;
-- `config` (jsonb) guarda o específico do tipo, para o formulário evoluir sem
-- migration:
--   selecao_unica / selecao_multipla -> { "opcoes": ["A", "B", "C"] }
--   nota                             -> { "escala": ["Ruim", ..., "Ótimo"] }
--   pontuacao                        -> { "min": 0, "max": 10 }
--   texto_curto / texto_longo        -> {}
-- Um campo pode marcar { "papel": "decisao" } para ser destacado nos painéis
-- (substitui a antiga "recomendação" fixa da experiência).
create table formulario_campo (
  id            serial primary key,
  formulario_id integer not null references formulario (id) on delete cascade,
  ordem         integer not null default 0,
  tipo          text not null
                  check (tipo in ('texto_curto', 'texto_longo', 'selecao_unica',
                                  'selecao_multipla', 'nota', 'pontuacao')),
  rotulo        text    not null,           -- a pergunta
  ajuda         text,                       -- descrição/auxílio opcional
  obrigatorio   boolean not null default true,
  config        jsonb   not null default '{}'::jsonb
);
create index formulario_campo_form_idx on formulario_campo (formulario_id, ordem);

create trigger formulario_touch before update on formulario
  for each row execute function conf_touch();
