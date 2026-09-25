# NaveX

Plataforma de trabalho da Navecon sobre o banco do Questor (somente leitura).
Reescrita do Nexo: a camada de domínio vem do nexo2, a interface é nova.

## Estado

| Módulo | Situação |
|---|---|
| Contábil, Fiscal, DP, RH, Societário, Configurações | prontos, conferidos contra o Questor |
| Obrigações | pronto; a fila local só enche com a varredura do Acessórias |
| Administração (usuários, cargos, setores, grupos de permissão, auditoria) e Meu Perfil | prontos |

Tudo o que o nexo2 tinha existe no NaveX. No dia da troca, os usuários, os
cargos e a fila do Acessórias vêm junto com o banco do app (o schema é o mesmo).

O agendador (avisos de rescisão, lembretes de experiência, envios recorrentes,
varredura do Acessórias às 5h) é o serviço `navex-scheduler`, atrás do perfil
`agendador`. Só pode haver um ligado no escritório: dois mandariam cada aviso
em dobro e dividiriam o limite de chamadas da API do Acessórias. Por isso ele
liga no servidor (`COMPOSE_PROFILES=agendador` no `.env`) no mesmo gesto que
desliga o do nexo2, e nunca na máquina de desenvolvimento.

## Rodar

```bash
cp .env.example .env        # preencher Questor, senha do banco e admin
npm install
npm run db:up               # banco do app em 127.0.0.1:5083 (Docker)
npm run setup               # migrations + admin + grupo padrão
npm run dev                 # http://localhost:4083
```

Produção: `docker compose up -d --build` (app `navex-app`, migrations
`navex-migrate`, banco `navex-db`, agendador `navex-scheduler`). Porta do app
pela variável `APP_PORT`.

## Troca do nexo2 no servidor

O NaveX assumiu o repositório do nexo (`edulanzarin/nexo`). O último estado do
nexo2 ficou na tag `nexo2-final` e no ramo `nexo2`. O schema do banco é o mesmo,
então a troca é copiar o banco, sem conversão. Tudo o que o app guarda está nele,
inclusive as fotos, e as senhas vêm junto.

Na pasta do nexo no servidor, **antes** do `git pull`, com o compose antigo
ainda no lugar:

```bash
docker ps --format "{{.Names}}"     # nomes do app, do agendador e do banco
docker stop <app> <agendador>       # a partir daqui ninguém grava no nexo2
docker exec <banco> sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl -f /tmp/nexo.dump'
docker cp <banco>:/tmp/nexo.dump ../nexo.dump
docker compose down                 # sem -v: o volume antigo fica, é a volta
git rev-parse HEAD > ../nexo2-commit.txt
git status                          # compose mexido à mão no servidor? git stash
```

O dump é gravado dentro do container e copiado para fora de propósito: no
PowerShell, o `>` corrompe arquivo binário. No Git Bash do Windows, rodar antes
`export MSYS_NO_PATHCONV=1`, senão o `/tmp/nexo.dump` dos comandos vira caminho
do Windows e o `pg_restore` não acha o arquivo.

Depois o código novo e o banco:

```bash
git pull
# no .env: COMPOSE_PROFILES=agendador. APP_PORT, APP_URL e as credenciais
# do nexo2 servem como estão (mantendo a 4022, os links já enviados seguem valendo).
docker compose up -d navex-db
docker cp ../nexo.dump navex-db:/tmp/nexo.dump
docker exec navex-db pg_restore -U navex -d navex --no-owner --role=navex --exit-on-error /tmp/nexo.dump
docker compose up -d --build
docker logs navex-migrate           # aplica só as migrations que faltarem
docker logs navex-scheduler         # "iniciado", com base=http://navex-app:3000
```

O restore tem que cair no banco vazio, antes da primeira subida do app: se o
`navex-migrate` rodar antes, as tabelas já existem e o `pg_restore` para no
primeiro conflito.

Para voltar: `docker compose down`, `git checkout $(cat ../nexo2-commit.txt)` (e
`git stash pop` se houve stash), `docker compose up -d`. O volume do nexo2 está intacto; o que
foi gravado no NaveX depois da troca fica só nele.

## Pastas

- `src/lib`: domínio (SQL do Questor, motores, sessão, permissão).
- `src/componentes/{primitivos,produto,casca}`: o sistema de design.
- `src/app/sistema`: o catálogo vivo dos componentes.
- `migrations`: SQL puro, o mesmo schema do nexo2.
