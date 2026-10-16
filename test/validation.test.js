const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeKey,
  parsePlayTime,
  parseDate,
  parseGame,
  parseScore,
  parseDifficulty,
  parseType,
  parseStatus,
} = require('../src/validation');

test('parsePlayTime aceita HH:MM:SS, HH:MM e horas decimais', () => {
  assert.deepEqual(parsePlayTime('12:30:15'), { value: 12 * 3600 + 30 * 60 + 15 });
  assert.deepEqual(parsePlayTime('1:05'), { value: 3600 + 5 * 60 });
  assert.deepEqual(parsePlayTime('12,5'), { value: 45000 });
  assert.deepEqual(parsePlayTime('40'), { value: 144000 });
  assert.deepEqual(parsePlayTime(''), { value: null });
  assert.deepEqual(parsePlayTime(null), { value: null });
});

test('parsePlayTime rejeita formatos inválidos', () => {
  assert.ok(parsePlayTime('1:75').error);
  assert.ok(parsePlayTime('abc').error);
  assert.ok(parsePlayTime('-3').error);
  assert.ok(parsePlayTime(-1).error);
});

test('parseDate valida datas reais no formato AAAA-MM-DD', () => {
  assert.deepEqual(parseDate('2024-02-29', 'data'), { value: '2024-02-29' });
  assert.ok(parseDate('2023-02-29', 'data').error);
  assert.ok(parseDate('29/02/2024', 'data').error);
  assert.deepEqual(parseDate('', 'data'), { value: null });
});

test('parseGame permite jogo na lista de desejo sem datas', () => {
  const { data, error } = parseGame({ title: '  Hollow Knight ', status: 'wishlist' });
  assert.equal(error, undefined);
  assert.equal(data.title, 'Hollow Knight');
  assert.equal(data.startDate, null);
  assert.equal(data.endDate, null);
  assert.equal(data.score, null);
  assert.equal(data.isGoty, false);
  assert.equal(data.platformId, null);
});

test('parseGame exige nome e status', () => {
  assert.match(parseGame({ status: 'planned' }).error, /nome/);
  assert.match(parseGame({ title: 'X' }).error, /status/);
  assert.match(parseGame({ title: 'X', status: '  ' }).error, /status/);
});

test('parseStatus valida nome e ordem, com cor padrão', () => {
  assert.deepEqual(parseStatus({ name: 'Jogando', order: '5', color: 'amber' }).data, {
    name: 'Jogando',
    color: 'amber',
    order: 5,
    description: '',
  });
  assert.equal(parseStatus({ name: 'Jogando', order: '5', color: 'neon' }).data.color, 'gray');
  assert.ok(parseStatus({ order: '1' }).error);
  assert.ok(parseStatus({ name: 'X' }).error);
});

test('parseGame valida nota, datas e tempo', () => {
  assert.match(parseGame({ title: 'X', status: 'completed', score: '12' }).error, /nota/);
  assert.match(parseGame({ title: 'X', status: 'completed', score: '7.5' }).error, /nota/);
  assert.match(
    parseGame({ title: 'X', status: 'completed', startDate: '2024-05-10', endDate: '2024-05-01' }).error,
    /término/
  );
  assert.match(parseGame({ title: 'X', status: 'completed', playTime: '1:99' }).error, /Tempo/);

  const { data } = parseGame({
    title: 'Super Mario 64',
    status: 'completed',
    score: '11',
    playTime: '20:00:00',
    isGoty: 'true',
    completionCondition: ' Conquiste as 70 estrelas ',
  });
  assert.equal(data.score, 11);
  assert.equal(data.playTimeSeconds, 72000);
  assert.equal(data.isGoty, true);
  assert.equal(data.completionCondition, 'Conquiste as 70 estrelas');
});

test('parseScore e parseDifficulty validam campos obrigatórios', () => {
  assert.deepEqual(parseScore({ value: '11', label: 'Jogo da vida' }).data, {
    value: 11,
    label: 'Jogo da vida',
    description: '',
  });
  assert.ok(parseScore({ value: '0', label: 'X' }).error);
  assert.ok(parseScore({ value: '5' }).error);

  assert.equal(parseDifficulty({ key: 'aa', label: 'Difícil', order: '4' }).data.key, 'AA');
  assert.ok(parseDifficulty({ key: 'AA', label: 'Difícil' }).error);
});

test('parseType aceita gênero opcional', () => {
  assert.equal(parseType({ name: 'Ação RPG', genreId: '' }).data.genreId, null);
  assert.equal(parseType({ name: 'Ação RPG', genreId: 'abc' }).data.genreId, 'abc');
});

test('normalizeKey ignora acentos, caixa e espaços extras', () => {
  assert.equal(normalizeKey('  Ação   RPG '), 'acao rpg');
  assert.equal(normalizeKey('NINTENDO Switch'), normalizeKey('nintendo switch'));
});
