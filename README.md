# Beat Games Manager

Gerenciador de biblioteca de jogos: lista de desejo, planejados, zerados e dropados.
A especificação completa está em [`docs/especifica_o_de_features_beat_games.md`](docs/especifica_o_de_features_beat_games.md).

## Funcionalidades

- **Dashboard**: cards de totais (jogos, plataformas, zerados, lista de desejo), gráficos por nota (11 a 1), por dificuldade (C a AAA), top plataformas e lista dos jogos GOTY.
- **Jogos**: DataTable com busca, filtros (plataforma, gênero, status, período e GOTY), ordenação por coluna e paginação.
- **Cadastros** com CRUD e DataTable próprios: Status (nome, cor e ordem editáveis), Plataformas (com imagem), Gêneros, Tipos (subcategoria opcional de um gênero), Notas / Avaliações (escala de 1 a 11) e Níveis de Dificuldade.
- **Campos do jogo**: nome, plataforma, gênero, tipo, status, data de início e término (opcionais), tempo total (`HH:MM:SS`, `HH:MM` ou horas decimais), nota, dificuldade, condição de zeramento, destaque/GOTY e observações.
- **Condição de zeramento com sugestões**: ao focar ou digitar no campo, o sistema sugere condições já usadas no seu histórico, priorizando jogos do mesmo tipo, gênero e plataforma, além de exemplos padrão.
- **Integridade**: não é possível excluir plataforma, gênero, tipo, nota ou dificuldade em uso por algum jogo.
- **Importação via JSON** (Jogos > Importar JSON): baixe o exemplo, selecione o arquivo e confira a prévia linha a linha (erros, possíveis duplicados e cadastros que serão criados) antes de confirmar. Plataformas, gêneros e tipos são informados pelo nome e criados se não existirem; status, dificuldade e nota precisam já estar cadastrados.
- No primeiro acesso, cada usuário recebe os status (Lista de Desejo, Planejado para Jogar, Zerado, Dropado), a escala de notas (11 - Jogo da vida até 1 - Tragédia) e as dificuldades (C/Fácil até AAA/Imperdoável). Tudo é editável; "Lista de Desejo" e "Zerado" podem ser renomeados, mas não excluídos, porque alimentam os cards do dashboard.
- **Dados por usuário**: cada conta tem os próprios jogos e cadastros; o backend só acessa `users/{uid}` do usuário do token.
- Busca opcional do nome do jogo na API externa (CheapShark), direto no formulário.

## Stack atual

- Hosting: Firebase Hosting (serve `public/` e encaminha `/api/**` para a função)
- Backend: Node.js + Express no Cloud Functions (2ª geração, função `api` em `us-central1`)
- Autenticação: Firebase Authentication (Google e e-mail/senha)
- Banco: Cloud Firestore (acessado pelo backend via `firebase-admin`)
- Imagens das plataformas: Vercel Blob (único serviço que continua na Vercel)
- Frontend: HTML/CSS/JS estático (módulos ES)

Cada usuário tem seus próprios dados no Firestore:

```
users/{uid}                       { defaultsSeededAt }
users/{uid}/games/{gameId}        title, platformId, genreId, typeId, status, startDate, endDate,
                                  playTimeSeconds, score, difficultyId, completionCondition, isGoty, notes
users/{uid}/statuses/{id}         name, color, order, description
users/{uid}/platforms/{id}        name, imageUrl
users/{uid}/genres/{id}           name, description
users/{uid}/types/{id}            name, genreId (opcional), description
users/{uid}/scores/{valor}        value (1–11), label, description
users/{uid}/difficulties/{id}     key (C…AAA), label, order, description
```

O campo `status` do jogo guarda o id de um registro em `statuses` (os padrões usam os ids `wishlist`, `planned`, `completed` e `dropped`).

## Requisitos

- Node.js 22+
- Projeto Firebase `beatgamesmanager` no plano **Blaze** (pago por uso; obrigatório para Cloud Functions e Secret Manager; o uso pessoal costuma ficar dentro da cota gratuita)
- Um Blob store na Vercel (para as imagens das plataformas)

## Configurar o Firebase

1. No [console do Firebase](https://console.firebase.google.com/project/beatgamesmanager), abra **Authentication > Sign-in method** e habilite **Google** e **E-mail/senha**.
2. Em **Authentication > Settings > Authorized domains**, confirme `beatgamesmanager.web.app` e `beatgamesmanager.firebaseapp.com` (já vêm por padrão). `localhost` também já vem autorizado.
3. Abra **Firestore Database** e crie o banco (modo produção).
4. Em **Configurações do projeto > Uso e faturamento**, mude o plano para **Blaze**.
5. Em **Configurações do projeto > Contas de serviço**, clique em **Gerar nova chave privada** e baixe o JSON (usado só para rodar localmente).

## Variáveis e secrets

**Produção (Cloud Functions):** as credenciais do Firebase são automáticas. Só o token do Blob precisa ser cadastrado, uma vez, como secret:

```bash
npx firebase functions:secrets:set BLOB_READ_WRITE_TOKEN
```

**Local (`.env.local`):**

| Variável | Descrição |
| --- | --- |
| `SERVICE_ACCOUNT_JSON` | Conteúdo do JSON da conta de serviço, em uma linha |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob (Vercel > Storage > seu Blob store > `.env.local`) |

> Não use o prefixo `FIREBASE_` nos arquivos `.env*`: ele é reservado pelo Firebase CLI. `FIREBASE_SERVICE_ACCOUNT` ainda é aceito pelo `npm run dev`, mas quebra o emulador.

Para o emulador de Functions, o secret fica em `.secret.local` (`BLOB_READ_WRITE_TOKEN=...`). Os arquivos `*.local` e `.env*` são ignorados pelo git.

> A configuração web do Firebase (apiKey etc.) fica em `public/js/auth.js`. Ela é pública por natureza; a segurança vem das regras do Firestore e da verificação do token no backend.

## Instalação e execução local

```bash
npm install
npm start
```

A aplicação fica disponível em `http://localhost:3000` (o Express serve o frontend e a API juntos).

Para testar exatamente como em produção (Hosting + Function emulados, usando o Firestore real):

```bash
npm run emulators   # abre em http://127.0.0.1:5000 (ou a próxima porta livre)
```

## Scripts

- `npm start` / `npm run dev`: servidor local (com watch no `dev`)
- `npm test`: testes automatizados (`node --test`)
- `npm run emulators`: emuladores de Hosting e Functions
- `npm run firebase:login`: autentica o Firebase CLI (uma vez por máquina)
- `npm run deploy`: publica no Firebase tudo o que está em `firebase.json` (Hosting, Function `api`, regras e índices do Firestore)
- `npm run deploy:hosting`: publica só o frontend

## Deploy no Firebase

As configurações do Firebase ficam versionadas no repositório:

- `firebase.json`: Hosting (com rewrite de `/api/**` para a função), Functions e Firestore
- `.firebaserc`: projeto padrão (`beatgamesmanager`)
- `src/functions.js`: entrada da função `api` (usa o app Express de `src/app.js`)
- `firestore.rules`: regras de segurança (bloqueiam acesso direto dos clientes)
- `firestore.indexes.json`: índices do Firestore

```bash
npm run firebase:login                               # só na primeira vez
npx firebase functions:secrets:set BLOB_READ_WRITE_TOKEN   # só na primeira vez
npm run deploy
```

O site fica em `https://beatgamesmanager.web.app`. O deploy não é automático: rode `npm run deploy` depois de mergear na `main`.

## Endpoints da API

Todos exigem o header `Authorization: Bearer <Firebase ID token>`.

Cada recurso tem `GET` (lista), `POST` (cria), `PUT /:id` (atualiza) e `DELETE /:id` (exclui):

- `/api/games`
- `/api/statuses`
- `/api/platforms` (multipart: `name`, `image` opcional enviada ao Vercel Blob, `removeImage=true` para remover)
- `/api/genres`
- `/api/types`
- `/api/scores` (o id é o próprio valor da nota; o valor não pode ser alterado)
- `/api/difficulties`

Exclusões de registros em uso retornam `409`. `POST /api/games/import` recebe `{ items, dryRun, indexes }`: com `dryRun: true` devolve a prévia; com `dryRun: false` grava as linhas de `indexes`. Também há `GET /api/search-games?q=...`, que busca jogos na API externa.

## Estrutura

- `/src/app.js`: app Express, middleware de autenticação e montagem das rotas
- `/src/routes/games.js`: CRUD de jogos (validação de referências)
- `/src/routes/catalog.js`: CRUD genérico dos cadastros (unicidade, referências, bloqueio de exclusão em uso, imagens)
- `/src/validation.js`: normalização e validação dos payloads
- `/src/repository.js`: acesso ao Firestore e criação dos valores padrão por usuário
- `/src/catalog.js`: status, escala de notas e dificuldades padrão
- `/src/firebase.js`: inicialização do Firebase Admin (Auth + Firestore)
- `/src/server.js`: bootstrap para execução local
- `/public/js`: frontend em módulos ES (`main.js` navegação, `datatable.js` componente de tabela, `catalog-views.js` cadastros, `games-view.js` jogos, `dashboard.js`, `suggestions.js`, `auth.js` login com Firebase)
- `/test`: testes automatizados
- `/firebase.json`, `/.firebaserc`, `/firestore.indexes.json`: configuração do Firebase CLI
- `/firestore.rules`: regras de segurança do Firestore
- `/src/functions.js`: entrada do Cloud Functions
- `/src/upload.js`: leitura de multipart (compatível com o `rawBody` do Cloud Functions)
