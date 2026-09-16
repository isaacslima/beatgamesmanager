const express = require('express');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'games.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
}

function readGames() {
  ensureDataStore();
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveGames(games) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2), 'utf-8');
}

function normalizePayload(payload) {
  return {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    startDate: typeof payload.startDate === 'string' ? payload.startDate : null,
    endDate: typeof payload.endDate === 'string' ? payload.endDate : null,
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
    rating: payload.rating === '' || payload.rating === null || payload.rating === undefined
      ? null
      : Number(payload.rating),
  };
}

function validatePayload(payload) {
  if (!payload.name) {
    return 'O nome do jogo é obrigatório.';
  }

  if (payload.rating !== null) {
    if (Number.isNaN(payload.rating) || payload.rating < 0 || payload.rating > 10) {
      return 'A nota deve estar entre 0 e 10.';
    }
  }

  if (payload.startDate && Number.isNaN(Date.parse(payload.startDate))) {
    return 'A data de início é inválida.';
  }

  if (payload.endDate && Number.isNaN(Date.parse(payload.endDate))) {
    return 'A data de término é inválida.';
  }

  return null;
}

app.get('/api/games', (_req, res) => {
  const games = readGames();
  res.json(games);
});

app.post('/api/games', (req, res) => {
  const payload = normalizePayload(req.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const games = readGames();
  const game = {
    id: randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  games.push(game);
  saveGames(games);

  return res.status(201).json(game);
});

app.put('/api/games/:id', (req, res) => {
  const payload = normalizePayload(req.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const games = readGames();
  const index = games.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Jogo não encontrado.' });
  }

  games[index] = {
    ...games[index],
    ...payload,
    updatedAt: new Date().toISOString(),
  };

  saveGames(games);
  return res.json(games[index]);
});

app.delete('/api/games/:id', (req, res) => {
  const games = readGames();
  const filtered = games.filter((item) => item.id !== req.params.id);

  if (filtered.length === games.length) {
    return res.status(404).json({ message: 'Jogo não encontrado.' });
  }

  saveGames(filtered);
  return res.status(204).send();
});

app.get('/api/search-games', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ message: 'Informe um termo para pesquisa.' });
  }

  try {
    const response = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(query)}&limit=10`);

    if (!response.ok) {
      return res.status(502).json({ message: 'Não foi possível consultar a API de jogos.' });
    }

    const data = await response.json();
    const result = data.map((item) => ({
      id: item.gameID,
      title: item.external,
      thumb: item.thumb,
      steamAppID: item.steamAppID,
      cheapestPriceEver: item.cheapest,
    }));

    return res.json(result);
  } catch (_error) {
    return res.status(502).json({ message: 'Erro ao conectar com a API de jogos.' });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

ensureDataStore();

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
