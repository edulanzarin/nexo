-- Limpa rodadas de clima ÓRFÃS: as que ficaram sem formulário depois da migração
-- 022 (ex.: a semente 'clima-2026') e que não têm nenhuma resposta. Sem formulário
-- o link público mostra "indisponível" — não servem para nada. Só apaga o que está
-- vazio, para nunca destruir histórico.

delete from clima_rodada r
 where r.formulario_id is null
   and not exists (select 1 from clima_resposta c where c.rodada_id = r.id);
