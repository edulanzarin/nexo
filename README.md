# NaveX

Plataforma de trabalho da Navecon sobre o banco do Questor (somente leitura).
Reescrita do Nexo: a camada de domínio vem do nexo2, a interface é nova.

## Estado

| Módulo | Situação |
|---|---|
| Contábil | em construção |
| Fiscal, DP, RH, Obrigações, Societário, Configurações | seguem no Nexo |

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
