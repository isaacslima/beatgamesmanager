# Beat Games Manager

Projeto para gerenciar jogos que você quer zerar, com:

- Nome do jogo
- Plataforma (ex.: Nintendo Wii U, Nintendo DS, PC com emulador)
- Emulador (quando a plataforma for PC com emulador)
- Data de início
- Data de término
- Observações
- Nota (0 a 10)
- Tempo total jogado em horas (opcional)

Também inclui busca opcional de jogos em API externa (CheapShark).

## Stack atual

- Backend: Node.js + Express
- Banco: Vercel Postgres
- Frontend: HTML/CSS/JS estático

## Requisitos

- Node.js 22+
- Projeto Vercel com Postgres criado (para rotas de CRUD)

## Instalação local

```bash
npm install
```

## Executar localmente

```bash
npm start
```

A aplicação fica disponível em `http://localhost:3000`.

> Para usar CRUD localmente com banco, configure as variáveis do Vercel Postgres no ambiente local.

## Scripts

- `npm start`: inicia servidor local
- `npm run dev`: inicia servidor local com watch
- `npm test`: executa testes existentes (`node --test`)
- `npm run migrate`: importa dados de `data/games.json` para o Postgres

## Endpoints da API

- `GET /api/games`: lista jogos
- `POST /api/games`: cria jogo
- `PUT /api/games/:id`: atualiza jogo
- `DELETE /api/games/:id`: remove jogo
- `GET /api/search-games?q=...`: busca jogos na API externa

## Publicar na Vercel (passo a passo)

1. Suba o repositório no GitHub.
2. Na Vercel, clique em **Add New Project**.
3. Importe o repositório `isaacslima/beatgamesmanager`.
4. Framework: **Other**.
5. Build command: padrão (ou `npm install`).
6. Start command: `npm start`.
7. Faça o primeiro deploy.

## Criar banco gratuito na Vercel

1. No projeto da Vercel, abra **Storage**.
2. Clique em **Create** e escolha **Postgres**.
3. Selecione o plano gratuito (Hobby).
4. Finalize a criação do banco.
5. A Vercel adicionará automaticamente as variáveis de ambiente do banco no projeto.

## Migração do JSON para Postgres

Após criar o Postgres, rode a migração para importar os dados já existentes no `data/games.json`:

```bash
npm run migrate
```

O script:
- lê o arquivo `data/games.json`
- cria/atualiza a tabela `games` (se ainda não existir ou faltar colunas)
- insere/atualiza registros por `id`

## Migração automática ao subir o backend

Ao iniciar o backend, a aplicação executa a migração de schema automaticamente:

- cria a tabela `games` se não existir
- adiciona colunas novas se ainda não existirem

Isso garante que o banco fique pronto sem precisar rodar SQL manualmente.

## Verificação pós-deploy

1. Acesse a URL do projeto na Vercel.
2. Teste criar, editar, listar e excluir jogos.
3. Teste a busca externa (`/api/search-games`).
4. Faça um novo deploy e confirme que os dados continuam no banco.

## Estrutura

- `/src/app.js`: app Express com rotas
- `/src/server.js`: bootstrap para execução local
- `/src/db.js`: camada de acesso ao Postgres
- `/scripts/migrate-json-to-postgres.js`: migração do JSON para banco
- `/api/index.js`: entrada serverless para Vercel
- `/public`: interface web
- `/data/games.json`: fonte legada para migração
- `/vercel.json`: roteamento para deploy na Vercel
