-- Clima passa a usar FORMULÁRIO do construtor em vez de tema fixo.
--
-- Antes, cada rodada carregava temas fixos (liderança, ambiente...) e a resposta
-- era eNPS (0..10) + nota por tema. Agora a rodada aponta para um `formulario`
-- montado no builder e a resposta guarda os `valores` dos campos daquele
-- formulário — o RH desenha as perguntas onde já desenha os outros formulários.
--
-- ANONIMATO INTACTO: `clima_resposta` continua sem NENHUM campo de identidade
-- (nem token, nem pessoa). `valores` é só o conteúdo das respostas, solto.
--
-- Colunas antigas (nota_recomendacao, notas) viram nullable e ficam para não
-- perder histórico; o fluxo novo não as escreve.

alter table clima_rodada
  add column formulario_id integer references formulario (id);

alter table clima_resposta
  add column valores jsonb not null default '{}'::jsonb;

alter table clima_resposta
  alter column nota_recomendacao drop not null;
