const express = require('express');
const { singleFileUpload } = require('../upload');
const { put, del } = require('@vercel/blob');
const { randomUUID } = require('node:crypto');
const repo = require('../repository');
const { HttpError, handle } = require('../http');
const {
  normalizeKey,
  parsePlatform,
  parseGenre,
  parseType,
  parseScore,
  parseDifficulty,
  parseStatus,
} = require('../validation');
const { PROTECTED_STATUS_IDS } = require('../catalog');


const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');

const DEFINITIONS = {
  statuses: {
    label: 'status',
    parse: parseStatus,
    uniqueField: 'name',
    uniqueMessage: 'Já existe um status com esse nome.',
    protectedIds: PROTECTED_STATUS_IDS,
    protectedMessage: 'Este status é usado pelos cards do dashboard e não pode ser excluído, mas você pode renomeá-lo.',
    dependents: [{ collection: 'games', field: 'status', noun: 'jogo(s)' }],
    sort: (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'),
  },
  platforms: {
    label: 'plataforma',
    parse: parsePlatform,
    uniqueField: 'name',
    uniqueMessage: 'Já existe uma plataforma com esse nome.',
    image: true,
    dependents: [{ collection: 'games', field: 'platformId', noun: 'jogo(s)' }],
    sort: byName,
  },
  genres: {
    label: 'gênero',
    parse: parseGenre,
    uniqueField: 'name',
    uniqueMessage: 'Já existe um gênero com esse nome.',
    dependents: [
      { collection: 'games', field: 'genreId', noun: 'jogo(s)' },
      { collection: 'types', field: 'genreId', noun: 'tipo(s)' },
    ],
    sort: byName,
  },
  types: {
    label: 'tipo',
    parse: parseType,
    uniqueField: 'name',
    uniqueMessage: 'Já existe um tipo com esse nome.',
    references: [{ field: 'genreId', collection: 'genres', message: 'Gênero não encontrado.' }],
    dependents: [{ collection: 'games', field: 'typeId', noun: 'jogo(s)' }],
    sort: byName,
  },
  scores: {
    label: 'nota',
    parse: parseScore,
    idFrom: (data) => String(data.value),
    immutableField: 'value',
    immutableMessage: 'O valor da nota não pode ser alterado. Crie uma nova nota e exclua a antiga.',
    uniqueField: 'value',
    uniqueMessage: 'Já existe uma nota com esse valor.',
    dependents: [{ collection: 'games', field: 'score', value: (record) => record.value, noun: 'jogo(s)' }],
    sort: (a, b) => b.value - a.value,
  },
  difficulties: {
    label: 'dificuldade',
    parse: parseDifficulty,
    uniqueField: 'key',
    uniqueMessage: 'Já existe uma dificuldade com essa chave.',
    dependents: [{ collection: 'games', field: 'difficultyId', noun: 'jogo(s)' }],
    sort: (a, b) => a.order - b.order || a.key.localeCompare(b.key),
  },
};

function parseBody(definition, body) {
  const { data, error } = definition.parse(body || {});
  if (error) {
    throw new HttpError(400, error);
  }
  return data;
}

async function assertUnique(userId, collection, definition, data, excludeId) {
  const key = normalizeKey(data[definition.uniqueField]);
  const records = await repo.listDocs(userId, collection);
  const duplicate = records.some(
    (record) => record.id !== excludeId && normalizeKey(record[definition.uniqueField]) === key
  );

  if (duplicate) {
    throw new HttpError(409, definition.uniqueMessage);
  }
}

async function assertReferences(userId, definition, data) {
  const references = (definition.references || []).filter((reference) => data[reference.field]);
  const found = await repo.getMany(
    userId,
    references.map((reference) => ({ name: reference.collection, id: data[reference.field] }))
  );

  references.forEach((reference) => {
    if (!found.get(`${reference.collection}/${data[reference.field]}`)) {
      throw new HttpError(400, reference.message);
    }
  });
}

async function uploadImage(file) {
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'O arquivo enviado precisa ser uma imagem.');
  }

  const blob = await put(`platforms/${file.originalname}`, file.buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.mimetype,
  });
  return blob.url;
}

async function deleteImage(url) {
  if (!url) {
    return;
  }

  try {
    await del(url);
  } catch (error) {
    console.error('Falha ao remover imagem do Blob:', error);
  }
}

function createCatalogRouter(collection) {
  const definition = DEFINITIONS[collection];
  const router = express.Router();
  const parseUpload = definition.image ? singleFileUpload('image') : (_req, _res, next) => next();
  const label = definition.label;

  router.get(
    '/',
    handle(`Erro ao listar ${label}s.`, async (req, res) => {
      const records = await repo.listDocs(req.user.uid, collection);
      res.json(records.sort(definition.sort));
    })
  );

  router.post(
    '/',
    parseUpload,
    handle(`Erro ao criar ${label}.`, async (req, res) => {
      const userId = req.user.uid;
      const data = parseBody(definition, req.body);

      await assertUnique(userId, collection, definition, data, null);
      await assertReferences(userId, definition, data);

      if (definition.image) {
        data.imageUrl = req.file ? await uploadImage(req.file) : null;
      }

      const now = new Date().toISOString();
      const id = definition.idFrom ? definition.idFrom(data) : randomUUID();
      const record = await repo.createDoc(userId, collection, id, { ...data, createdAt: now, updatedAt: now });
      res.status(201).json(record);
    })
  );

  router.put(
    '/:id',
    parseUpload,
    handle(`Erro ao atualizar ${label}.`, async (req, res) => {
      const userId = req.user.uid;
      const existing = await repo.getDoc(userId, collection, req.params.id);

      if (!existing) {
        throw new HttpError(404, 'Registro não encontrado.');
      }

      const data = parseBody(definition, req.body);

      if (definition.immutableField && data[definition.immutableField] !== existing[definition.immutableField]) {
        throw new HttpError(400, definition.immutableMessage);
      }

      await assertUnique(userId, collection, definition, data, existing.id);
      await assertReferences(userId, definition, data);

      let previousImage = null;
      if (definition.image) {
        if (req.file) {
          data.imageUrl = await uploadImage(req.file);
          previousImage = existing.imageUrl;
        } else if (req.body.removeImage === 'true') {
          data.imageUrl = null;
          previousImage = existing.imageUrl;
        }
      }

      const record = await repo.updateDoc(userId, collection, existing.id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      await deleteImage(previousImage);
      res.json(record);
    })
  );

  router.delete(
    '/:id',
    handle(`Erro ao excluir ${label}.`, async (req, res) => {
      const userId = req.user.uid;
      const existing = await repo.getDoc(userId, collection, req.params.id);

      if (!existing) {
        throw new HttpError(404, 'Registro não encontrado.');
      }

      if (definition.protectedIds?.includes(existing.id)) {
        throw new HttpError(409, definition.protectedMessage);
      }

      for (const dependent of definition.dependents) {
        const value = dependent.value ? dependent.value(existing) : existing.id;
        const count = await repo.countWhere(userId, dependent.collection, dependent.field, value);

        if (count > 0) {
          throw new HttpError(409, `Não é possível excluir: em uso por ${count} ${dependent.noun}.`);
        }
      }

      await repo.deleteDoc(userId, collection, existing.id);

      if (definition.image) {
        await deleteImage(existing.imageUrl);
      }

      res.status(204).send();
    })
  );

  return router;
}

module.exports = { createCatalogRouter, CATALOG_COLLECTIONS: Object.keys(DEFINITIONS) };
