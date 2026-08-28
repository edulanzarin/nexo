# Nexo

Dashboard de Business Intelligence sobre a base PostgreSQL do Questor (Navecon).
Next.js 16 + React Query + Recharts + Tailwind v4, lendo o banco **em modo somente leitura**.

## Os dois bancos

- **Questor** (`Navecon`) — produção, **somente leitura**. O app nunca escreve nele.
- **Banco do app** — Postgres próprio, gravável, sobe junto no Docker. Guarda os
  overrides do plano de contabilização (e, adiante, usuários e permissões).
  Migrations em `migrations/`, aplicadas automaticamente no boot do container.

Toda a configuração fica em **`.env`** (modelo em `.env.example`), que é
gitignored — nenhuma senha vai para o repositório. É o arquivo que o Docker
Compose lê nativamente e que o Next também usa em desenvolvimento.

> A senha do banco do app (`APP_DB_PASSWORD`) só é aplicada na **primeira**
> subida, quando o volume é criado. Para trocar depois: `docker compose down -v`
> (apaga os dados do app) ou um `ALTER USER` no banco.

## Rodando em produção (rede local)

No computador que vai hospedar, com Docker instalado:

```bash
cp .env.example .env   # preencher credenciais do Questor e APP_DB_PASSWORD
docker compose up -d --build
```

Pronto — o app fica em **`http://<ip-do-computador>:4022`**, acessível por
qualquer máquina da rede. O container aplica as migrations sozinho antes de
subir o servidor, e ambos os serviços têm `restart: unless-stopped` (voltam
depois de reboot).

Comandos úteis:

```bash
docker compose logs -f app     # acompanhar
docker compose down            # parar (dados do app ficam no volume)
docker compose up -d --build   # atualizar depois de mudar o código
```

Em produção o Postgres do app **não publica porta nenhuma** — o app fala com ele
pela rede interna do compose, então nada além da 4022 é exposto. O volume
`app-db-data` guarda os dados; `docker compose down -v` apaga tudo.

## Rodando em desenvolvimento

Aqui **não** se usa Docker para o app — só para o banco. O Next roda direto na
máquina, com hot reload:

```bash
npm install
npm run db:up      # sobe só o Postgres do app (publica em 127.0.0.1:5433)
npm run migrate    # aplica as migrations
npm run dev        # porta 3000, hot reload
```

`docker compose up -d --build` é o fluxo de **produção**. Não precisa rebuildar
a imagem para testar mudança: mexeu no código, o `npm run dev` já reflete.
Quando a mudança estiver pronta, aí sim se builda no computador de produção.

> **Pegadinha:** rodar `docker compose up -d` (sem o arquivo de dev) nesta
> máquina recria o banco **sem** publicar a 5433, e aí o `npm run dev` perde o
> acesso ao banco do app — as telas do Contábil passam a responder 503. É só
> rodar `npm run db:up` de novo. A mensagem de erro na tela já diz isso.

Por que o banco em Docker mesmo no dev: é o mesmo Postgres 17 da produção,
mesmas migrations, sem instalar nada na máquina.

## O que já existe

- **Módulo Fiscal → Notas Fiscais** (`/fiscal/notas`) — trabalha com agregados (valores e quantidades), sem listagem de notas individuais:
  - KPIs de entradas, saídas, empresas com movimento e canceladas, com variação vs período anterior e ticket médio; a métrica escolhida (valor ou quantidade) vira o número principal
  - Evolução diária/mensal (granularidade automática acima de 92 dias)
  - Distribuição por espécie de documento (NFE, CTE, NFSE…)
  - Impostos: ICMS, ICMS-ST, IPI, ISS, PIS, COFINS + retenções (IRRF, INSS, CSLL, ISSQN) — de várias tabelas do Questor
  - Top 10 empresas, fornecedores/clientes, produtos e CFOPs
  - Distribuição por estado (UF) da contraparte e **devoluções** por CFOP (compra/venda)
  - **Notas fiscais** (explorador bruto): tabela de notas nota a nota, paginada, com busca por número/contraparte e drill-down dos itens de cada nota
  - Navegação pela **sidebar em acordeão** — o módulo Fiscal tem 6 seções em rotas próprias: **Painel · Impostos · Análises · Devoluções · Cancelamentos · Notas fiscais** (cada uma carrega só seus dados; filtros compartilhados e preservados ao navegar)
  - **Impostos** completos: ICMS/ST/IPI/ISS/PIS/COFINS + retenções + DIFAL/FCP/FUNRURAL, série temporal e ranking por empresa
  - **Análises**: rankings de empresas, contrapartes, produtos, CFOPs, UF, municípios e modalidade de frete
  - **Devoluções** e **Cancelamentos** com KPIs, séries e rankings próprios
  - Alternância **Valor | Quantidade** onde faz sentido
- **Módulo Contábil → Funcionários** (`/contabil/funcionarios`) — o quadro da empresa lido da folha do Questor (vínculo, cargo, setor, admissão, desligamento), **sem remuneração**: quem precisa de salário usa o módulo DP. Responde à pergunta que o extrato levanta: o favorecido deste pagamento é funcionário?
  - A **Conciliação carimba a resposta sozinha** na linha do extrato — casa a descrição bancária com a folha por CPF (o mascarado do PIX serve) ou nome, marca ex-funcionário com a data do desligamento, aponta quando o vínculo é de outra empresa da carteira e avisa homônimo em vez de escolher em silêncio (`src/lib/folha-casamento.ts`). O selo é contexto: não muda conta nenhuma
- Filtros por período (presets + personalizado), empresas (multi-seleção com busca) e espécies — tudo na URL, compartilhável
- **Grupos de empresas criados no próprio app** (localStorage): criar/editar/excluir, e **multi-seleção** (somar vários grupos, desmarcar individualmente)
- Tema claro/escuro, skeletons, toasts (sonner), animações
- Sidebar preparada para módulos futuros (Contábil, Folha, Patrimônio)

## Estrutura

- `src/lib/db.ts` — pool pg (somente leitura, `statement_timeout` 60s)
- `src/lib/fiscal-filters.ts` — parse dos filtros e montagem do WHERE compartilhado
- `src/app/api/**` — endpoints REST consultando cabeçalhos (`lctofisent`/`lctofissai`) e itens (`lctofis*produto`)
- `src/app/fiscal/notas/` — página do dashboard
- `src/components/` — filtros, gráficos e cards

## Notas sobre o banco

- Cabeçalho da nota em `lctofis{ent,sai}`; **itens** (produtos, CFOP, ICMS/IPI/ST/ISS) em `lctofis{ent,sai}produto` — tabelas grandes (saídas ~47M linhas)
- Impostos espalhados: PIS/COFINS em `lctofis{ent,sai}piscofins`, retenções (IRRF/INSS/CSLL/ISSQN) em `lctofis{ent,sai}retido`, DIFAL em `lctofis{ent,sai}difal`. Documentação completa do banco no cérebro `~/Documentos/Questor`
- Top produtos/CFOP: agrega num CTE e só junta `produto`/`empresa` nos vencedores (ver `api/fiscal/produtos`) — evita join sobre milhões de linhas; ~2,6s no mês inteiro de todas as empresas
- Canceladas (`cancelada = '1'`) ficam **fora** dos totais e gráficos; contam só no KPI próprio. As tabelas de item não têm `cancelada`, então impostos/produtos/CFOP incluem canceladas
- UF: colunas do cabeçalho vêm mal preenchidas; usamos `pessoa.siglaestado` via join (cobertura maior)
- Índice usado: `(codigoempresa, codigoestab, datalctofis)` — consultas sem filtro de empresa varrem por data (600k notas/mês ≈ 0,5s)
- `codigopessoa` → `pessoa` é a contraparte da nota. Verificado: em notas de entrada com `emitentenf = 'T'` (terceiros), 97% dos CNPJs embutidos na chave NFe batem com `pessoa.inscrfederal` — é o fornecedor mesmo. Com `emitentenf = 'P'` a nota foi emitida pela própria empresa (devoluções) e a pessoa é o cliente
- `grupoprocessam`/`grupoempresa` **não** são grupos de empresas para app (são grupos de processamento internos do Questor) — por isso os grupos aqui são criados no app
