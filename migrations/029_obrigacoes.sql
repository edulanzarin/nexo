-- Módulo Obrigações: a fila de entregas do Acessórias, sincronizada.
--
-- Fonte nova (não é o Questor): a API do Acessórias, o sistema onde o escritório
-- controla as obrigações entregues ao cliente. Vem por REST, com teto de 100
-- req/min e SEM webhook — nada avisa quando uma entrega muda. E `deliveries`
-- exige o CNPJ no caminho: não existe varredura global, é uma chamada por
-- empresa. Varrer a carteira (mais de mil ativas) leva ~30 min, o que não cabe
-- num request — por isso a fila é MATERIALIZADA aqui por um job, e a tela lê daqui.
--
-- O que se guarda é só o ACIONÁVEL (`situation=pending` na API: "Atrasada!" e
-- "Pendente"), não o histórico inteiro. Entrega dispensada, entregue ou em prazo
-- técnico não é fila — some do recorte e por isso some da tabela.
--
-- Filtrar por setor na API não reduz o custo (o gargalo é 1 request por empresa,
-- não o tamanho da resposta), então a varredura traz TODOS os departamentos e o
-- setor vira filtro de leitura. Fiscal, DP e Societário entram sem custo a mais.

-- A entrega pendente. `ent_id` é o id da entrega no Acessórias (Config.EntID),
-- estável entre varreduras — é a chave natural, então re-sincronizar atualiza a
-- linha em vez de duplicar.
create table obr_entrega (
  ent_id        bigint primary key,
  -- Identidade no Acessórias. O CNPJ é o que a API dá; `codigoempresa` é o par
  -- no Questor, resolvido na sincronização por `estab.inscrfederal` (qualquer
  -- estabelecimento, não só a matriz: o Acessórias cadastra FILIAL como empresa
  -- própria). Fica null quando a empresa não existe no Questor — cliente só do
  -- Acessórias. Null NÃO é "vale para todos": sem par não há como recortar por
  -- escopo, então só quem vê todas as empresas enxerga essas linhas.
  cnpj          text    not null,
  codigoempresa integer,
  empresa       text    not null,
  -- O trabalho em si.
  obrigacao     text    not null,
  competencia   date,
  prazo         date,
  -- Status como o Acessórias escreve ("Atrasada!", "Pendente"). Vocabulário do
  -- sistema de origem, não traduzido: a doc promete pending/read/delivered mas a
  -- API devolve nove rótulos diferentes, e inventar um de-para aqui só criaria
  -- uma mentira a manter.
  status        text    not null,
  multa         boolean not null default false,
  -- Setor dono da entrega, com a hierarquia do Acessórias achatada no nome.
  dpto_id       integer not null,
  dpto_nome     text    not null,
  -- Quem responde pelo prazo. Pode ser um usuário de verdade ou um marcador do
  -- próprio Acessórias ("Saída de Empresa", "Entrada Empresas") — guardamos como
  -- veio; distinguir é problema de quem lê.
  resp_id       integer,
  resp_nome     text,
  -- Carimbo da varredura que viu esta linha por último. É o que permite apagar o
  -- que saiu da fila: quem não foi visto na varredura mais recente, saiu.
  visto_em      timestamptz not null default now()
);

create index obr_entrega_dpto_idx on obr_entrega (dpto_id);
create index obr_entrega_empresa_idx on obr_entrega (codigoempresa);
create index obr_entrega_prazo_idx on obr_entrega (prazo);
create index obr_entrega_resp_idx on obr_entrega (resp_id);

-- Uma linha por varredura: quando rodou, o que rendeu e o que falhou. Serve de
-- "atualizado em" honesto na tela (a fila é um retrato, e o usuário precisa
-- saber de quando) e de diagnóstico quando o número parece errado.
create table obr_sync (
  id            bigserial primary key,
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  empresas      integer not null default 0,
  entregas      integer not null default 0,
  -- Empresas cuja consulta falhou: a fila fica incompleta e a tela avisa, em vez
  -- de mostrar um número menor como se fosse a verdade.
  falhas        integer not null default 0,
  erro          text
);

create index obr_sync_iniciado_idx on obr_sync (iniciado_em desc);
