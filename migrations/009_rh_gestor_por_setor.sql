-- Gestor de experiência é por DEPARTAMENTO (classiforgan), não por empresa.
--
-- NAVECON (1) e FOUR (888) são a MESMA empresa — CNPJs distintos, mesmos
-- departamentos. "Contábil" é um só (classiforgan 002 nas duas), com um gestor,
-- valendo para os funcionários das duas. Antes o cadastro era por
-- (empresa, estab, classiforgan), duplicando cada departamento; agora é só por
-- classiforgan. (Os códigos de classiforgan coincidem entre as duas — 002
-- Contábil, 003 Pessoal… — verificado.)

-- Dedup por (classiforgan, email): mesmo depto + mesmo e-mail vira uma linha só
-- (o resto — e-mails diferentes no mesmo depto — permanece, é o RH que limpa).
delete from rh_setor_gestor a
  using rh_setor_gestor b
 where a.id > b.id and a.classiforgan = b.classiforgan and a.email = b.email;

drop index if exists rh_setor_gestor_setor_idx;
alter table rh_setor_gestor
  drop constraint rh_setor_gestor_codigoempresa_codigoestab_classiforgan_emai_key;
alter table rh_setor_gestor drop column codigoempresa;
alter table rh_setor_gestor drop column codigoestab;
alter table rh_setor_gestor
  add constraint rh_setor_gestor_setor_email_key unique (classiforgan, email);
create index rh_setor_gestor_setor_idx on rh_setor_gestor (classiforgan) where ativo;
