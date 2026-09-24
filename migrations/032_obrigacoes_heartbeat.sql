-- Batimento da varredura: distinguir "trabalhando" de "morta sem avisar".
--
-- A varredura roda dentro do processo do app, então um deploy (`docker compose
-- up -d --build`) a mata no meio sem chance de fechar a linha. O que ficava era
-- uma execução ABERTA para sempre — e como "está rodando?" era respondido por
-- "existe linha aberta há menos de 8h", o sistema passava 8 horas afirmando que
-- uma varredura morta estava em andamento: barra parada, botão Iniciar
-- indisponível e, se alguém tivesse pedido parada antes, um "Parando…" eterno.
--
-- Presença não se deduz de ausência de conclusão; se prova por sinal recente.
-- A varredura carimba `atualizado_em` a cada empresa E a cada página da
-- listagem, e quem lê considera viva só a execução que bateu há pouco. Deploy
-- deixa de travar o sistema: a próxima execução vê a linha parada, fecha-a e
-- retoma do ponto salvo.

alter table obr_sync add column atualizado_em timestamptz not null default now();

-- Quem pergunta "está rodando?" filtra por linha aberta E batimento recente.
create index obr_sync_batimento_idx on obr_sync (atualizado_em desc) where concluido_em is null;
