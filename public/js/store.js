import { list } from './data.js';

export const COLLECTIONS = ['games', 'statuses', 'tags', 'platforms', 'genres', 'types', 'scores', 'difficulties'];

export const store = Object.fromEntries(COLLECTIONS.map((name) => [name, []]));

const listeners = new Set();

export function onStoreChange(listener) {
  listeners.add(listener);
}

function notify(names) {
  listeners.forEach((listener) => listener(names));
}

export async function loadAll() {
  const results = await Promise.all(COLLECTIONS.map((name) => list(name)));
  COLLECTIONS.forEach((name, index) => {
    store[name] = results[index];
  });
  notify(COLLECTIONS);
}

export async function reload(...names) {
  const results = await Promise.all(names.map((name) => list(name)));
  names.forEach((name, index) => {
    store[name] = results[index];
  });
  notify(names);
}

export function clearStore() {
  COLLECTIONS.forEach((name) => {
    store[name] = [];
  });
}

export function findById(name, id) {
  if (id === null || id === undefined || id === '') {
    return null;
  }

  return store[name].find((item) => String(item.id) === String(id)) || null;
}

export function findScore(value) {
  return value === null || value === undefined ? null : store.scores.find((score) => score.value === value) || null;
}

export function countGamesBy(field, value) {
  return store.games.filter((game) => game[field] === value).length;
}

export function sortedStatuses() {
  return [...store.statuses].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
}
