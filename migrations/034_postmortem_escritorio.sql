-- O Post Mortem deixa de ser do DP e passa a ser do ESCRITÓRIO.
--
-- Era uma seção do módulo Folha, com o analista vendo os seus e o gestor do DP
-- vendo todos. A partir de set/2026 o relatório é o plano de TODO o escritório:
-- cada setor preenche o seu (DP, Fiscal, Contábil, Societário) e os
-- coordenadores leem tudo numa visão só. Por isso o relatório vira MÓDULO
-- próprio (`postmortem`), com uma seção por setor mais a seção `geral`.
--
-- Três mudanças, nesta ordem: a tabela muda de nome (não é mais "folha"), ganha
-- o setor e os campos que o Societário pediu, e a PERMISSÃO acompanha a mudança
-- de casa — ninguém deve precisar reconfigurar cargo por causa de uma pasta.

-- Renomear a tabela não renomeia o que veio junto com ela (pkey, unique do
-- número, sequência do serial): o nome antigo continuaria aparecendo em cada
-- mensagem de erro do banco. Vai tudo junto.
alter table folha_postmortem rename to postmortem;
alter sequence folha_postmortem_numero_seq rename to postmortem_numero_seq;
alter sequence folha_postmortem_id_seq rename to postmortem_id_seq;
alter index folha_postmortem_pkey rename to postmortem_pkey;
alter index folha_postmortem_numero_key rename to postmortem_numero_key;
alter index folha_postmortem_autor_idx rename to postmortem_autor_idx;
alter index folha_postmortem_gestao_idx rename to postmortem_gestao_idx;
alter trigger folha_postmortem_touch on postmortem rename to postmortem_touch;

-- O setor DONO do relatório. Os que já existem são todos do DP (era a única
-- seção que existia), daí o default no backfill — que sai logo depois: relatório
-- novo declara o setor, e inserir sem dizer não pode virar "DP" em silêncio.
--
-- Sem check de valores de propósito: o catálogo em `postmortem-setores.ts` é a
-- fonte (o servidor recusa setor fora dele) e setor novo é uma entrada lá, não
-- uma migration.
alter table postmortem add column setor text not null default 'dp';
alter table postmortem alter column setor drop default;

-- Campos pedidos pelo Societário: a nota de gravidade (1 baixo … 5 gravíssimo)
-- é INDICADOR, então é coluna; o responsável por comunicar o erro é texto do
-- documento, mas cabe em coluna por ser um campo só e de uso direto na lista.
alter table postmortem add column gravidade smallint check (gravidade between 1 and 5);
alter table postmortem add column responsavel_info text;

-- Lista de um setor (a seção do setor) e a Geral ordenam por atualização.
create index postmortem_setor_idx on postmortem (setor, atualizado_em desc);

-- A permissão muda de casa junto: quem preenchia o do DP continua no DP; quem
-- via TODOS os do DP passa a ver o escritório inteiro (é o que a Geral é).
-- Só `cargo_secao`: desde a 010 a permissão vem exclusivamente do cargo, e
-- `usuario_secao` é tabela morta — converter linha lá daria a impressão de que
-- o override ainda vale.
update cargo_secao set modulo = 'postmortem', secao = 'dp'
 where modulo = 'folha' and secao = 'post-mortem';
update cargo_secao set modulo = 'postmortem', secao = 'geral'
 where modulo = 'folha' and secao = 'post-mortem-gestao';
