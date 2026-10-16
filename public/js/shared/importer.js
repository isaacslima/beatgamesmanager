
import { normalizeKey, parseGame } from './validation.js';

export const MAX_ITEMS = 1000;

const NEW_LABELS = {
  platforms: (name) => `Plataforma "${name}" será criada.`,
  genres: (name) => `Gênero "${name}" será criado.`,
  types: (name) => `Tipo "${name}" será criado.`,
  tags: (name) => `Tag "${name}" será criada.`,
};

// "tags" pode vir como lista de nomes ou texto separado por vírgulas.
function tagNames(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set();
  return list
    .map(textValue)
    .filter((name) => {
      const key = normalizeKey(name);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function textValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  return typeof value === 'number' ? String(value) : '';
}

// Aceita também DD/MM/AAAA, comum em planilhas.
function toIsoDate(value) {
  const match = typeof value === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim()) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function indexBy(records, ...fields) {
  const map = new Map();
  records.forEach((record) => {
    fields.forEach((field) => {
      const key = normalizeKey(record[field]);
      if (key && !map.has(key)) {
        map.set(key, record);
      }
    });
  });
  return map;
}

function gameKey(title, platformId) {
  return `${normalizeKey(title)}|${platformId || ''}`;
}

function placeholder(kind, key) {
  return `new:${kind}:${key}`;
}

/**
 * Monta o plano de importação (nada é gravado aqui).
 * catalogs: { statuses, platforms, genres, types, scores, difficulties, games }
 */
export function planImport(items, catalogs) {
  if (!Array.isArray(items)) {
    return { error: 'O arquivo deve conter uma lista (array) de jogos: [ { ... }, { ... } ].' };
  }

  if (!items.length) {
    return { error: 'O arquivo não contém nenhum jogo.' };
  }

  if (items.length > MAX_ITEMS) {
    return { error: `O arquivo tem ${items.length} jogos. O limite por importação é ${MAX_ITEMS}.` };
  }

  const indexes = {
    statuses: indexBy(catalogs.statuses, 'name', 'id'),
    platforms: indexBy(catalogs.platforms, 'name'),
    genres: indexBy(catalogs.genres, 'name'),
    types: indexBy(catalogs.types, 'name'),
    tags: indexBy(catalogs.tags || [], 'name'),
    difficulties: indexBy(catalogs.difficulties, 'key', 'label'),
  };
  const genreById = new Map(catalogs.genres.map((genre) => [genre.id, genre]));
  const scoreValues = new Set(catalogs.scores.map((score) => score.value));
  const existingGames = new Set(catalogs.games.map((game) => gameKey(game.title ?? game.name, game.platformId)));
  const seenInFile = new Map();
  const toCreate = { platforms: new Map(), genres: new Map(), types: new Map(), tags: new Map() };

  function resolve(kind, value) {
    const name = textValue(value);
    if (!name) {
      return null;
    }

    const key = normalizeKey(name);
    const found = indexes[kind].get(key);
    return found
      ? { id: found.id, name: found.name, isNew: false, record: found }
      : { id: placeholder(kind, key), name, isNew: true, key };
  }

  const rows = items.map((item, index) => {
    const errors = [];
    const warnings = [];

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { index, title: '', valid: false, duplicate: false, errors: ['Item inválido: cada jogo deve ser um objeto { ... }.'], warnings, data: null, preview: {} };
    }

    const title = textValue(item.title ?? item.name);

    const statusName = textValue(item.status);
    const status = statusName ? indexes.statuses.get(normalizeKey(statusName)) : null;
    if (!statusName) {
      errors.push('O status é obrigatório.');
    } else if (!status) {
      errors.push(`Status "${statusName}" não cadastrado. Cadastre-o em Status antes de importar.`);
    }

    const platform = resolve('platforms', item.platform);
    let genre = resolve('genres', item.genre);
    const type = resolve('types', item.type);

    if (type && !type.isNew && type.record.genreId) {
      const typeGenre = genreById.get(type.record.genreId);
      if (genre && genre.id !== type.record.genreId) {
        errors.push(`O tipo "${type.name}" pertence ao gênero "${typeGenre?.name ?? '?'}".`);
      } else if (!genre && typeGenre) {
        genre = { id: typeGenre.id, name: typeGenre.name, isNew: false, inferred: true };
      }
    }

    if (item.tags !== undefined && item.tags !== null && !Array.isArray(item.tags) && typeof item.tags !== 'string') {
      errors.push('O campo "tags" deve ser uma lista de nomes ou um texto separado por vírgulas.');
    }
    const tags = tagNames(item.tags).map((name) => resolve('tags', name));

    const difficultyName = textValue(item.difficulty);
    const difficulty = difficultyName ? indexes.difficulties.get(normalizeKey(difficultyName)) : null;
    if (difficultyName && !difficulty) {
      errors.push(`Dificuldade "${difficultyName}" não cadastrada.`);
    }

    const scoreNumber = Number(item.score);
    if (textValue(item.score) && Number.isInteger(scoreNumber) && scoreNumber >= 1 && scoreNumber <= 11 && !scoreValues.has(scoreNumber)) {
      errors.push(`Nota ${scoreNumber} não cadastrada na tabela de notas.`);
    }

    const { data, error } = parseGame({
      title,
      status: status?.id || 'pendente',
      platformId: platform?.id,
      genreId: genre?.id,
      typeId: type?.id,
      startDate: toIsoDate(item.startDate),
      endDate: toIsoDate(item.endDate),
      playTime: item.playTime,
      score: item.score,
      difficultyId: difficulty?.id,
      completionCondition: item.completionCondition,
      isGoty: item.isGoty,
      notes: item.notes,
      tagIds: tags.map((tag) => tag.id),
    });

    if (error) {
      errors.push(error);
    }

    [
      ['platforms', platform],
      ['genres', genre],
      ['types', type],
      ...tags.map((tag) => ['tags', tag]),
    ].forEach(([kind, ref]) => {
      if (ref?.isNew) {
        warnings.push(NEW_LABELS[kind](ref.name));
      }
    });

    const key = gameKey(title, platform?.id);
    let duplicate = false;
    if (title && existingGames.has(key)) {
      duplicate = true;
      warnings.push('Já existe na sua biblioteca (mesmo nome e plataforma).');
    } else if (title && seenInFile.has(key)) {
      duplicate = true;
      warnings.push(`Repetido no arquivo (igual ao item ${seenInFile.get(key) + 1}).`);
    }
    if (title && !seenInFile.has(key)) {
      seenInFile.set(key, index);
    }

    const valid = errors.length === 0;

    if (valid) {
      if (platform?.isNew && !toCreate.platforms.has(platform.key)) {
        toCreate.platforms.set(platform.key, { name: platform.name });
      }
      if (genre?.isNew && !toCreate.genres.has(genre.key)) {
        toCreate.genres.set(genre.key, { name: genre.name });
      }
      if (type?.isNew && !toCreate.types.has(type.key)) {
        toCreate.types.set(type.key, { name: type.name, genreId: genre?.id ?? null });
      }
      tags.forEach((tag) => {
        if (tag.isNew && !toCreate.tags.has(tag.key)) {
          toCreate.tags.set(tag.key, { name: tag.name });
        }
      });
    }

    return {
      index,
      title,
      valid,
      duplicate,
      errors,
      warnings,
      data: valid ? data : null,
      preview: {
        status: status?.name ?? statusName,
        statusId: status?.id ?? null,
        platform: platform?.name ?? null,
        platformNew: Boolean(platform?.isNew),
        genre: genre?.name ?? null,
        genreNew: Boolean(genre?.isNew),
        type: type?.name ?? null,
        typeNew: Boolean(type?.isNew),
        startDate: data?.startDate ?? null,
        endDate: data?.endDate ?? null,
        playTimeSeconds: data?.playTimeSeconds ?? null,
        score: data?.score ?? null,
        difficulty: difficulty?.key ?? null,
        completionCondition: data?.completionCondition ?? '',
        isGoty: Boolean(data?.isGoty),
        tags: tags.map((tag) => ({ name: tag.name, isNew: tag.isNew })),
      },
    };
  });

  return { rows, toCreate };
}

export function summarize(plan) {
  const rows = plan.rows;
  return {
    total: rows.length,
    valid: rows.filter((row) => row.valid).length,
    invalid: rows.filter((row) => !row.valid).length,
    duplicates: rows.filter((row) => row.valid && row.duplicate).length,
    toCreate: Object.fromEntries(
      Object.entries(plan.toCreate).map(([kind, map]) => [kind, [...map.values()].map((entry) => entry.name)])
    ),
  };
}

/** Converte as linhas selecionadas em gravações, criando só os cadastros realmente usados. */
export function buildImportWrites(plan, selectedIndexes, { newId = () => crypto.randomUUID(), now = Date.now() } = {}) {
  const selected = plan.rows.filter((row) => row.valid && selectedIndexes.has(row.index));
  const createdAt = new Date(now).toISOString();
  const idMap = new Map();
  const writes = [];
  const counts = { games: 0, platforms: 0, genres: 0, types: 0, tags: 0 };

  function ensure(id) {
    if (!id || !id.startsWith('new:')) {
      return id;
    }

    if (idMap.has(id)) {
      return idMap.get(id);
    }

    const rest = id.slice('new:'.length);
    const kind = rest.slice(0, rest.indexOf(':'));
    const entry = plan.toCreate[kind].get(rest.slice(kind.length + 1));
    const realId = newId();
    idMap.set(id, realId);

    const data = { name: entry.name };
    if (kind === 'platforms') {
      data.imageUrl = null;
    } else {
      data.description = '';
    }
    if (kind === 'tags') {
      data.icon = 'tag';
      data.color = 'gray';
    }
    if (kind === 'types') {
      data.genreId = ensure(entry.genreId);
    }

    writes.push({ name: kind, id: realId, data: { ...data, createdAt, updatedAt: createdAt } });
    counts[kind] += 1;
    return realId;
  }

  selected.forEach((row, position) => {
    const data = {
      ...row.data,
      platformId: ensure(row.data.platformId),
      genreId: ensure(row.data.genreId),
      typeId: ensure(row.data.typeId),
      tagIds: row.data.tagIds.map(ensure),
    };
    // O primeiro do arquivo fica como o mais recente, para aparecer no topo da lista.
    const timestamp = new Date(now - position).toISOString();
    writes.push({ name: 'games', id: newId(), data: { ...data, createdAt: timestamp, updatedAt: timestamp } });
    counts.games += 1;
  });

  return { writes, counts };
}

