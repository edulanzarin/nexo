-- Correção da contagem do contrato de experiência: o prazo começa NO dia da
-- admissão (a admissão é o dia 1), não no dia seguinte. O marco de 45 dias
-- vence, portanto, em `admissão + 44` — quem entra dia 01/09 fecha 45 dias em
-- 15/10, e não em 16/10 como estava gravado.
--
-- O painel e o cron recalculam o vencimento a partir de `dataadm` a cada leitura
-- (já corrigidos no código), mas as linhas materializadas guardam a data — e é
-- ela que o formulário público mostra como "Fim do período". Recua um dia.
update rh_experiencia
   set data_vencimento = data_admissao + (marco - 1)
 where data_vencimento <> data_admissao + (marco - 1);
