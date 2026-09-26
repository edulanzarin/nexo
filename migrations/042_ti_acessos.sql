-- Acessos da TI: o cofre das credenciais da infraestrutura da Navecon. A senha
-- do Wi-Fi, o admin do roteador, o banco de dados, a área de trabalho remota do
-- servidor, o portal do fornecedor. NÃO guarda a senha pessoal de ninguém: a
-- conta de cada funcionário é dele, e o log de um sistema só prova quem fez o
-- quê enquanto só a pessoa sabe a senha dela.
--
-- Os segredos (senha, chave compartilhada da VPN, chave de licença) ficam
-- cifrados em AES-256-GCM com a chave TI_COFRE_CHAVE do .env, fora do banco. Um
-- dump deste banco, sozinho, não abre nenhuma senha. Cada segredo guarda a
-- cifra e o dia em que foi trocado:
--   {"senha": {"c": "v1.<id da chave>.<iv>.<tag>.<cifra>", "em": "2026-09-26T10:00:00Z"}}
-- A cifra só sai daqui pela rota de revelar, que registra quem viu.

create table ti_acesso (
  id             serial primary key,
  -- id do catálogo em src/lib/ti-acessos-tipos.ts (wifi, banco, remoto...).
  -- Validado lá e não num check: tipo novo não deveria pedir migration.
  tipo           text not null,
  nome           text not null,
  -- Pasta livre para agrupar ("Matriz", "Servidor", "Fornecedores"). Nasce
  -- digitando no próprio cadastro, sem tela à parte.
  grupo          text,
  -- Os campos que não são segredo (endereço, porta, usuário, nome da rede).
  -- Dependem do tipo, então jsonb: campo novo não pede migration.
  campos         jsonb not null default '{}'::jsonb,
  segredos       jsonb not null default '{}'::jsonb,
  -- O roteador ou a impressora a que o acesso pertence, quando há.
  equipamento_id integer references ti_equipamento (id) on delete set null,
  observacoes    text,
  criado_por     text,  -- usuario.id (audit, sem FK cruzada)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index ti_acesso_equipamento_idx on ti_acesso (equipamento_id) where equipamento_id is not null;

-- O que aconteceu com cada acesso: quem criou, editou, trocou a senha, viu ou
-- copiou. Só cresce. O nome e o tipo ficam gravados na linha: o acesso apagado
-- some da lista, e o registro precisa continuar dizendo quem viu a senha dele.
create table ti_acesso_evento (
  id           bigserial primary key,
  acesso_id    integer references ti_acesso (id) on delete set null,
  acesso_nome  text not null,
  acesso_tipo  text not null,
  acao         text not null
               check (acao in ('criado', 'editado', 'segredo', 'removido', 'revelado', 'copiado', 'apagado')),
  -- O segredo visto, copiado, trocado ou removido ("senha"), ou os campos editados.
  campos       text[],
  usuario_id   text,
  usuario_nome text,
  em           timestamptz not null default now()
);

create index ti_acesso_evento_acesso_idx on ti_acesso_evento (acesso_id, em desc);
create index ti_acesso_evento_em_idx on ti_acesso_evento (em desc);
