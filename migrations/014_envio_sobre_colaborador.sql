-- Campanha "sobre um colaborador": além do broadcast para gestores/avulsos
-- (migration 013), a RH pode disparar um formulário SOBRE colaboradores
-- específicos. Cada colaborador vira UMA avaliação que vai para os gestores do
-- departamento dele (classiforgan), aceitando UMA resposta — mesmo padrão da
-- experiência (rh_experiencia): um token por avaliação, mandado a todos os
-- gestores do setor, o primeiro que responde fecha.
--
-- Reaproveita envio_destinatario: um destinatário passa a poder ser "sobre um
-- colaborador" em vez de um e-mail solto. Nesse caso o e-mail não é um só — os
-- destinatários reais (gestores do setor) são resolvidos no disparo a partir de
-- classiforgan —, então `email` deixa de ser obrigatório.

alter table envio_destinatario alter column email drop not null;

-- Colaborador que esta avaliação avalia (null = destinatário comum: gestor ou
-- avulso, do fluxo antigo). codigoempresa+codigofunccontr identificam o contrato
-- no Questor; classiforgan é o departamento usado para resolver os gestores no
-- disparo; funcionario_nome é um snapshot do nome (o Questor pode mudar).
alter table envio_destinatario
  add column codigoempresa   integer,
  add column codigofunccontr integer,
  add column classiforgan    text,
  add column funcionario_nome text;

-- Não repetir o mesmo colaborador dentro do mesmo envio.
create unique index envio_destinatario_colab_uk
  on envio_destinatario (envio_id, codigoempresa, codigofunccontr)
  where codigofunccontr is not null;
