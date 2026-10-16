// Acesso ao Firestore direto do navegador. As regras (firestore.rules) garantem que cada usuário
// só acessa users/{uid} e que os documentos têm o formato certo; aqui ficam as checagens que as
// regras não conseguem fazer (nome duplicado, referências e exclusão de registros em uso).
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  where,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { app, currentUserId } from './auth.js';
import { deleteImage, uploadImage } from './images.js';
import { DEFAULT_DIFFICULTIES, DEFAULT_SCORES, DEFAULT_STATUSES, PROTECTED_STATUS_IDS } from './shared/catalog.js';
import { buildImportWrites, planImport, summarize } from './shared/importer.js';
import {
  normalizeKey,
  parseDifficulty,
  parseGame,
  parseGenre,
  parsePlatform,
  parseScore,
  parseStatus,
  parseTag,
  parseType,
} from './shared/validation.js';

const db = getFirestore(app);

const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');

const DEFINITIONS = {
  tags: {
    parse: parseTag,
    uniqueField: 'name',
    uniqueMessage: 'Já existe uma tag com esse nome.',
    // Excluir uma tag a retira dos jogos (não bloqueia).
    detachFrom: { collection: 'games', field: 'tagIds' },
    dependents: [],
    sort: byName,
  },
  statuses: {
    parse: parseStatus,
    uniqueField: 'name',
    uniqueMessage: 'Já existe um status com esse nome.',
    protectedIds: PROTECTED_STATUS_IDS,
    protectedMessage: 'Este status é usado pelos cards do dashboard e não pode ser excluído, mas você pode renomeá-lo.',
    dependents: [{ collection: 'games', field: 'status', noun: 'jogo(s)' }],
    sort: (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'),
  },
  platforms: {
    parse: parsePlatform,
    uniqueField: 'name',
    uniqueMessage: 'Já existe uma plataforma com esse nome.',
    image: true,
    dependents: [{ collection: 'games', field: 'platformId', noun: 'jogo(s)' }],
    sort: byName,
  },
  genres: {
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
    parse: parseType,
    uniqueField: 'name',
    uniqueMessage: 'Já existe um tipo com esse nome.',
    references: [{ field: 'genreId', collection: 'genres', message: 'Gênero não encontrado.' }],
    dependents: [{ collection: 'games', field: 'typeId', noun: 'jogo(s)' }],
    sort: byName,
  },
  scores: {
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
    parse: parseDifficulty,
    uniqueField: 'key',
    uniqueMessage: 'Já existe uma dificuldade com essa chave.',
    dependents: [{ collection: 'games', field: 'difficultyId', noun: 'jogo(s)' }],
    sort: (a, b) => a.order - b.order || a.key.localeCompare(b.key),
  },
};

const GAME_REFERENCES = [
  { field: 'status', collection: 'statuses', message: 'Status não encontrado.' },
  { field: 'platformId', collection: 'platforms', message: 'Plataforma não encontrada.' },
  { field: 'genreId', collection: 'genres', message: 'Gênero não encontrado.' },
  { field: 'typeId', collection: 'types', message: 'Tipo não encontrado.' },
  { field: 'difficultyId', collection: 'difficulties', message: 'Dificuldade não encontrada.' },
  { field: 'score', collection: 'scores', message: 'Nota não cadastrada na tabela de notas.' },
];

function userRef() {
  return doc(db, 'users', currentUserId());
}

function col(name) {
  return collection(db, 'users', currentUserId(), name);
}

function toRecord(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function now() {
  return new Date().toISOString();
}

// Traduz erros do Firestore para mensagens legíveis.
async function guard(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error?.code === 'permission-denied') {
      throw new Error('O Firestore recusou a operação (dados fora do formato permitido ou sem permissão).');
    }
    if (error?.code === 'unavailable') {
      throw new Error('Sem conexão com o Firestore. Verifique sua internet e tente novamente.');
    }
    throw error;
  }
}

function parseOrThrow(parse, values) {
  const { data, error } = parse(values || {});
  if (error) {
    throw new Error(error);
  }
  return data;
}

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
    tagIds: Array.isArray(record.tagIds) ? record.tagIds : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function listRaw(name) {
  const snapshot = await guard(getDocs(col(name)));
  return snapshot.docs.map(toRecord);
}

export async function list(name) {
  const records = await listRaw(name);

  if (name === 'games') {
    return records.map(toGame).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  return records.sort(DEFINITIONS[name].sort);
}

async function findReferences(references, data) {
  const used = references.filter((reference) => data[reference.field] !== null && data[reference.field] !== undefined);
  const snapshots = await guard(
    Promise.all(used.map((reference) => getDoc(doc(col(reference.collection), String(data[reference.field])))))
  );

  const found = new Map();
  used.forEach((reference, index) => {
    if (!snapshots[index].exists()) {
      throw new Error(reference.message);
    }
    found.set(reference.collection, toRecord(snapshots[index]));
  });
  return found;
}

// ---------- Cadastros ----------

export async function saveCatalog(name, values, existing = null) {
  const definition = DEFINITIONS[name];
  const data = parseOrThrow(definition.parse, values);

  if (existing && definition.immutableField && data[definition.immutableField] !== existing[definition.immutableField]) {
    throw new Error(definition.immutableMessage);
  }

  const key = normalizeKey(data[definition.uniqueField]);
  const others = await listRaw(name);
  if (others.some((record) => record.id !== existing?.id && normalizeKey(record[definition.uniqueField]) === key)) {
    throw new Error(definition.uniqueMessage);
  }

  await findReferences(definition.references || [], data);

  let previousImage = null;
  if (definition.image) {
    if (values.image) {
      data.imageUrl = await uploadImage(values.image);
      previousImage = existing?.imageUrl ?? null;
    } else if (existing && values.removeImage) {
      data.imageUrl = null;
      previousImage = existing.imageUrl ?? null;
    } else {
      data.imageUrl = existing?.imageUrl ?? null;
    }
  }

  const timestamp = now();
  let record;

  if (existing) {
    await guard(updateDoc(doc(col(name), existing.id), { ...data, updatedAt: timestamp }));
    record = { ...existing, ...data, updatedAt: timestamp };
  } else {
    const id = definition.idFrom ? definition.idFrom(data) : crypto.randomUUID();
    const fields = { ...data, createdAt: timestamp, updatedAt: timestamp };
    await guard(setDoc(doc(col(name), id), fields));
    record = { id, ...fields };
  }

  await deleteImage(previousImage);
  return record;
}

async function detachEverywhere({ collection: name, field }, id) {
  const snapshot = await guard(getDocs(query(col(name), where(field, 'array-contains', id))));
  const timestamp = now();

  for (let start = 0; start < snapshot.docs.length; start += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + 450).forEach((item) => {
      batch.update(item.ref, { [field]: arrayRemove(id), updatedAt: timestamp });
    });
    await guard(batch.commit());
  }
}

export async function removeCatalog(name, record) {
  const definition = DEFINITIONS[name];

  if (definition.protectedIds?.includes(record.id)) {
    throw new Error(definition.protectedMessage);
  }

  for (const dependent of definition.dependents) {
    const value = dependent.value ? dependent.value(record) : record.id;
    const snapshot = await guard(getCountFromServer(query(col(dependent.collection), where(dependent.field, '==', value))));
    const count = snapshot.data().count;

    if (count > 0) {
      throw new Error(`Não é possível excluir: em uso por ${count} ${dependent.noun}.`);
    }
  }

  if (definition.detachFrom) {
    await detachEverywhere(definition.detachFrom, record.id);
  }

  await guard(deleteDoc(doc(col(name), record.id)));

  if (definition.image) {
    await deleteImage(record.imageUrl);
  }
}

// ---------- Jogos ----------

async function assertTagsExist(tagIds) {
  const snapshots = await guard(Promise.all(tagIds.map((id) => getDoc(doc(col('tags'), id)))));
  if (snapshots.some((snapshot) => !snapshot.exists())) {
    throw new Error('Tag não encontrada.');
  }
}

export async function saveGame(values, existing = null) {
  const data = parseOrThrow(parseGame, values);
  const found = await findReferences(GAME_REFERENCES, data);

  await assertTagsExist(data.tagIds);

  const type = found.get('types');
  if (type?.genreId) {
    if (data.genreId && data.genreId !== type.genreId) {
      throw new Error('O tipo selecionado pertence a outro gênero.');
    }
    data.genreId = type.genreId;
  }

  const timestamp = now();
  const id = existing?.id ?? crypto.randomUUID();
  // set (e não update) para descartar campos do formato antigo.
  const fields = { ...data, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
  await guard(setDoc(doc(col('games'), id), fields));
  return toGame({ id, ...fields });
}

export async function removeGame(id) {
  await guard(deleteDoc(doc(col('games'), id)));
}

// ---------- Importação ----------

async function loadImportCatalogs() {
  const names = ['statuses', 'platforms', 'genres', 'types', 'tags', 'scores', 'difficulties', 'games'];
  const results = await Promise.all(names.map((name) => listRaw(name)));
  const catalogs = Object.fromEntries(names.map((name, index) => [name, results[index]]));
  catalogs.games = catalogs.games.map(toGame);
  return catalogs;
}

async function planOrThrow(items) {
  const plan = planImport(items, await loadImportCatalogs());
  if (plan.error) {
    throw new Error(plan.error);
  }
  return plan;
}

export async function previewImport(items) {
  const plan = await planOrThrow(items);
  return { summary: summarize(plan), rows: plan.rows };
}

// Recalcula o plano na hora de gravar (os dados podem ter mudado desde a prévia).
export async function runImport(items, indexes) {
  const plan = await planOrThrow(items);
  const { writes, counts } = buildImportWrites(plan, new Set(indexes));

  if (!counts.games) {
    throw new Error('Nenhum jogo válido selecionado para importar.');
  }

  for (let start = 0; start < writes.length; start += 450) {
    const batch = writeBatch(db);
    writes.slice(start, start + 450).forEach((write) => batch.set(doc(col(write.name), write.id), write.data));
    await guard(batch.commit());
  }

  return counts;
}

// ---------- Valores padrão ----------

// Cada versão adiciona valores padrão; usuários antigos recebem só o que falta, sem sobrescrever.
const DEFAULTS_VERSION = 2;

function defaultsFor(version) {
  if (version === 1) {
    return [
      ...DEFAULT_SCORES.map((score) => ({ name: 'scores', id: String(score.value), data: score })),
      ...DEFAULT_DIFFICULTIES.map(({ id, ...difficulty }) => ({ name: 'difficulties', id, data: difficulty })),
    ];
  }

  if (version === 2) {
    return DEFAULT_STATUSES.map(({ id, ...status }) => ({ name: 'statuses', id, data: status }));
  }

  return [];
}

export async function ensureUserDefaults() {
  await guard(
    runTransaction(db, async (transaction) => {
      const ref = userRef();
      const snapshot = await transaction.get(ref);
      const user = snapshot.exists() ? snapshot.data() : {};
      const currentVersion = user.defaultsVersion || (user.defaultsSeededAt ? 1 : 0);

      if (currentVersion >= DEFAULTS_VERSION) {
        return;
      }

      const pending = [];
      for (let version = currentVersion + 1; version <= DEFAULTS_VERSION; version += 1) {
        pending.push(...defaultsFor(version));
      }

      const existing = await Promise.all(pending.map((item) => transaction.get(doc(col(item.name), item.id))));
      const timestamp = now();

      pending.forEach((item, index) => {
        if (!existing[index].exists()) {
          transaction.set(doc(col(item.name), item.id), {
            ...item.data,
            description: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      });

      transaction.set(ref, { defaultsVersion: DEFAULTS_VERSION, defaultsSeededAt: timestamp }, { merge: true });
    })
  );
}
