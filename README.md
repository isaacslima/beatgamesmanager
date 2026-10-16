# Beat Games Manager

Gerenciador de biblioteca de jogos: lista de desejo, planejados, zerados e dropados.
A especificação completa está em [`docs/especifica_o_de_features_beat_games.md`](docs/especifica_o_de_features_beat_games.md).

## Funcionalidades

- **Dashboard**: cards de totais (jogos, plataformas, zerados, lista de desejo), gráficos por nota (11 a 1), por dificuldade (C a AAA), top plataformas e lista dos jogos GOTY.
- **Jogos**: DataTable com busca, filtros (plataforma, gênero, status, período e GOTY), ordenação por coluna e paginação.
- **Cadastros** com CRUD e DataTable próprios: Plataformas (com imagem), Gêneros, Tipos (subcategoria opcional de um gênero), Notas / Avaliações (escala de 1 a 11) e Níveis de Dificuldade.
- **Campos do jogo**: nome, plataforma, gênero, tipo, status, data de início e término (opcionais), tempo total (`HH:MM:SS`, `HH:MM` ou horas decimais), nota, dificuldade, condição de zeramento, destaque/GOTY e observações.
- **Condição de zeramento com sugestões**: ao focar ou digitar no campo, o sistema sugere condições já usadas no seu histórico, priorizando jogos do mesmo tipo, gênero e plataforma, além de exemplos padrão.
- **Integridade**: não é possível excluir plataforma, gênero, tipo, nota ou dificuldade em uso por algum jogo.
- No primeiro acesso, cada usuário recebe a escala de notas (11 - Jogo da vida até 1 - Tragédia) e as dificuldades (C/Fácil até AAA/Imperdoável) já cadastradas. Elas são editáveis.
- Busca opcional do nome do jogo na API externa (CheapShark), direto no formulário.

## Stack atual

- Backend: Node.js + Express (serverless na Vercel)
- Autenticação: Firebase Authentication (Google e e-mail/senha)
- Banco: Cloud Firestore (acessado pelo backend via `firebase-admin`)
- Imagens das plataformas: Vercel Blob
- Hosting: Vercel
- Frontend: HTML/CSS/JS estático

Cada usuário tem seus próprios dados no Firestore:

```
users/{uid}                       { defaultsSeededAt }
users/{uid}/games/{gameId}        title, platformId, genreId, typeId, status, startDate, endDate,
                                  playTimeSeconds, score, difficultyId, completionCondition, isGoty, notes
users/{uid}/platforms/{id}        name, imageUrl
users/{uid}/genres/{id}           name, description
users/{uid}/types/{id}            name, genreId (opcional), description
users/{uid}/scores/{valor}        value (1–11), label, description
users/{uid}/difficulties/{id}     key (C…AAA), label, order, description
```

Status do jogo: `wishlist` (Lista de Desejo), `planned` (Planejado para Jogar), `completed` (Zerado) e `dropped` (Dropado).

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

> A configuração web do Firebase (apiKey etc.) fica em `public/js/auth.js`. Ela é pública por natureza; a segurança vem das regras do Firestore e da verificação do token no backend.

## Instalação e execução local

```bash
npm install
npm start
```

A aplicação fica disponível em `http://localhost:3000`.

## Scripts

- `npm start`: inicia servidor local
- `npm run dev`: inicia servidor local com watch
- `npm test`: executa os testes (`node --test`): validações do backend e ranking de sugestões
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

Cada recurso tem `GET` (lista), `POST` (cria), `PUT /:id` (atualiza) e `DELETE /:id` (exclui):

- `/api/games`
- `/api/platforms` (multipart: `name`, `image` opcional enviada ao Vercel Blob, `removeImage=true` para remover)
- `/api/genres`
- `/api/types`
- `/api/scores` (o id é o próprio valor da nota; o valor não pode ser alterado)
- `/api/difficulties`

Exclusões de registros em uso retornam `409`. Também há `GET /api/search-games?q=...`, que busca jogos na API externa.

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
- `/api/index.js`: entrada serverless para Vercel
- `/vercel.json`: roteamento para deploy na Vercel
