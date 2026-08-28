-- Progresso, cancelamento e retomada da varredura do Acessórias.
--
-- A varredura roda dentro do processo do app e leva ~30 min. Isso significa que
-- QUALQUER reinício (deploy, `docker compose up`, restart do container) a mata no
-- meio — e, como estava, ela recomeçava do zero na vez seguinte, jogando fora
-- meia hora de trabalho já feito. Numa carteira de 2.098 empresas isso não é
-- detalhe: é a diferença entre uma fila que se completa e uma que nunca fecha.
--
-- Três colunas resolvem as três faltas:
--
--  * `progresso`/`total` — quantas empresas já foram e quantas são. Servem ao
--    "faltam X" da tela E à RETOMADA: a lista de empresas é percorrida em ordem
--    estável, então o índice é um marcador válido entre execuções.
--  * `cancelar` — pedido de parada. A varredura o relê a cada empresa (na mesma
--    ida ao banco em que grava o progresso, sem round-trip extra) e encerra
--    limpo. Matar o processo também para, mas deixa a linha órfã; isto para com
--    a linha fechada e o progresso preservado.
--  * `retomada_de` — de qual ponto esta execução partiu. Sem isso, "1.200
--    empresas varridas" numa execução retomada seria mentira: ela varreu 400.

alter table obr_sync
  add column progresso   integer not null default 0,
  add column total       integer not null default 0,
  add column cancelar    boolean not null default false,
  add column retomada_de integer;

-- A varredura consulta este flag a cada empresa; o índice parcial mantém a
-- checagem barata mesmo com a tabela crescendo por execução diária.
create index obr_sync_abertas_idx on obr_sync (id) where concluido_em is null;
