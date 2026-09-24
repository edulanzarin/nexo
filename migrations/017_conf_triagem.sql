-- Central de Pendências: estado de TRIAGEM de cada achado (resolver/ignorar).
--
-- Os achados em si (nota não contabilizada, conta errada, duplicada; lançamento
-- sintético, órfão, sem histórico…) são RECALCULADOS ao vivo do Questor a cada
-- carga — read-only, nada disso é gravado aqui. O que persiste é só a decisão
-- humana sobre cada um: "já resolvi" ou "pode ignorar", com quem e quando.
--
-- Identidade estável do achado = (fonte, codigo_empresa, chave, tipo):
--   - fonte  'conferencia' | 'auditoria'
--   - chave  ME<chave>/MS<chave> (nota, por lado) ou chavelctoctb (lançamento)
--   - tipo   a situação (pendente/divergente/duplicada) ou o TipoAchado
-- Como o `tipo` entra na chave, um achado que muda de natureza (era pendente,
-- virou divergente) reaparece sozinho — é outra pendência.
--
-- usuario_nome é SNAPSHOT (a linha sobrevive à remoção do usuário; a FK vira
-- null), igual à trilha de auditoria (migration 015).

create table conf_triagem (
  id             bigserial primary key,
  fonte          text not null,
  codigo_empresa integer not null,
  chave          text not null,
  tipo           text not null,
  status         text not null,          -- 'resolvido' | 'ignorado'
  observacao     text,
  usuario_id     uuid references usuario (id) on delete set null,
  usuario_nome   text not null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (fonte, codigo_empresa, chave, tipo)
);

create index conf_triagem_empresa_idx on conf_triagem (codigo_empresa);
