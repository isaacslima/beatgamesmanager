const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { upsertGame } = require('../src/db');

const DATA_FILE = path.join(__dirname, '..', 'data', 'games.json');

function normalizeRecord(record) {
  return {
    id: typeof record.id === 'string' && record.id ? record.id : randomUUID(),
    name: typeof record.name === 'string' ? record.name.trim() : '',
    platform: typeof record.platform === 'string' ? record.platform.trim() : '',
    emulatorName: typeof record.emulatorName === 'string' ? record.emulatorName.trim() : '',
    totalPlayTimeHours:
      record.totalPlayTimeHours === null || record.totalPlayTimeHours === undefined || record.totalPlayTimeHours === ''
        ? null
        : Number(record.totalPlayTimeHours),
    startDate: typeof record.startDate === 'string' && record.startDate ? record.startDate : null,
    endDate: typeof record.endDate === 'string' && record.endDate ? record.endDate : null,
    notes: typeof record.notes === 'string' ? record.notes.trim() : '',
    rating: record.rating === null || record.rating === undefined || record.rating === '' ? null : Number(record.rating),
    createdAt: typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : new Date().toISOString(),
  };
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('Arquivo data/games.json não encontrado. Nada para migrar.');
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.log('Nenhum dado em data/games.json para migrar.');
    return;
  }

  let imported = 0;

  for (const item of parsed) {
    const game = normalizeRecord(item);

    if (!game.name) {
      continue;
    }

    if (game.rating !== null && (Number.isNaN(game.rating) || game.rating < 0 || game.rating > 10)) {
      continue;
    }

    if (
      game.totalPlayTimeHours !== null &&
      (Number.isNaN(game.totalPlayTimeHours) || game.totalPlayTimeHours < 0)
    ) {
      continue;
    }

    if (game.platform !== 'PC com emulador') {
      game.emulatorName = '';
    }

    await upsertGame(game);
    imported += 1;
  }

  console.log(`Migração concluída. Registros importados: ${imported}.`);
}

run().catch((error) => {
  console.error('Falha na migração:', error);
  process.exit(1);
});
