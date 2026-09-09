-- O GRUPO DE EMPRESA como o Acessórias o mantém.
--
-- Pedido do Renato (set/2026), olhando a aba Fechamento: filtrar por grupo de
-- empresa "igual está estabelecido dentro do acessoria". O Nexo já tem um
-- cadastro de grupo em Configurações (`grupo_empresarial`), mantido à mão; este
-- é outro, e os dois passam a conviver com nome explícito na tela — quem cuida
-- do de lá é o escritório, no sistema onde ele já cuida do cliente.
--
-- Por que materializar, e por que numa varredura própria: medido em set/2026, a
-- empresa NÃO carrega o grupo dela (`/companies/ListAll` não traz o campo, e a
-- flag `groups` é aceita e ignorada). O vínculo só sai perguntando grupo a
-- grupo — 425 ativos a ~1,8 s cada, ~13 min. É outra ordem de grandeza que a
-- varredura de carteira (~2,5 min), e por isso tem estado próprio: misturar as
-- duas faria o botão da carteira demorar seis vezes mais sem explicação.

-- O id é o do Acessórias, não um serial nosso: é ele que volta na próxima
-- varredura, e inventar um id local obrigaria a manter um de-para para nada.
create table obr_grupo (
  id            integer     primary key,
  nome          text        not null,
  -- 'Ativo' | 'Inativo', como vem. Grupo inativo continua guardado: empresa
  -- ligada a ele existe, e sumir com o rótulo tornaria a linha inexplicável.
  status        text        not null,
  atualizado_em timestamptz not null default now()
);

-- Muitos-para-muitos de propósito, ainda que a amostra não tenha achado empresa
-- em dois grupos (12 grupos, 70 empresas, 70 CNPJs distintos). O modelo da API é
-- grupo -> empresas, ou seja, nada do lado deles impede a segunda ligação; supor
-- "uma só" aqui seria uma regra nossa disfarçada de fato deles.
create table obr_empresa_grupo (
  cnpj     text    not null references obr_empresa (cnpj) on delete cascade,
  grupo_id integer not null references obr_grupo (id) on delete cascade,
  primary key (cnpj, grupo_id)
);

create index obr_empresa_grupo_grupo_idx on obr_empresa_grupo (grupo_id);

-- Estado da varredura de grupos, no mesmo desenho do `obr_carteira_sync`
-- (migration 035): trava por linha aberta, batida para soltar trava de processo
-- morto, e o erro guardado onde a tela possa mostrá-lo.
create table obr_grupo_sync (
  id           bigserial   primary key,
  iniciado_em  timestamptz not null default now(),
  terminado_em timestamptz,
  -- Quantos grupos já foram perguntados — é o progresso que a tela mostra, e o
  -- único sinal de vida numa varredura de treze minutos.
  grupos       integer     not null default 0,
  vinculos     integer     not null default 0,
  -- Empresas que o grupo lista e que não estão na carteira (`obr_empresa`). Não
  -- é erro: é a distância entre as duas varreduras. Guardada porque, se pular de
  -- dezenas para centenas, quem envelheceu foi a carteira, não o grupo.
  fora_da_carteira integer not null default 0,
  erro         text,
  batida_em    timestamptz not null default now()
);

create index obr_grupo_sync_iniciado_idx on obr_grupo_sync (iniciado_em desc);
