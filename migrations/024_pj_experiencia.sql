-- PJ em experiência: prestador PJ (rh_pessoa_pj, migration 021) também pode ter
-- contrato de experiência, mas como é cadastrado à mão (não vem do Questor), a RH
-- decide caso a caso pela caixinha. Marcado, o PJ entra na MESMA trilha de
-- experiência dos CLT (marcos 45/90 a partir da data de início; formulário aos
-- gestores do setor) via o contrato sintético PJ_CONTRATO_OFFSET + id.
alter table rh_pessoa_pj
  add column tem_experiencia boolean not null default false;
