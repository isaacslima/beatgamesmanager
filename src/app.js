const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
const { auth } = require('./firebase');
const { ensureUserDefaults } = require('./repository');
const { handle, HttpError } = require('./http');
const { createCatalogRouter, CATALOG_COLLECTIONS } = require('./routes/catalog');
const gamesRouter = require('./routes/games');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

async function requireAuth(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');

  if (!match) {
    return res.status(401).json({ message: 'Autenticação necessária.' });
  }

  try {
    req.user = await auth.verifyIdToken(match[1]);
  } catch (_error) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  try {
    await ensureUserDefaults(req.user.uid);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao preparar os dados do usuário.' });
  }

  return next();
}

app.use('/api', requireAuth);

app.use('/api/games', gamesRouter);

CATALOG_COLLECTIONS.forEach((collection) => {
  app.use(`/api/${collection}`, createCatalogRouter(collection));
});

app.get(
  '/api/search-games',
  handle('Erro ao conectar com a API de jogos.', async (req, res) => {
    const query = String(req.query.q || '').trim();

    if (!query) {
      throw new HttpError(400, 'Informe um termo para pesquisa.');
    }

    const response = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(query)}&limit=10`, {
      headers: { 'User-Agent': 'BeatGamesManager/1.0 (contato@iasolutions.tec.br)' },
    });

    if (!response.ok) {
      throw new HttpError(502, 'Não foi possível consultar a API de jogos.');
    }

    const data = await response.json();
    res.json(
      data.map((item) => ({
        id: item.gameID,
        title: item.external,
        thumb: item.thumb,
        steamAppID: item.steamAppID,
        cheapestPriceEver: item.cheapest,
      }))
    );
  })
);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
