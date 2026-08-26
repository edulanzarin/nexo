-- A conta que a natureza de SERVIÇO de fato recebe, aprendida do histórico.
--
-- O motor do Balancete Fiscal cobra a conta que a tabela de contabilização do
-- Questor manda (cfop.codigotabctbfis* -> tabelactbfislctoctb.contactb). Para
-- mercadoria isso é regra viva; para serviço (natureza 8xxxxxx), não: medido em
-- mai–jul/2026, a conta do plano só acerta 62% das NFSE, e em 443 pares
-- (empresa, filial, natureza) TODAS as notas caem numa conta só, diferente da
-- configurada — em 79% deles a conta do plano não teve nenhum movimento no
-- trimestre. São dois caminhos, medidos nos 446 pares do trimestre:
--   * 373 — natureza ESPECÍFICA apontando pra conta aposentada. A empresa criou
--     conta nova (às vezes mesmo nome e mesmo apelido: emp 42, "Manutenção de
--     Veículos" 4507 de 2007 x 5973 de 2024) e só o contábil mudou de conta.
--   * 73 — natureza GENÉRICA. O e-Doc importa a nota como "Serviço Tomados
--     Geral" (8000001), cuja tabela é vala-comum (3171 "Serviços de Terceiros"),
--     e a contabilização usa a natureza específica do catálogo da empresa
--     (8001015 "Serv. Profiss." -> 4537). Essa escolha NÃO fica gravada na nota:
--     nem a conta nem o número da tabela aparecem em qualquer coluna de qualquer
--     tabela lctofisent* dela (procurado coluna a coluna).
-- Nos dois, toda NFSE daquela natureza aparecia como "conta errada" todo mês.
--
-- O sinal bom está no próprio histórico: a conta habitual da natureza acerta
-- 86%. Este cadastro guarda esse aprendizado; o que foge dele é que vira
-- divergência — e aí é anomalia de verdade, não config velha.
--
-- E há o outro caso: natureza GENÉRICA ("Serviços Tomados S/ Retenção – Serv.
-- Profiss."), em que a conta muda de nota para nota de propósito e nenhuma
-- domina. Aí não existe regra para cobrar — `habitual = false` diz isso, e o
-- motor passa a tratar a conta como decidida no lançamento (igual à
-- contrapartida de fornecedor), em vez de cobrar a do plano. Medido no
-- trimestre: 3.424 notas vivem em natureza dispersa e 2.612 delas eram
-- marcadas como conta errada — todo o ruído restante depois do aprendizado.
--
-- Precedência: override manual (conf_regra) > esta conta efetiva > Questor.

create table if not exists conf_natureza_conta_efetiva (
  codigo_empresa integer not null,
  codigo_estab   integer not null,
  codigo_cfop    integer not null,
  -- o que o Questor manda hoje (evidência: é a conta que seria cobrada)
  conta_plano    bigint,
  -- a conta que a natureza de fato recebe (moda dos últimos 12 meses);
  -- null quando nenhuma domina — natureza genérica, sem regra de conta
  conta_efetiva  bigint,
  -- a moda domina o histórico (>= 80% das notas)? só então vira regra
  habitual       boolean not null,
  descr_efetiva  text,
  -- evidência do aprendizado, para a tela explicar o porquê
  notas          integer not null default 0,
  acertos        integer not null default 0,
  atualizado_em  timestamptz not null default now(),
  primary key (codigo_empresa, codigo_estab, codigo_cfop)
);

create index if not exists conf_natureza_conta_efetiva_empresa_idx
  on conf_natureza_conta_efetiva (codigo_empresa);

-- Marca que a empresa já foi semeada. Sem isto, empresa SEM natureza de serviço
-- (cadastro vazio é resultado legítimo) reaprenderia a cada request, e o
-- aprendizado é uma varredura de 12 meses — caro para rodar à toa.
create table if not exists conf_natureza_conta_efetiva_run (
  codigo_empresa integer primary key,
  naturezas      integer not null default 0,
  atualizado_em  timestamptz not null default now()
);
