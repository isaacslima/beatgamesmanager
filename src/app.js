const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { initDatabase, listGames, createGame, updateGame, deleteGame } = require('./db');

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

let startupError = null;
const startupPromise = initDatabase().catch((error) => {
  startupError = error;
});

app.use(async (_req, res, next) => {
  try {
    await startupPromise;
    if (startupError) {
      return res.status(500).json({ message: 'Erro ao inicializar banco de dados.' });
    }
    next();
  } catch (_error) {
    res.status(500).json({ message: 'Erro ao inicializar banco de dados.' });
  }
});

function normalizePayload(payload) {
  return {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    platform: typeof payload.platform === 'string' ? payload.platform.trim() : '',
    emulatorName: typeof payload.emulatorName === 'string' ? payload.emulatorName.trim() : '',
    totalPlayTimeHours:
      payload.totalPlayTimeHours === '' || payload.totalPlayTimeHours === null || payload.totalPlayTimeHours === undefined
        ? null
        : Number(payload.totalPlayTimeHours),
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

  if (payload.platform === 'PC com emulador' && !payload.emulatorName) {
    return 'Informe o nome do emulador quando a plataforma for PC com emulador.';
  }

  if (payload.totalPlayTimeHours !== null) {
    if (Number.isNaN(payload.totalPlayTimeHours) || payload.totalPlayTimeHours < 0) {
      return 'O tempo total jogado deve ser um número maior ou igual a zero.';
    }
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

  if (payload.platform !== 'PC com emulador') {
    payload.emulatorName = '';
  }

  return null;
}

app.get('/api/games', async (_req, res) => {
  try {
    const games = await listGames();
    res.json(games);
  } catch (_error) {
    res.status(500).json({ message: 'Erro ao listar jogos.' });
  }
});

app.post('/api/games', async (req, res) => {
  const payload = normalizePayload(req.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const now = new Date().toISOString();
    const game = await createGame({
      id: randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json(game);
  } catch (_error) {
    return res.status(500).json({ message: 'Erro ao criar jogo.' });
  }
});

app.put('/api/games/:id', async (req, res) => {
  const payload = normalizePayload(req.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const game = await updateGame(req.params.id, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });

    if (!game) {
      return res.status(404).json({ message: 'Jogo não encontrado.' });
    }

    return res.json(game);
  } catch (_error) {
    return res.status(500).json({ message: 'Erro ao atualizar jogo.' });
  }
});

app.delete('/api/games/:id', async (req, res) => {
  try {
    const removed = await deleteGame(req.params.id);

    if (!removed) {
      return res.status(404).json({ message: 'Jogo não encontrado.' });
    }

    return res.status(204).send();
  } catch (_error) {
    return res.status(500).json({ message: 'Erro ao excluir jogo.' });
  }
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

module.exports = app;
