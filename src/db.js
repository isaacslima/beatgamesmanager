const { Pool } = require('pg');

const rawConnectionString = process.env.POSTGRES_URL || process.env.STORAGE_POSTGRES_URL;
const connectionString = rawConnectionString?.split('?')[0];
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

function sql(strings, ...values) {
  const text = strings.slice(1).reduce((acc, str, i) => `${acc}$${i + 1}${str}`, strings[0]);
  return pool.query(text, values);
}

let initialized = false;

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function mapRowToGame(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    emulatorName: row.emulator_name,
    totalPlayTimeHours: row.total_play_time_hours === null ? null : Number(row.total_play_time_hours),
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    notes: row.notes,
    rating: row.rating === null ? null : Number(row.rating),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function initDatabase() {
  if (initialized) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT,
      emulator_name TEXT,
      total_play_time_hours NUMERIC(8,1),
      start_date DATE,
      end_date DATE,
      notes TEXT NOT NULL DEFAULT '',
      rating NUMERIC(3,1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS platform TEXT`;
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS emulator_name TEXT`;
  await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS total_play_time_hours NUMERIC(8,1)`;

  await sql`
    CREATE TABLE IF NOT EXISTS platforms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  initialized = true;
}

function mapRowToPlatform(row) {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
  };
}

async function listPlatforms() {
  await initDatabase();
  const { rows } = await sql`SELECT id, name, image_url FROM platforms ORDER BY name`;
  return rows.map(mapRowToPlatform);
}

async function createPlatform(platform) {
  await initDatabase();
  const { rows } = await sql`
    INSERT INTO platforms (id, name, image_url)
    VALUES (${platform.id}, ${platform.name}, ${platform.imageUrl})
    RETURNING id, name, image_url
  `;

  return mapRowToPlatform(rows[0]);
}

async function getStats() {
  await initDatabase();
  const [{ rows: totalRows }, { rows: platformRows }, { rows: lastRows }] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM games`,
    sql`
      SELECT platform, COUNT(*)::int AS count
      FROM games
      WHERE platform IS NOT NULL AND platform <> ''
      GROUP BY platform
      ORDER BY count DESC
    `,
    sql`
      SELECT id, name, platform, created_at
      FROM games
      ORDER BY created_at DESC
      LIMIT 9
    `,
  ]);

  return {
    totalGames: totalRows[0].total,
    platformCounts: platformRows.map((row) => ({ platform: row.platform, count: row.count })),
    lastGames: lastRows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: row.platform,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })),
  };
}

async function listGames() {
  await initDatabase();
  const { rows } = await sql`
    SELECT id, name, platform, emulator_name, total_play_time_hours, start_date, end_date, notes, rating, created_at, updated_at
    FROM games
    ORDER BY created_at DESC
  `;

  return rows.map(mapRowToGame);
}

async function createGame(game) {
  await initDatabase();
  const { rows } = await sql`
    INSERT INTO games (id, name, platform, emulator_name, total_play_time_hours, start_date, end_date, notes, rating, created_at, updated_at)
    VALUES (${game.id}, ${game.name}, ${game.platform}, ${game.emulatorName}, ${game.totalPlayTimeHours}, ${game.startDate}, ${game.endDate}, ${game.notes}, ${game.rating}, ${game.createdAt}, ${game.updatedAt})
    RETURNING id, name, platform, emulator_name, total_play_time_hours, start_date, end_date, notes, rating, created_at, updated_at
  `;

  return mapRowToGame(rows[0]);
}

async function updateGame(id, game) {
  await initDatabase();
  const { rows } = await sql`
    UPDATE games
    SET name = ${game.name},
        platform = ${game.platform},
        emulator_name = ${game.emulatorName},
        total_play_time_hours = ${game.totalPlayTimeHours},
        start_date = ${game.startDate},
        end_date = ${game.endDate},
        notes = ${game.notes},
        rating = ${game.rating},
        updated_at = ${game.updatedAt}
    WHERE id = ${id}
    RETURNING id, name, platform, emulator_name, total_play_time_hours, start_date, end_date, notes, rating, created_at, updated_at
  `;

  return rows[0] ? mapRowToGame(rows[0]) : null;
}

async function deleteGame(id) {
  await initDatabase();
  const { rows } = await sql`
    DELETE FROM games
    WHERE id = ${id}
    RETURNING id
  `;

  return rows.length > 0;
}

async function upsertGame(game) {
  await initDatabase();
  const { rows } = await sql`
    INSERT INTO games (id, name, platform, emulator_name, total_play_time_hours, start_date, end_date, notes, rating, created_at, updated_at)
    VALUES (${game.id}, ${game.name}, ${game.platform}, ${game.emulatorName}, ${game.totalPlayTimeHours}, ${game.startDate}, ${game.endDate}, ${game.notes}, ${game.rating}, ${game.createdAt}, ${game.updatedAt})
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      platform = EXCLUDED.platform,
      emulator_name = EXCLUDED.emulator_name,
      total_play_time_hours = EXCLUDED.total_play_time_hours,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      notes = EXCLUDED.notes,
      rating = EXCLUDED.rating,
      updated_at = EXCLUDED.updated_at
    RETURNING id
  `;

  return rows[0]?.id;
}

module.exports = {
  initDatabase,
  listGames,
  createGame,
  updateGame,
  deleteGame,
  upsertGame,
  listPlatforms,
  createPlatform,
  getStats,
};
