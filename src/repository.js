const { firestore } = require('./firebase');
const { DEFAULT_SCORES, DEFAULT_DIFFICULTIES, DEFAULT_STATUSES } = require('./catalog');

function userDoc(userId) {
  return firestore.collection('users').doc(userId);
}

function collection(userId, name) {
  return userDoc(userId).collection(name);
}

function toRecord(doc) {
  return { id: doc.id, ...doc.data() };
}

async function listDocs(userId, name) {
  const snapshot = await collection(userId, name).get();
  return snapshot.docs.map(toRecord);
}

async function getDoc(userId, name, id) {
  const doc = await collection(userId, name).doc(id).get();
  return doc.exists ? toRecord(doc) : null;
}

async function createDoc(userId, name, id, data) {
  const ref = collection(userId, name).doc(id);
  await ref.create(data);
  return toRecord(await ref.get());
}

async function setDoc(userId, name, id, data) {
  const ref = collection(userId, name).doc(id);
  await ref.set(data);
  return toRecord(await ref.get());
}

async function updateDoc(userId, name, id, data) {
  const ref = collection(userId, name).doc(id);

  try {
    await ref.update(data);
  } catch (error) {
    // 5 = NOT_FOUND
    if (error.code === 5) {
      return null;
    }
    throw error;
  }

  return toRecord(await ref.get());
}

async function deleteDoc(userId, name, id) {
  const ref = collection(userId, name).doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    return null;
  }

  await ref.delete();
  return toRecord(doc);
}

async function countWhere(userId, name, field, value) {
  const snapshot = await collection(userId, name).where(field, '==', value).count().get();
  return snapshot.data().count;
}

// Busca vários documentos de uma vez. refs: [{ name, id }] -> Map("name/id" -> registro | null)
async function getMany(userId, refs) {
  const unique = [...new Map(refs.map((ref) => [`${ref.name}/${ref.id}`, ref])).values()];

  if (!unique.length) {
    return new Map();
  }

  const docs = await firestore.getAll(...unique.map((ref) => collection(userId, ref.name).doc(ref.id)));
  return new Map(unique.map((ref, index) => [`${ref.name}/${ref.id}`, docs[index].exists ? toRecord(docs[index]) : null]));
}

const seededUsers = new Map();

// Cada versão adiciona valores padrão; usuários antigos recebem só o que falta.
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

// Cria notas, dificuldades e status padrão no primeiro acesso de cada usuário.
function ensureUserDefaults(userId) {
  if (!seededUsers.has(userId)) {
    const promise = firestore
      .runTransaction(async (transaction) => {
        const ref = userDoc(userId);
        const snapshot = await transaction.get(ref);
        const legacyVersion = snapshot.exists && snapshot.get('defaultsSeededAt') ? 1 : 0;
        const currentVersion = (snapshot.exists && snapshot.get('defaultsVersion')) || legacyVersion;

        if (currentVersion >= DEFAULTS_VERSION) {
          return;
        }

        const pending = [];
        for (let version = currentVersion + 1; version <= DEFAULTS_VERSION; version += 1) {
          pending.push(...defaultsFor(version));
        }

        // Não sobrescreve registros que o usuário já tenha.
        const existing = await transaction.getAll(...pending.map((item) => collection(userId, item.name).doc(item.id)));
        const now = new Date().toISOString();

        pending.forEach((item, index) => {
          if (!existing[index].exists) {
            transaction.set(collection(userId, item.name).doc(item.id), {
              ...item.data,
              description: '',
              createdAt: now,
              updatedAt: now,
            });
          }
        });

        transaction.set(ref, { defaultsVersion: DEFAULTS_VERSION, defaultsSeededAt: now }, { merge: true });
      })
      .catch((error) => {
        seededUsers.delete(userId);
        throw error;
      });

    seededUsers.set(userId, promise);
  }

  return seededUsers.get(userId);
}

// Grava vários documentos novos em lotes (limite do Firestore: 500 operações por lote).
async function createMany(userId, writes) {
  for (let start = 0; start < writes.length; start += 450) {
    const batch = firestore.batch();
    writes.slice(start, start + 450).forEach((write) => {
      batch.create(collection(userId, write.name).doc(write.id), write.data);
    });
    await batch.commit();
  }
}

module.exports = {
  createMany,
  listDocs,
  getDoc,
  createDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  countWhere,
  getMany,
  ensureUserDefaults,
};
