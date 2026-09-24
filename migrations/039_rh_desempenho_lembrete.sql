-- Cobrar quem não respondeu a avaliação de desempenho.
--
-- A avaliação sai uma vez (migration 033) e depois disso a RH ficava sem ação:
-- existia "Reenviar", mas ele repete o e-mail do disparo — não diz que é
-- cobrança e não deixa rastro. Duas semanas depois ninguém sabia se aquela
-- avaliação parada tinha sido lembrada uma vez ou cinco, e não havia como
-- cobrar uma rodada inteira sem clicar linha por linha.
--
-- O lembrete é MANUAL: desempenho não tem prazo (é a RH que decide quando
-- avaliar, e por isso a 033 não criou job), então também é ela quem decide
-- quando insistir.
--
-- E só existe para avaliação com ZERO resposta. O link é um só para o setor
-- inteiro e quem responde se identifica digitando o nome — não dá para saber
-- QUAL gestor faltou. Tendo uma resposta que seja, cobrar de novo mandaria a
-- cobrança também para quem já respondeu.
--
-- Cada cobrança vira uma LINHA (e não uma coluna na avaliação) porque o que a
-- RH precisa enxergar é a insistência: quantas vezes, quando, e para quem.

create table rh_desempenho_lembrete (
  id            serial primary key,
  desempenho_id integer not null references rh_desempenho (id) on delete cascade,
  destinatarios text not null,  -- snapshot dos e-mails do disparo, separados por vírgula
  criado_por    text,           -- usuario.id (audit, sem FK cruzada)
  enviado_em    timestamptz not null default now()
);
-- Leitura da tela: o último lembrete de cada avaliação.
create index rh_desempenho_lembrete_idx
  on rh_desempenho_lembrete (desempenho_id, enviado_em desc);
