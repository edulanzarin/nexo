# NaveX

Plataforma de trabalho da Navecon sobre o banco do Questor (somente leitura).
Reescrita do Nexo: a camada de domínio vem do nexo2, a interface é nova.

## Estado

| Módulo | Situação |
|---|---|
| Contábil, Fiscal, DP, RH, Configurações | prontos, conferidos contra o Questor |
| Obrigações, Societário | seguem no Nexo |
| Administração (usuários, cargos, grupos de permissão, auditoria) e perfil | seguem no Nexo |

Sem a Administração, o NaveX só tem o admin que o `npm run setup` cria. No dia
da troca, os usuários e cargos vêm junto com o banco do app.

O agendador (avisos de rescisão, lembretes de experiência, envios recorrentes)
ainda não sobe no compose: enquanto o nexo2 estiver no ar, é ele quem manda os
e-mails. Dois agendadores mandariam cada aviso em dobro.

## Rodar

```bash
cp .env.example .env        # preencher Questor, senha do banco e admin
npm install
npm run db:up               # banco do app em 127.0.0.1:5083 (Docker)
npm run setup               # migrations + admin + grupo padrão
npm run dev                 # http://localhost:4083
```

Produção: `docker compose up -d --build` (app `navex-app`, migrations
`navex-migrate`, banco `navex-db`). Porta do app pela variável `APP_PORT`.

## Pastas

- `src/lib`: domínio (SQL do Questor, motores, sessão, permissão).
- `src/componentes/{primitivos,produto,casca}`: o sistema de design.
- `src/app/sistema`: o catálogo vivo dos componentes.
- `migrations`: SQL puro, o mesmo schema do nexo2.
