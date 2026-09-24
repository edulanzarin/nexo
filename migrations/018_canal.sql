-- Canal do RH: DENÚNCIA anônima (ouvidoria) + CLIMA (avaliação anônima da empresa).
-- Duas coisas ligadas, uma migration. Ambas atendidas por LINK PÚBLICO aberto, sem
-- login — o funcionário chega pelo /denuncia ou /clima/<slug> e responde sem se
-- identificar.
--
-- ANONIMATO POR DESENHO: nenhuma tabela aqui guarda IP, user-agent, cookie ou
-- vínculo com `usuario`/`sessao`. A única credencial do denunciante é o par
-- protocolo+senha que ELE recebe ao enviar (hash scrypt, ver src/lib/auth.ts);
-- perdido, é irrecuperável — e é assim que tem que ser. Alinha com a Lei
-- 14.457/2022 (canal de denúncia de assédio).

-- ── Denúncia (ouvidoria) ─────────────────────────────────────────────────────

create table denuncia (
  id              serial primary key,
  protocolo       text not null unique,            -- ex. DEN-2026-XXXXXX (mostrado uma vez)
  senha_hash      text not null,                    -- scrypt PHC (hashSenha) — acompanhamento
  categoria       text not null
                    check (categoria in ('assedio_moral', 'assedio_sexual', 'discriminacao',
                                         'fraude', 'seguranca', 'conduta', 'outro')),
  relato          text not null,
  setor_envolvido text,                             -- autodeclarado, opcional
  status          text not null default 'recebida'
                    check (status in ('recebida', 'em_analise', 'concluida', 'arquivada')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index denuncia_status_idx on denuncia (status, criado_em desc);

-- Thread de acompanhamento entre o denunciante ANÔNIMO e o RH. O relato inicial
-- mora em denuncia.relato; aqui ficam as trocas seguintes. `autor_nome` guarda o
-- nome do usuário do RH que respondeu (trilha interna) — do lado do denunciante
-- fica null, para não abrir brecha de identificação.
create table denuncia_mensagem (
  id          serial primary key,
  denuncia_id integer not null references denuncia (id) on delete cascade,
  autor       text not null check (autor in ('denunciante', 'rh')),
  autor_nome  text,
  corpo       text not null,
  criado_em   timestamptz not null default now()
);
create index denuncia_mensagem_idx on denuncia_mensagem (denuncia_id, criado_em);

-- Toca atualizado_em a cada update (status muda, etc.) — mesma função dos outros módulos.
create trigger denuncia_touch before update on denuncia
  for each row execute function conf_touch();

-- ── Clima (avaliação anônima da empresa) ─────────────────────────────────────

-- Uma RODADA de avaliação: um link público (slug) que muita gente responde uma
-- vez cada, anonimamente. Os TEMAS avaliados (liderança, ambiente...) ficam em
-- `temas` (jsonb) para o RH ajustar por rodada sem migration: [{id, rotulo}].
create table clima_rodada (
  id         serial primary key,
  titulo     text not null,
  descricao  text,
  slug       text not null unique,                 -- link público /clima/<slug>
  status     text not null default 'aberta' check (status in ('aberta', 'fechada')),
  temas      jsonb not null default '[]'::jsonb,   -- [{ "id": "lideranca", "rotulo": "Liderança" }]
  aberto_em  timestamptz not null default now(),
  fechado_em timestamptz,
  criado_em  timestamptz not null default now()
);

-- Uma resposta ANÔNIMA. eNPS em nota_recomendacao (0..10); as notas por tema em
-- `notas` (jsonb { tema_id: 1..5 }); comentário livre; setor autodeclarado
-- opcional (recorte só aparece no painel com N mínimo, para não deanonimizar
-- time pequeno). Sem NENHUM campo de identidade.
create table clima_resposta (
  id                serial primary key,
  rodada_id         integer not null references clima_rodada (id) on delete cascade,
  nota_recomendacao smallint not null check (nota_recomendacao between 0 and 10),
  notas             jsonb not null default '{}'::jsonb,
  comentario        text,
  setor             text,
  criado_em         timestamptz not null default now()
);
create index clima_resposta_rodada_idx on clima_resposta (rodada_id);

-- Rodada inicial aberta, para o canal já nascer utilizável (o RH renomeia/fecha depois).
insert into clima_rodada (titulo, descricao, slug, temas) values (
  'Avaliação da empresa 2026',
  'Sua opinião é anônima. Nenhuma resposta é vinculada a você.',
  'clima-2026',
  '[{"id":"lideranca","rotulo":"Liderança"},
    {"id":"ambiente","rotulo":"Ambiente de trabalho"},
    {"id":"remuneracao","rotulo":"Remuneração e benefícios"},
    {"id":"carga","rotulo":"Carga de trabalho"},
    {"id":"reconhecimento","rotulo":"Reconhecimento"},
    {"id":"comunicacao","rotulo":"Comunicação"}]'::jsonb
);
