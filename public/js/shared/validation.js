import { MIN_SCORE, MAX_SCORE, MAX_TAGS_PER_GAME, STATUS_COLORS } from './catalog.js';
import { DEFAULT_ICON, ICONS } from './icons.js';

function isBlank(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function text(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function optionalId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
}

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseInteger(value) {
  if (isBlank(value)) {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

export function parseDate(value, label) {
  if (isBlank(value)) {
    return { value: null };
  }

  const raw = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;

  if (!date || date.toISOString().slice(0, 10) !== raw) {
    return { error: `A ${label} é inválida.` };
  }

  return { value: raw };
}

// Aceita "HH:MM:SS", "HH:MM" ou horas decimais ("12.5" / "12,5"). Retorna segundos.
export function parsePlayTime(value) {
  if (isBlank(value)) {
    return { value: null };
  }

  const invalid = { error: 'Tempo total inválido. Use HH:MM:SS, HH:MM ou horas decimais (ex.: 12,5).' };

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? { value: Math.round(value * 3600) } : invalid;
  }

  const raw = String(value).trim().replace(',', '.');

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return { value: Math.round(Number(raw) * 3600) };
  }

  const match = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(raw);
  if (!match) {
    return invalid;
  }

  const [, hours, minutes, seconds = '0'] = match;
  return { value: Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) };
}

function requireName(body, label) {
  const name = text(body.name, 80);
  return name ? { name } : { error: `O nome ${label} é obrigatório.` };
}

export function parsePlatform(body) {
  const { name, error } = requireName(body, 'da plataforma');
  return error ? { error } : { data: { name } };
}

export function parseGenre(body) {
  const { name, error } = requireName(body, 'do gênero');
  return error ? { error } : { data: { name, description: text(body.description, 500) } };
}

export function parseType(body) {
  const { name, error } = requireName(body, 'do tipo');
  return error
    ? { error }
    : { data: { name, genreId: optionalId(body.genreId), description: text(body.description, 500) } };
}

export function parseScore(body) {
  const value = parseInteger(body.value);
  const label = text(body.label, 60);

  if (value === null || Number.isNaN(value) || value < MIN_SCORE || value > MAX_SCORE) {
    return { error: `A nota deve ser um número inteiro de ${MIN_SCORE} a ${MAX_SCORE}.` };
  }

  if (!label) {
    return { error: 'O rótulo da nota é obrigatório.' };
  }

  return { data: { value, label, description: text(body.description, 500) } };
}

export function parseDifficulty(body) {
  const key = text(body.key, 10).toUpperCase();
  const label = text(body.label, 60);
  const order = parseInteger(body.order);

  if (!key) {
    return { error: 'A chave da dificuldade é obrigatória (ex.: C, B, A, AA, AAA).' };
  }

  if (!label) {
    return { error: 'O nome da dificuldade é obrigatório.' };
  }

  if (order === null || Number.isNaN(order) || order < 0) {
    return { error: 'A ordem deve ser um número inteiro maior ou igual a zero.' };
  }

  return { data: { key, label, order, description: text(body.description, 500) } };
}

export function parseStatus(body) {
  const { name, error } = requireName(body, 'do status');
  if (error) {
    return { error };
  }

  const order = parseInteger(body.order);
  if (order === null || Number.isNaN(order) || order < 0) {
    return { error: 'A ordem deve ser um número inteiro maior ou igual a zero.' };
  }

  const color = STATUS_COLORS.includes(body.color) ? body.color : 'gray';
  return { data: { name, color, order, description: text(body.description, 500) } };
}

// Aceita lista de ids; remove vazios e repetidos.
export function parseTagIds(value) {
  if (value === null || value === undefined || value === '') {
    return { value: [] };
  }

  if (!Array.isArray(value)) {
    return { error: 'As tags devem ser uma lista.' };
  }

  const ids = [...new Set(value.map(optionalId).filter(Boolean))];
  if (ids.length > MAX_TAGS_PER_GAME) {
    return { error: `Um jogo pode ter no máximo ${MAX_TAGS_PER_GAME} tags.` };
  }

  return { value: ids };
}

export function parseTag(body) {
  const name = text(body.name, 40);
  if (!name) {
    return { error: 'O nome da tag é obrigatório.' };
  }

  const icon = typeof body.icon === 'string' && ICONS[body.icon] ? body.icon : DEFAULT_ICON;
  const color = STATUS_COLORS.includes(body.color) ? body.color : 'gray';
  return { data: { name, icon, color, description: text(body.description, 500) } };
}

export function parseGame(body) {
  const title = text(body.title, 200);
  if (!title) {
    return { error: 'O nome do jogo é obrigatório.' };
  }

  const status = optionalId(body.status);
  if (!status) {
    return { error: 'O status é obrigatório.' };
  }

  const startDate = parseDate(body.startDate, 'data de início');
  if (startDate.error) {
    return startDate;
  }

  const endDate = parseDate(body.endDate, 'data de término');
  if (endDate.error) {
    return endDate;
  }

  if (startDate.value && endDate.value && endDate.value < startDate.value) {
    return { error: 'A data de término não pode ser anterior à data de início.' };
  }

  const playTime = parsePlayTime(body.playTime);
  if (playTime.error) {
    return playTime;
  }

  const score = parseInteger(body.score);
  if (score !== null && (Number.isNaN(score) || score < MIN_SCORE || score > MAX_SCORE)) {
    return { error: `A nota deve ser um número inteiro de ${MIN_SCORE} a ${MAX_SCORE}.` };
  }

  const tags = parseTagIds(body.tagIds);
  if (tags.error) {
    return tags;
  }

  return {
    data: {
      title,
      platformId: optionalId(body.platformId),
      genreId: optionalId(body.genreId),
      typeId: optionalId(body.typeId),
      status,
      startDate: startDate.value,
      endDate: endDate.value,
      playTimeSeconds: playTime.value,
      score,
      difficultyId: optionalId(body.difficultyId),
      completionCondition: text(body.completionCondition, 300),
      isGoty: toBoolean(body.isGoty),
      notes: text(body.notes, 2000),
      tagIds: tags.value,
    },
  };
}

