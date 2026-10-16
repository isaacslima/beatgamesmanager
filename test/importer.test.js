const test = require('node:test');
const assert = require('node:assert/strict');
const { planImport, summarize, buildImportWrites } = require('../src/importer');

function catalogs() {
  return {
    statuses: [
      { id: 'wishlist', name: 'Lista de Desejo' },
      { id: 'completed', name: 'Zerado' },
    ],
    platforms: [{ id: 'p-n64', name: 'Nintendo 64' }],
    genres: [{ id: 'g-rpg', name: 'RPG' }, { id: 'g-plat', name: 'Plataforma' }],
    types: [{ id: 't-arpg', name: 'Ação RPG', genreId: 'g-rpg' }],
    scores: [{ value: 11 }, { value: 9 }],
    difficulties: [{ id: 'b', key: 'B', label: 'Médio' }],
    games: [{ id: 'old', title: 'Super Mario 64', platformId: 'p-n64' }],
  };
}

test('rejeita conteúdo que não é uma lista', () => {
  assert.match(planImport({ title: 'X' }, catalogs()).error, /lista/);
  assert.match(planImport([], catalogs()).error, /nenhum/);
});

test('resolve cadastros por nome ignorando acentos e caixa', () => {
  const { rows } = planImport(
    [{ title: 'Diablo', status: 'zerado', type: 'acao rpg', difficulty: 'médio', score: 9, startDate: '01/02/2024' }],
    catalogs()
  );
  const [row] = rows;
  assert.equal(row.valid, true, row.errors.join());
  assert.equal(row.data.status, 'completed');
  assert.equal(row.data.typeId, 't-arpg');
  assert.equal(row.data.genreId, 'g-rpg', 'gênero herdado do tipo');
  assert.equal(row.data.difficultyId, 'b');
  assert.equal(row.data.startDate, '2024-02-01', 'aceita DD/MM/AAAA');
});

test('acusa status, dificuldade e nota não cadastrados', () => {
  const { rows } = planImport(
    [
      { title: 'A' },
      { title: 'B', status: 'Jogando' },
      { title: 'C', status: 'Zerado', difficulty: 'ZZZ' },
      { title: 'D', status: 'Zerado', score: 5 },
      { title: 'E', status: 'Zerado', genre: 'Plataforma', type: 'Ação RPG' },
      'texto',
    ],
    catalogs()
  );
  assert.match(rows[0].errors[0], /status é obrigatório/);
  assert.match(rows[1].errors[0], /Jogando/);
  assert.match(rows[2].errors[0], /Dificuldade/);
  assert.match(rows[3].errors[0], /Nota 5/);
  assert.match(rows[4].errors[0], /pertence ao gênero "RPG"/);
  assert.match(rows[5].errors[0], /objeto/);
  assert.ok(rows.every((row) => !row.valid));
});

test('marca duplicados da biblioteca e do próprio arquivo', () => {
  const plan = planImport(
    [
      { title: 'super mario 64', status: 'Zerado', platform: 'Nintendo 64' },
      { title: 'Zelda', status: 'Zerado' },
      { title: 'ZELDA', status: 'Lista de Desejo' },
      { title: 'Super Mario 64', status: 'Zerado', platform: 'Switch' },
    ],
    catalogs()
  );
  assert.deepEqual(plan.rows.map((row) => row.duplicate), [true, false, true, false]);
  assert.equal(summarize(plan).duplicates, 2);
});

test('cria apenas os cadastros novos usados pelas linhas selecionadas', () => {
  const plan = planImport(
    [
      { title: 'Stardew Valley', status: 'Zerado', platform: 'Switch', genre: 'Simulação', type: 'Vida' },
      { title: 'Celeste', status: 'Zerado', platform: 'switch', genre: 'Plataforma' },
      { title: 'Outro', status: 'Zerado', platform: 'PC' },
    ],
    catalogs()
  );

  assert.deepEqual(summarize(plan).toCreate, { platforms: ['Switch', 'PC'], genres: ['Simulação'], types: ['Vida'] });

  let next = 0;
  const { writes, counts } = buildImportWrites(plan, new Set([0, 1]), { newId: () => `id${++next}`, now: 1_700_000_000_000 });
  assert.deepEqual(counts, { games: 2, platforms: 1, genres: 1, types: 1 });

  const byName = (name) => writes.filter((write) => write.name === name);
  const [platform] = byName('platforms');
  const [genre] = byName('genres');
  const [type] = byName('types');
  const games = byName('games');

  assert.equal(platform.data.name, 'Switch');
  assert.equal(type.data.genreId, genre.id);
  assert.ok(games.every((game) => game.data.platformId === platform.id), 'reaproveita a plataforma criada');
  assert.equal(games[0].data.typeId, type.id);
  assert.ok(games[0].data.createdAt > games[1].data.createdAt, 'primeiro do arquivo fica no topo');
  assert.ok(!writes.some((write) => write.data.name === 'PC'), 'não cria cadastro de linha não selecionada');
});
