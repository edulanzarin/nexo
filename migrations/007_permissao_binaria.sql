-- Permissão vira BINÁRIA: seção é liberada ou não. Sai o nível view/edit.
--
-- Motivo: distinguir ver de editar exige esconder controle por controle em telas
-- complexas — trabalhoso e fácil de esquecer. Mais simples: acesso por TELA. O
-- que não pode ser visto/editado por um cargo vira uma seção própria e não é
-- concedido a ele.
--
-- - cargo_secao: perde `nivel` (a linha já significa "o cargo concede a seção").
-- - usuario_secao: deixa de guardar nível e vira OVERRIDE binário — `permitido`
--   true LIBERA uma seção que o cargo não dá; false BLOQUEIA uma que ele dá.
--   Converte o que existia: 'none' era bloqueio (false); view/edit eram acesso (true).

alter table cargo_secao drop column nivel;

alter table usuario_secao add column permitido boolean not null default true;
update usuario_secao set permitido = (nivel <> 'none');
alter table usuario_secao drop constraint usuario_secao_nivel_check;
alter table usuario_secao drop column nivel;
