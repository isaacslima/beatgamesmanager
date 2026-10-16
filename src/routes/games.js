const express = require('express');
const { randomUUID } = require('node:crypto');
const repo = require('../repository');
const { HttpError, handle } = require('../http');
const { parseGame } = require('../validation');
const { planImport, summarize, buildImportWrites } = require('../importer');

const REFERENCES = [
  { field: 'status', collection: 'statuses', message: 'Status não encontrado.' },
  { field: 'platformId', collection: 'platforms', message: 'Plataforma não encontrada.' },
  { field: 'genreId', collection: 'genres', message: 'Gênero não encontrado.' },
  { field: 'typeId', collection: 'types', message: 'Tipo não encontrado.' },
  { field: 'difficultyId', collection: 'difficulties', message: 'Dificuldade não encontrada.' },
  { field: 'score', collection: 'scores', message: 'Nota não cadastrada na tabela de notas.' },
];

function legacyPlayTime(record) {
  return typeof record.totalPlayTimeHours === 'number' ? Math.round(record.totalPlayTimeHours * 3600) : null;
}

function toGame(record) {
  return {
    id: record.id,
    title: record.title ?? record.name ?? '',
    platformId: record.platformId ?? null,
    genreId: record.genreId ?? null,
    typeId: record.typeId ?? null,
    status: record.status || 'planned',
    startDate: record.startDate ?? null,
    endDate: record.endDate ?? null,
    playTimeSeconds: record.playTimeSeconds ?? legacyPlayTime(record),
    score: record.score ?? null,
    difficultyId: record.difficultyId ?? null,
    completionCondition: record.completionCondition ?? '',
    isGoty: record.isGoty === true,
    notes: record.notes ?? '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseBody(body) {
  const { data, error } = parseGame(body || {});
  if (error) {
    throw new HttpError(400, error);
  }
  return data;
}

async function assertReferences(userId, data) {
  const references = REFERENCES.filter((reference) => data[reference.field] !== null);
  const found = await repo.getMany(
    userId,
    references.map((reference) => ({ name: reference.collection, id: String(data[reference.field]) }))
  );

  references.forEach((reference) => {
    if (!found.get(`${reference.collection}/${data[reference.field]}`)) {
      throw new HttpError(400, reference.message);
    }
  });

  const type = data.typeId ? found.get(`types/${data.typeId}`) : null;
  if (type?.genreId) {
    if (data.genreId && data.genreId !== type.genreId) {
      throw new HttpError(400, 'O tipo selecionado pertence a outro gênero.');
    }
    data.genreId = type.genreId;
  }
}

async function loadImportCatalogs(userId) {
  const names = ['statuses', 'platforms', 'genres', 'types', 'scores', 'difficulties', 'games'];
  const results = await Promise.all(names.map((name) => repo.listDocs(userId, name)));
  const catalogs = Object.fromEntries(names.map((name, index) => [name, results[index]]));
  catalogs.games = catalogs.games.map(toGame);
  return catalogs;
}

const router = express.Router();

// dryRun=true devolve a prévia; dryRun=false grava as linhas em "indexes" (ou as válidas e não duplicadas).
router.post(
  '/import',
  handle('Erro ao importar jogos.', async (req, res) => {
    const { items, dryRun = true, indexes } = req.body || {};
    const plan = planImport(items, await loadImportCatalogs(req.user.uid));

    if (plan.error) {
      throw new HttpError(400, plan.error);
    }

    if (dryRun) {
      return res.json({
        summary: summarize(plan),
        rows: plan.rows.map(({ data: _data, ...row }) => row),
      });
    }

    const selected = new Set(
      Array.isArray(indexes)
        ? indexes.map(Number)
        : plan.rows.filter((row) => row.valid && !row.duplicate).map((row) => row.index)
    );
    const { writes, counts } = buildImportWrites(plan, selected);

    if (!counts.games) {
      throw new HttpError(400, 'Nenhum jogo válido selecionado para importar.');
    }

    await repo.createMany(req.user.uid, writes);
    return res.status(201).json(counts);
  })
);

router.get(
  '/',
  handle('Erro ao listar jogos.', async (req, res) => {
    const records = await repo.listDocs(req.user.uid, 'games');
    const games = records.map(toGame).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(games);
  })
);

router.post(
  '/',
  handle('Erro ao criar jogo.', async (req, res) => {
    const data = parseBody(req.body);
    await assertReferences(req.user.uid, data);

    const now = new Date().toISOString();
    const record = await repo.createDoc(req.user.uid, 'games', randomUUID(), {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(toGame(record));
  })
);

router.put(
  '/:id',
  handle('Erro ao atualizar jogo.', async (req, res) => {
    const existing = await repo.getDoc(req.user.uid, 'games', req.params.id);

    if (!existing) {
      throw new HttpError(404, 'Jogo não encontrado.');
    }

    const data = parseBody(req.body);
    await assertReferences(req.user.uid, data);

    // set (e não update) para descartar campos do formato antigo.
    const record = await repo.setDoc(req.user.uid, 'games', existing.id, {
      ...data,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.json(toGame(record));
  })
);

router.delete(
  '/:id',
  handle('Erro ao excluir jogo.', async (req, res) => {
    const removed = await repo.deleteDoc(req.user.uid, 'games', req.params.id);

    if (!removed) {
      throw new HttpError(404, 'Jogo não encontrado.');
    }

    res.status(204).send();
  })
);

module.exports = router;
