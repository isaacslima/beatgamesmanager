const { firestore } = require('./firebase');

class DuplicatePlatformError extends Error {}

function userDoc(userId) {
  return firestore.collection('users').doc(userId);
}

function gamesCollection(userId) {
  return userDoc(userId).collection('games');
}

function platformsCollection(userId) {
  return userDoc(userId).collection('platforms');
}

function mapDocToGame(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    platform: data.platform ?? null,
    emulatorName: data.emulatorName ?? null,
    totalPlayTimeHours: data.totalPlayTimeHours ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    notes: data.notes ?? '',
    rating: data.rating ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function toGameData(game) {
  return {
    name: game.name,
    platform: game.platform,
    emulatorName: game.emulatorName,
    totalPlayTimeHours: game.totalPlayTimeHours,
    startDate: game.startDate,
    endDate: game.endDate,
    notes: game.notes,
    rating: game.rating,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

function mapDocToPlatform(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    imageUrl: data.imageUrl ?? null,
  };
}

async function listPlatforms(userId) {
  const snapshot = await platformsCollection(userId).orderBy('name').get();
  return snapshot.docs.map(mapDocToPlatform);
}

async function createPlatform(userId, platform) {
  const collection = platformsCollection(userId);
  const ref = collection.doc(platform.id);

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(collection.where('name', '==', platform.name).limit(1));
    if (!existing.empty) {
      throw new DuplicatePlatformError(platform.name);
    }

    transaction.set(ref, {
      name: platform.name,
      imageUrl: platform.imageUrl,
      createdAt: new Date().toISOString(),
    });
  });

  return mapDocToPlatform(await ref.get());
}

async function getStats(userId) {
  const games = await listGames(userId);
  const countsByPlatform = new Map();

  games.forEach((game) => {
    if (game.platform) {
      countsByPlatform.set(game.platform, (countsByPlatform.get(game.platform) || 0) + 1);
    }
  });

  return {
    totalGames: games.length,
    platformCounts: [...countsByPlatform.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
    lastGames: games.slice(0, 9).map((game) => ({
      id: game.id,
      name: game.name,
      platform: game.platform,
      createdAt: game.createdAt,
    })),
  };
}

async function listGames(userId) {
  const snapshot = await gamesCollection(userId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(mapDocToGame);
}

async function createGame(userId, game) {
  const ref = gamesCollection(userId).doc(game.id);
  await ref.create(toGameData(game));
  return mapDocToGame(await ref.get());
}

async function updateGame(userId, id, game) {
  const ref = gamesCollection(userId).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    return null;
  }

  const { createdAt: _createdAt, ...fields } = toGameData(game);
  await ref.update(fields);
  return mapDocToGame(await ref.get());
}

async function deleteGame(userId, id) {
  const ref = gamesCollection(userId).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    return false;
  }

  await ref.delete();
  return true;
}

module.exports = {
  DuplicatePlatformError,
  listGames,
  createGame,
  updateGame,
  deleteGame,
  listPlatforms,
  createPlatform,
  getStats,
};
