# Beat Games Manager

Gerenciador de biblioteca de jogos: lista de desejo, planejados, zerados e dropados.
A especificação completa está em [`docs/especifica_o_de_features_beat_games.md`](docs/especifica_o_de_features_beat_games.md).

## Funcionalidades

- **Dashboard**: cards de totais (jogos, plataformas, zerados, lista de desejo), gráficos por nota (11 a 1), por dificuldade (C a AAA), top plataformas e lista dos jogos GOTY.
- **Jogos**: DataTable com busca, filtros (plataforma, gênero, status, período e GOTY), ordenação por coluna e paginação.
- **Cadastros** com CRUD e DataTable próprios: Status (nome, cor e ordem editáveis), Plataformas (com imagem), Gêneros, Tipos (subcategoria opcional de um gênero), Notas / Avaliações (escala de 1 a 11) e Níveis de Dificuldade.
- **Campos do jogo**: nome, plataforma, gênero, tipo, status, data de início e término (opcionais), tempo total (`HH:MM:SS`, `HH:MM` ou horas decimais), nota, dificuldade, condição de zeramento, destaque/GOTY e observações.
- **Condição de zeramento com sugestões**: ao focar ou digitar no campo, o sistema sugere condições já usadas no seu histórico, priorizando jogos do mesmo tipo, gênero e plataforma, além de exemplos padrão.
- **Integridade**: não é possível excluir status, plataforma, gênero, tipo, nota ou dificuldade em uso por algum jogo.
- **Importação via JSON** (Jogos > Importar JSON): baixe o exemplo, selecione o arquivo e confira a prévia linha a linha (erros, possíveis duplicados e cadastros que serão criados) antes de confirmar. Plataformas, gêneros e tipos são informados pelo nome e criados se não existirem; status, dificuldade e nota precisam já estar cadastrados.
- No primeiro acesso, cada usuário recebe os status (Lista de Desejo, Planejado para Jogar, Zerado, Dropado), a escala de notas (11 - Jogo da vida até 1 - Tragédia) e as dificuldades (C/Fácil até AAA/Imperdoável). Tudo é editável; "Lista de Desejo" e "Zerado" podem ser renomeados, mas não excluídos, porque alimentam os cards do dashboard.
- **Dados por usuário**: cada conta tem os próprios jogos e cadastros em `users/{uid}`; as regras do Firestore impedem qualquer acesso aos dados de outra conta.

## Arquitetura

O app não tem servidor próprio: o navegador fala direto com o Firebase, e só o upload de imagens passa por uma função na Vercel.

```
Navegador (Firebase Hosting: beatgamesmanager.web.app)
 ├─ Firebase Authentication ........ login (Google e e-mail/senha)
 ├─ Cloud Firestore ................ dados, protegidos por firestore.rules
 └─ Vercel: /api/upload ............ envia/remove imagens no Vercel Blob (token secreto)
```

- **Hosting**: Firebase Hosting serve `public/`. Funciona no plano gratuito (Spark).
- **Banco**: Cloud Firestore, acessado com o SDK web. As **regras** (`firestore.rules`) garantem o isolamento por usuário e o formato de cada documento (campos permitidos, tipos, tamanhos, nota de 1 a 11, datas, cores de status, status fixos não excluíveis).
- **Validações do app** (`public/js/data.js` e `public/js/shared/`): checagens que precisam de consultas e que as regras não conseguem fazer, como nome duplicado, referências existentes e "não excluir se estiver em uso".
- **Imagens**: `api/upload.js` é uma função serverless na Vercel. Ela exige o token de login do Firebase, grava em `platforms/{uid}/...` no Vercel Blob e só remove imagens do próprio usuário. Os demais caminhos do domínio da Vercel redirecionam para o Firebase Hosting.

Estrutura no Firestore:

```
users/{uid}                       defaultsVersion, defaultsSeededAt
users/{uid}/games/{gameId}        title, platformId, genreId, typeId, status, startDate, endDate,
                                  playTimeSeconds, score, difficultyId, completionCondition, isGoty, notes
users/{uid}/statuses/{id}         name, color, order, description
users/{uid}/platforms/{id}        name, imageUrl
users/{uid}/genres/{id}           name, description
users/{uid}/types/{id}            name, genreId (opcional), description
users/{uid}/scores/{valor}        value (1–11), label, description
users/{uid}/difficulties/{id}     key (C…AAA), label, order, description
```

O campo `status` do jogo guarda o id de um registro em `statuses` (os padrões usam os ids `wishlist`, `planned`, `completed` e `dropped`). Todos os documentos têm `createdAt` e `updatedAt` (ISO 8601).

## Configuração

### Firebase

1. No [console do Firebase](https://console.firebase.google.com/project/beatgamesmanager), abra **Authentication > Sign-in method** e habilite **Google** e **E-mail/senha**.
2. Em **Authentication > Settings > Authorized domains**, confirme `beatgamesmanager.web.app` e `beatgamesmanager.firebaseapp.com` (vêm por padrão) e `localhost`.
3. A configuração web do Firebase (apiKey etc.) fica em `public/js/auth.js`. Ela é pública por natureza; a segurança vem das regras do Firestore.

### Vercel (só o upload de imagens)

- O projeto da Vercel precisa apenas da variável `BLOB_READ_WRITE_TOKEN`, criada automaticamente ao conectar o Blob store.
- O deploy da função acontece a cada push na `main` (integração Git da Vercel). Se o domínio da Vercel mudar, atualize `UPLOAD_URL` em `public/js/images.js`.
- As origens permitidas (CORS) ficam em `api/upload.js`.

### Local (`.env.local`)

| Variável | Uso |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Upload de imagens no `npm run dev` (Vercel > Storage > seu Blob store > `.env.local`) |

O arquivo `.env.local` é ignorado pelo git.

## Desenvolvimento

```bash
npm install
npm run dev     # http://localhost:3000: frontend + /api/upload local, usando o Firestore real
```

## Scripts

- `npm start` / `npm run dev`: servidor local (com watch no `dev`)
- `npm test`: testes automatizados (validação, importação e sugestões)
- `npm run test:rules`: testa as regras do Firestore no emulador (requer Java)
- `npm run emulators`: emulador do Hosting
- `npm run firebase:login`: autentica o Firebase CLI (uma vez por máquina)
- `npm run deploy`: publica no Firebase o Hosting e as regras/índices do Firestore
- `npm run deploy:hosting`: publica só o frontend

## Deploy

```bash
npm run firebase:login   # só na primeira vez
npm run deploy           # Firebase Hosting + regras do Firestore
```

O site fica em `https://beatgamesmanager.web.app`. A função de upload na Vercel é publicada automaticamente a cada push na `main`.

## Estrutura

- `/public`: frontend (Firebase Hosting)
  - `js/main.js`: navegação e login
  - `js/data.js`: acesso ao Firestore (CRUDs, importação, valores padrão)
  - `js/images.js`: cliente da função de upload
  - `js/shared/`: validação, importador e constantes (também usados nos testes)
  - `js/datatable.js`, `js/catalog-views.js`, `js/games-view.js`, `js/import-view.js`, `js/dashboard.js`, `js/suggestions.js`: telas e componentes
- `/api/upload.js`: função serverless da Vercel (imagens no Blob)
- `/server/verify-token.js`: verificação do token do Firebase usada pela função
- `/server/dev.js`: servidor de desenvolvimento
- `/firestore.rules`, `/firestore.indexes.json`, `/firebase.json`, `/.firebaserc`: configuração do Firebase
- `/vercel.json`: redireciona tudo que não é `/api` para o Firebase Hosting
- `/test`: testes unitários; `/rules-tests`: testes das regras (emulador)
