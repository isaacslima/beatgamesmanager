const { firestore } = require('./firebase');
const { DEFAULT_SCORES, DEFAULT_DIFFICULTIES } = require('./catalog');

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

// Cria notas e dificuldades padrão no primeiro acesso de cada usuário.
function ensureUserDefaults(userId) {
  if (!seededUsers.has(userId)) {
    const promise = firestore
      .runTransaction(async (transaction) => {
        const ref = userDoc(userId);
        const snapshot = await transaction.get(ref);

        if (snapshot.exists && snapshot.get('defaultsSeededAt')) {
          return;
        }

        const now = new Date().toISOString();

        DEFAULT_SCORES.forEach((score) => {
          transaction.set(collection(userId, 'scores').doc(String(score.value)), {
            ...score,
            description: '',
            createdAt: now,
            updatedAt: now,
          });
        });

        DEFAULT_DIFFICULTIES.forEach(({ id, ...difficulty }) => {
          transaction.set(collection(userId, 'difficulties').doc(id), {
            ...difficulty,
            description: '',
            createdAt: now,
            updatedAt: now,
          });
        });

        transaction.set(ref, { defaultsSeededAt: now }, { merge: true });
      })
      .catch((error) => {
        seededUsers.delete(userId);
        throw error;
      });

    seededUsers.set(userId, promise);
  }

  return seededUsers.get(userId);
}

module.exports = {
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
