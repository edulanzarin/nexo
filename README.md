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
varredura do Acessórias às 5h) ainda não sobe no compose: enquanto o nexo2
estiver no ar, é ele quem manda os e-mails e varre o Acessórias. Dois
agendadores mandariam cada aviso em dobro e dividiriam o limite de chamadas da
API do Acessórias. Até lá, a fila do NaveX enche pela varredura manual
(Obrigações, Configurações) ou pela consulta de uma empresa.

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
