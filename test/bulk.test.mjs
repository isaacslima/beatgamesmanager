import test from 'node:test';
import assert from 'node:assert/strict';
import { planBulkUpdate } from '../public/js/shared/bulk.js';

const types = [
  { id: 't-arpg', genreId: 'g-rpg' },
  { id: 't-jrpg', genreId: 'g-rpg' },
  { id: 't-3d', genreId: 'g-plat' },
  { id: 't-free' },
];

const games = [
  { id: '1', title: 'Elden Ring', status: 'completed', platformId: 'pc', genreId: 'g-rpg', typeId: 't-arpg', tagIds: ['hard'], isGoty: true },
  { id: '2', title: 'Mario 64', status: 'completed', platformId: 'n64', genreId: 'g-plat', typeId: 't-3d', tagIds: [] },
  { id: '3', title: 'Hades', status: 'wishlist', platformId: null, genreId: null, typeId: null, tagIds: ['hard', 'cozy'] },
];

test('altera só os campos escolhidos e só nos jogos que mudam', () => {
  const { updates, errors, unchanged } = planBulkUpdate(games, { status: 'completed' }, { types });
  assert.deepEqual(errors, []);
  assert.equal(unchanged, 2);
  assert.deepEqual(updates, [{ id: '3', title: 'Hades', fields: { status: 'completed' } }]);
});

test('null limpa o campo', () => {
  const { updates } = planBulkUpdate(games, { platformId: null }, { types });
  assert.deepEqual(updates.map((update) => [update.id, update.fields]), [
    ['1', { platformId: null }],
    ['2', { platformId: null }],
  ]);
});

test('tipo com gênero define o gênero; conflito explícito é erro', () => {
  const { updates } = planBulkUpdate(games, { typeId: 't-jrpg' }, { types });
  assert.deepEqual(updates.find((update) => update.id === '2').fields, { genreId: 'g-rpg', typeId: 't-jrpg' });
  assert.deepEqual(updates.find((update) => update.id === '3').fields, { genreId: 'g-rpg', typeId: 't-jrpg' });

  assert.match(planBulkUpdate(games, { typeId: 't-jrpg', genreId: 'g-plat' }, { types }).errors[0], /outro gênero/);
});

test('trocar o gênero remove tipos de outro gênero', () => {
  const { updates } = planBulkUpdate(games, { genreId: 'g-plat' }, { types });
  assert.deepEqual(updates.find((update) => update.id === '1').fields, { genreId: 'g-plat', typeId: null });
  assert.equal(updates.find((update) => update.id === '2'), undefined, 'Mario já é de plataforma');
});

test('adiciona e remove tags sem duplicar', () => {
  const { updates } = planBulkUpdate(games, { addTagIds: ['cozy'], removeTagIds: ['hard'] }, { types });
  assert.deepEqual(updates.map((update) => [update.id, update.fields.tagIds]), [
    ['1', ['cozy']],
    ['2', ['cozy']],
    ['3', ['cozy']],
  ]);
});

test('erros: status vazio, tag em adicionar e remover, limite de tags', () => {
  assert.match(planBulkUpdate(games, { status: null }).errors[0], /status/);
  assert.match(planBulkUpdate(games, { addTagIds: ['a'], removeTagIds: ['a'] }).errors[0], /ao mesmo tempo/);

  const many = Array.from({ length: 20 }, (_, index) => `t${index}`);
  const result = planBulkUpdate([{ ...games[2], tagIds: many }], { addTagIds: ['extra'] });
  assert.match(result.errors[0], /mais de 20 tags/);
  assert.deepEqual(result.updates, []);
});

test('GOTY: marca/desmarca só quando muda', () => {
  const { updates } = planBulkUpdate(games, { isGoty: true }, { types });
  assert.deepEqual(updates.map((update) => update.id), ['2', '3']);
});
