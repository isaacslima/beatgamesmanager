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

- Backend: Node.js + Express (serverless na Vercel)
- Autenticação: Firebase Authentication (Google e e-mail/senha)
- Banco: Cloud Firestore (acessado pelo backend via `firebase-admin`)
- Imagens das plataformas: Vercel Blob
- Hosting: Vercel
- Frontend: HTML/CSS/JS estático

Cada usuário tem seus próprios dados no Firestore:

```
users/{uid}/games/{gameId}
users/{uid}/platforms/{platformId}
```

## Requisitos

- Node.js 22+
- Projeto Firebase `beatgamesmanager` com Authentication e Firestore habilitados
- Projeto Vercel com Blob Storage (para imagens das plataformas)

## Configurar o Firebase

1. No [console do Firebase](https://console.firebase.google.com/project/beatgamesmanager), abra **Authentication > Sign-in method** e habilite **Google** e **E-mail/senha**.
2. Em **Authentication > Settings > Authorized domains**, adicione o domínio da Vercel (ex.: `beatgamesmanager.vercel.app`). `localhost` já vem autorizado.
3. Abra **Firestore Database** e crie o banco (modo produção).
4. As regras e índices do Firestore são publicados com `npm run deploy` (veja abaixo).
5. Em **Configurações do projeto > Contas de serviço**, clique em **Gerar nova chave privada** e baixe o JSON.

## Variáveis de ambiente

Configure na Vercel (**Settings > Environment Variables**) e, localmente, em `.env.local`:

| Variável | Descrição |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Conteúdo do JSON da conta de serviço, em uma linha |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob (adicionado automaticamente ao conectar o Blob ao projeto) |

Alternativa ao `FIREBASE_SERVICE_ACCOUNT`: `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (com `\n` nas quebras de linha). Sem nenhuma delas, o backend usa `GOOGLE_APPLICATION_CREDENTIALS`.

> A configuração web do Firebase (apiKey etc.) fica em `public/auth.js`. Ela é pública por natureza; a segurança vem das regras do Firestore e da verificação do token no backend.

## Instalação e execução local

```bash
npm install
npm start
```

A aplicação fica disponível em `http://localhost:3000`.

## Scripts

- `npm start`: inicia servidor local
- `npm run dev`: inicia servidor local com watch
- `npm test`: executa testes existentes (`node --test`)
- `npm run firebase:login`: autentica o Firebase CLI (uma vez por máquina)
- `npm run deploy`: publica no Firebase tudo o que está em `firebase.json` (regras e índices do Firestore)

## Deploy no Firebase

As configurações do Firebase ficam versionadas no repositório:

- `firebase.json`: o que é publicado
- `.firebaserc`: projeto padrão (`beatgamesmanager`)
- `firestore.rules`: regras de segurança (bloqueiam acesso direto dos clientes)
- `firestore.indexes.json`: índices do Firestore

```bash
npm run firebase:login   # só na primeira vez
npm run deploy
```

O hosting e o Blob continuam na Vercel (deploy automático a cada push).

## Endpoints da API

Todos exigem o header `Authorization: Bearer <Firebase ID token>`.

- `GET /api/games`: lista jogos
- `POST /api/games`: cria jogo
- `PUT /api/games/:id`: atualiza jogo
- `DELETE /api/games/:id`: remove jogo
- `GET /api/platforms`: lista plataformas
- `POST /api/platforms`: cria plataforma (multipart, imagem opcional enviada ao Vercel Blob)
- `GET /api/stats`: estatísticas do dashboard
- `GET /api/search-games?q=...`: busca jogos na API externa

## Estrutura

- `/src/app.js`: app Express com rotas e middleware de autenticação
- `/src/firebase.js`: inicialização do Firebase Admin (Auth + Firestore)
- `/src/server.js`: bootstrap para execução local
- `/src/db.js`: camada de acesso ao Firestore
- `/firebase.json`, `/.firebaserc`, `/firestore.indexes.json`: configuração do Firebase CLI
- `/firestore.rules`: regras de segurança do Firestore
- `/api/index.js`: entrada serverless para Vercel
- `/public`: interface web (`auth.js` contém o login com Firebase)
- `/vercel.json`: roteamento para deploy na Vercel
