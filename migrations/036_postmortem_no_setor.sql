-- O Post Mortem volta para DENTRO do setor.
--
-- A 034 tirou o relatório do módulo Folha e fez dele um módulo do escritório
-- (`postmortem`), com uma seção por setor mais uma Visão geral que cruzava
-- todos. Deu errado no ponto que importa: quem coordena passou a ser uma
-- pessoa só para o escritório inteiro, e o gestor de cada área ficou sem a
-- leitura da sua. Agora cada módulo de setor (Fiscal, Contábil, DP e o
-- Societário, que nasceu para isto) tem o par de sempre — `post-mortem` para o
-- analista, `post-mortem-gestao` para o gestor daquela área.
--
-- Só permissão muda aqui: a tabela `postmortem` continua igual (a coluna
-- `setor` já é o dono do relatório, e é ela que recorta as duas leituras).
--
-- Só `cargo_secao`: desde a 010 a permissão vem exclusivamente do cargo, e
-- `usuario_secao` é tabela morta.

-- Quem preenchia o setor continua preenchendo, agora no módulo do setor.
update cargo_secao set modulo = 'folha',      secao = 'post-mortem' where modulo = 'postmortem' and secao = 'dp';
update cargo_secao set modulo = 'fiscal',     secao = 'post-mortem' where modulo = 'postmortem' and secao = 'fiscal';
update cargo_secao set modulo = 'contabil',   secao = 'post-mortem' where modulo = 'postmortem' and secao = 'contabil';
update cargo_secao set modulo = 'societario', secao = 'post-mortem' where modulo = 'postmortem' and secao = 'societario';

-- A Visão geral lia os quatro setores, então vira a gestão dos quatro — migração
-- não tira acesso de ninguém. É de propósito mais largo do que o desenho novo
-- pede: quem tinha a Geral era a coordenação do escritório, e separar ali quem
-- deve ficar com qual área é decisão de gente, não de SQL. A tela de cargos
-- resolve em dois cliques.
insert into cargo_secao (cargo_id, modulo, secao)
select cs.cargo_id, m.modulo, 'post-mortem-gestao'
  from cargo_secao cs
 cross join (values ('folha'), ('fiscal'), ('contabil'), ('societario')) as m (modulo)
 where cs.modulo = 'postmortem' and cs.secao = 'geral'
    on conflict do nothing;

-- O módulo `postmortem` não existe mais; o que sobrar dele é linha órfã que
-- nenhuma tela lê (e que reapareceria numa auditoria de permissão como fantasma).
delete from cargo_secao where modulo = 'postmortem';
