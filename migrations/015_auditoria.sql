-- Trilha de auditoria: quem viu/gerou/exportou dado sensível.
--
-- Sistema lê folha (PII), fiscal e contábil — vale registrar acesso a dado
-- individual e geração/exportação de relatório. NÃO é log de navegação: só
-- eventos que importam numa investigação (ver ficha de colaborador, gerar
-- laudo, exportar tabela). Grava no banco PRÓPRIO do app.
--
-- O nome do usuário é SNAPSHOT (a linha sobrevive à remoção do usuário, e a FK
-- vira null). `acao` é um verbo estável tipo 'folha.ficha.ver'; `modulo` sai da
-- ação e serve de filtro; `alvo` é a descrição legível (nome do colaborador,
-- empresa+período); `detalhe` guarda o resto em jsonb sem virar coluna.

create table auditoria (
  id            bigserial primary key,
  usuario_id    uuid references usuario (id) on delete set null,
  usuario_nome  text not null,
  acao          text not null,
  modulo        text,
  alvo          text,
  codigoempresa integer,
  detalhe       jsonb,
  criado_em     timestamptz not null default now()
);

create index auditoria_criado_idx on auditoria (criado_em desc);
create index auditoria_usuario_idx on auditoria (usuario_id);
create index auditoria_modulo_idx on auditoria (modulo);
