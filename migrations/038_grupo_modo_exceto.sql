-- Grupo de empresa que se define pelo que FICA DE FORA.
--
-- Os dois cadastros de grupo (`empresa_grupo`, de permissão, e
-- `grupo_empresarial`, de negócio) guardavam só a lista de quem está dentro. Um
-- grupo como "Todas - Navecon, Four, Finave" era 1.478 empresas marcadas uma a
-- uma: empresa nova no Questor ficava fora até alguém ir caçar e marcar, e quem
-- tinha o cargo simplesmente não a enxergava.
--
-- Agora o grupo tem modo:
--   lista  → as empresas marcadas são o grupo (como sempre foi);
--   exceto → o grupo é TODA empresa do Questor menos as marcadas, resolvido na
--            leitura contra o cadastro de empresas; a nova entra sozinha.
-- A tabela de itens não muda: continua guardando as marcadas, e o modo diz o
-- que elas significam. Todo grupo existente nasce `lista`, sem mudar ninguém.

alter table empresa_grupo
  add column modo text not null default 'lista' check (modo in ('lista', 'exceto'));

alter table grupo_empresarial
  add column modo text not null default 'lista' check (modo in ('lista', 'exceto'));
