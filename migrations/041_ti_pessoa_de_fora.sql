-- Quem recebe equipamento e não está no Diretório do RH: o terceirizado da
-- empresa de limpeza ou de segurança, o estagiário que ainda não entrou na
-- folha, o consultor que passa uma temporada no escritório.
--
-- Cadastro próprio da TI, e não texto livre na entrega: a mesma pessoa recebe
-- mais de uma coisa, e "João (Limpa Tudo)" digitado de três jeitos viraria três
-- pessoas no Por Pessoa. Também não entra no Diretório como PJ: o PJ do RH é
-- prestador da Navecon, com experiência e avaliação; o terceirizado é de outra
-- empresa, e o RH não tem o que fazer com ele.
--
-- `ativo` é o fim do vínculo: o cadastro encerrado não recebe mais nada, e o
-- que ficou com ele aparece como equipamento a recolher.

create table ti_pessoa_externa (
  id            serial primary key,
  nome          text not null,
  -- A empresa terceirizada, ou o vínculo quando não há empresa ("Estagiário").
  vinculo       text,
  documento     text,
  contato       text,
  observacao    text,
  ativo         boolean not null default true,
  criado_por    text,  -- usuario.id (audit, sem FK cruzada)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A entrega a alguém de fora: o id do cadastro, e o nome (em `pessoa_nome`) e o
-- vínculo gravados na hora, como na entrega a quem é do Diretório. Sem cascata:
-- cadastro que já recebeu alguma coisa não se apaga, se encerra.
alter table ti_movimentacao
  add column externo_id      integer references ti_pessoa_externa (id),
  add column externo_vinculo text;

alter table ti_movimentacao drop constraint ti_movimentacao_destino_check;
alter table ti_movimentacao add constraint ti_movimentacao_destino_check
  check (destino in ('pessoa', 'externo', 'local', 'estoque', 'manutencao', 'baixa'));
alter table ti_movimentacao add constraint ti_movimentacao_externo
  check (destino <> 'externo' or (externo_id is not null and pessoa_nome is not null));

create index ti_movimentacao_externo_idx
  on ti_movimentacao (externo_id) where destino = 'externo';
