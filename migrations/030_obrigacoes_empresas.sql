-- A carteira do Acessórias, para o seletor de empresa do módulo Obrigações.
--
-- Sem isto o único jeito de escolher uma empresa era digitar o CNPJ na mão, o
-- que é pedir ao usuário a chave primária de outro sistema. A lista de empresas
-- já é buscada pela varredura (é o primeiro passo dela), então guardá-la não
-- custa chamada nenhuma a mais — só não estava sendo aproveitada.
--
-- Não dá para reusar o cadastro do Questor aqui: o Acessórias cadastra FILIAL
-- como empresa própria e tem clientes que não existem no Questor (~10% medido),
-- então quem manda no seletor é a carteira de lá, com o par local ao lado.

create table obr_empresa (
  -- CNPJ/CPF como o Acessórias formata — é a chave dele e a que `deliveries` pede.
  cnpj          text primary key,
  razao         text not null,
  fantasia      text,
  -- "Ativa"/"Inativa" como vem; a varredura só percorre as ativas, mas guardar
  -- as duas evita que uma empresa desaparecida do seletor pareça erro de sync.
  status        text not null,
  -- Par no Questor, quando existe. Null = cliente só do Acessórias, e vale a
  -- mesma regra da fila: sem par não há escopo, só quem vê todas alcança.
  codigoempresa integer,
  atualizado_em timestamptz not null default now()
);

create index obr_empresa_codigoempresa_idx on obr_empresa (codigoempresa);
create index obr_empresa_razao_idx on obr_empresa (razao);
