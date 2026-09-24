-- O RESPONSÁVEL por cada empresa em cada setor, vindo do Acessórias.
--
-- `obr_empresa` (migration 030) já guarda a carteira, mas só a identidade: quem
-- é o cliente. Falta o que o Questor não tem em lugar nenhum — DE QUEM é a
-- empresa. Sem isso dá para dizer que uma empresa fechou o mês, nunca quem
-- deixou de fechar, e todo relatório por pessoa fica de fora do alcance.
--
-- O dado vem na MESMA chamada que já se faz para listar a carteira
-- (`/companies/ListAll` com a flag `departments`), então guardá-lo não custa uma
-- requisição a mais. Vem para TODOS os setores, não só o Contábil: o Fiscal e o
-- DP respondem a mesma pergunta com a mesma tabela.

create table obr_empresa_setor (
  cnpj       text    not null references obr_empresa (cnpj) on delete cascade,
  setor_id   integer not null,
  setor_nome text    not null,
  -- O nome como o Acessórias escreve, não um id de usuário do Nexo: as duas
  -- bases têm cadastros independentes. Pode ser uma pessoa ou um marcador de
  -- fluxo do próprio Acessórias ("Entrada Empresas", "Saída de Empresa") — os
  -- dois têm e-mail de setor e não há teste que os separe, então guarda-se como
  -- veio e quem lê decide. Vazio é comum e significativo: setor sem dono é
  -- justamente o que ninguém cobra.
  resp_nome  text,
  resp_email text,
  primary key (cnpj, setor_id)
);

create index obr_empresa_setor_setor_idx on obr_empresa_setor (setor_id);

-- Uma linha por varredura SÓ DA CARTEIRA (~2,5 min), separada do `obr_sync`, que
-- controla a varredura de entregas (~46 min). São trabalhos de tamanho e dono
-- diferentes: misturá-los faria a tela de Obrigações mostrar progresso de um
-- job que não é o dela, e o botão de uma bloquearia a outra sem motivo.
create table obr_carteira_sync (
  id           bigserial   primary key,
  iniciado_em  timestamptz not null default now(),
  terminado_em timestamptz,
  paginas      integer     not null default 0,
  empresas     integer     not null default 0,
  -- Quantas casaram com uma empresa do Questor. A diferença é o tamanho do
  -- buraco entre os dois cadastros; se despencar de uma vez, quem mudou foi o
  -- casamento, não a carteira.
  casadas      integer     not null default 0,
  erro         text,
  -- Batida do processo vivo: sem ela, uma varredura interrompida (deploy, queda)
  -- deixaria a trava presa para sempre.
  batida_em    timestamptz not null default now()
);

create index obr_carteira_sync_iniciado_idx on obr_carteira_sync (iniciado_em desc);
