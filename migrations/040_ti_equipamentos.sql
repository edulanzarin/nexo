-- Equipamentos da TI: o inventário da Navecon (notebook, monitor, mouse,
-- teclado, headset...) e o histórico de com quem cada um esteve.
--
-- Com quem o equipamento está NÃO é coluna do equipamento: é a última linha de
-- `ti_movimentacao`. Guardar o responsável nos dois lugares abriria a porta para
-- o cadastro dizer uma pessoa e o histórico outra, e o histórico é o que a TI
-- precisa defender ("pra quem foi o notebook 12 em março?"). Cada entrega,
-- devolução, ida para manutenção ou baixa é uma linha nova; nenhuma é
-- reescrita. O "de quem" de cada linha é o destino da linha anterior.
--
-- A pessoa é a do Diretório do RH, referenciada como lá, sem FK cruzando bancos:
-- (codigoempresa, codigofunccontr) do Questor, ou o contrato sintético do PJ.
-- O nome e o setor são gravados na hora da entrega: quem sai da empresa some
-- do Diretório, e o histórico precisa continuar dizendo com quem o equipamento
-- ficou.

create table ti_equipamento (
  id             serial primary key,
  -- id do catálogo em src/lib/ti-tipos.ts. Validado lá e não num check: tipo
  -- novo não deveria pedir migration.
  tipo           text not null,
  -- A etiqueta de patrimônio. Opcional: mouse e cabo costumam não ter.
  patrimonio     text,
  marca          text,
  modelo         text,
  numero_serie   text,
  -- Processador, memória, armazenamento, sistema... Os campos dependem do tipo
  -- (o catálogo diz quais), então jsonb: campo novo não pede migration.
  especificacoes jsonb not null default '{}'::jsonb,
  data_compra    date,
  valor_compra   numeric(12, 2),
  fornecedor     text,
  nota_fiscal    text,
  garantia_ate   date,
  observacoes    text,
  criado_por     text,  -- usuario.id (audit, sem FK cruzada)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Duas etiquetas iguais seriam dois equipamentos que ninguém sabe separar.
-- Sem diferenciar maiúscula: "nvc-012" e "NVC-012" são a mesma etiqueta.
create unique index ti_equipamento_patrimonio_uk
  on ti_equipamento (lower(patrimonio)) where patrimonio is not null;

create table ti_movimentacao (
  id              serial primary key,
  equipamento_id  integer not null references ti_equipamento (id) on delete cascade,
  destino         text not null
                    check (destino in ('pessoa', 'local', 'estoque', 'manutencao', 'baixa')),
  -- destino = pessoa: quem recebeu (retrato do Diretório na data da entrega)
  pessoa_empresa  integer,
  pessoa_contrato integer,
  pessoa_nome     text,
  pessoa_setor    text,
  -- destino = local: onde ficou (sala de reunião, recepção);
  -- destino = manutencao: a assistência, quando se sabe
  local           text,
  -- destino = baixa: por que saiu do inventário
  motivo          text
                    check (motivo is null or motivo in ('descarte', 'venda', 'doacao', 'perda', 'roubo')),
  -- Quando aconteceu, que pode ser antes de quando foi registrado.
  data            date not null,
  observacao      text,
  registrado_por      text,  -- usuario.id (audit, sem FK cruzada)
  registrado_por_nome text,
  registrado_em       timestamptz not null default now(),
  constraint ti_movimentacao_pessoa check (
    destino <> 'pessoa'
    or (pessoa_empresa is not null and pessoa_contrato is not null and pessoa_nome is not null)
  ),
  constraint ti_movimentacao_local check (destino <> 'local' or local is not null),
  constraint ti_movimentacao_baixa check (destino <> 'baixa' or motivo is not null)
);

-- A leitura de toda tela: a última movimentação de cada equipamento.
create index ti_movimentacao_equipamento_idx
  on ti_movimentacao (equipamento_id, data desc, id desc);
-- O que passou pela mão de uma pessoa.
create index ti_movimentacao_pessoa_idx
  on ti_movimentacao (pessoa_empresa, pessoa_contrato) where destino = 'pessoa';
