# Beat Games Manager

Projeto simples para gerenciar jogos que você quer zerar, com campos de:

- Nome do jogo
- Data de início
- Data de término
- Observações
- Nota (0 a 10)

Também inclui busca opcional de jogos em API externa (CheapShark).

## Requisitos

- Node.js 18+

## Instalação

```bash
npm install
```

## Executar localmente

```bash
npm start
```

A aplicação ficará disponível em `http://localhost:3000`.

## Scripts

- `npm start`: inicia o servidor
- `npm run dev`: inicia com watch
- `npm test`: executa testes (`node --test`)

## Endpoints da API

- `GET /api/games`: lista jogos
- `POST /api/games`: cria jogo
- `PUT /api/games/:id`: atualiza jogo
- `DELETE /api/games/:id`: remove jogo
- `GET /api/search-games?q=...`: busca jogos na API externa

## Estrutura

- `/src/server.js`: backend Express e API
- `/public`: interface web (HTML/CSS/JS)
- `/data/games.json`: armazenamento local dos jogos
