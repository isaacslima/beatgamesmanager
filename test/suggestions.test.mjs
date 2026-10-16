import test from 'node:test';
import assert from 'node:assert/strict';
import { rankConditions, DEFAULT_CONDITIONS } from '../public/js/suggestions.js';

const games = [
  { id: '1', title: 'Super Mario 64', genreId: 'plat', typeId: '3d', platformId: 'n64', completionCondition: 'Conquiste as 70 estrelas' },
  { id: '2', title: 'Mario Galaxy', genreId: 'plat', typeId: '3d', platformId: 'wii', completionCondition: 'Conquiste as 70 estrelas' },
  { id: '3', title: 'Dark Souls', genreId: 'rpg', typeId: 'arpg', platformId: 'pc', completionCondition: 'Vença o chefe final' },
  { id: '4', title: 'Stardew Valley', genreId: 'sim', typeId: 'vida', platformId: 'pc', completionCondition: 'Veja os créditos' },
  { id: '5', title: 'Sem condição', genreId: 'sim', completionCondition: '' },
];

test('agrupa condições iguais e conta quantos jogos usaram', () => {
  const [first] = rankConditions(games);
  assert.equal(first.text, 'Conquiste as 70 estrelas');
  assert.equal(first.count, 2);
  assert.deepEqual(first.examples, ['Super Mario 64', 'Mario Galaxy']);
  assert.equal(first.source, 'history');
});

test('prioriza condições de jogos com mesmo tipo/gênero', () => {
  const [first] = rankConditions(games, { genreId: 'rpg', typeId: 'arpg' });
  assert.equal(first.text, 'Vença o chefe final');
});

test('filtra pela busca ignorando acentos e caixa', () => {
  const results = rankConditions(games, { query: 'CREDITOS' });
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('creditos')));
  assert.equal(results[0].text, 'Veja os créditos');
});

test('não sugere a condição exatamente igual ao que já foi digitado', () => {
  const results = rankConditions(games, { query: 'Veja os créditos' });
  assert.ok(!results.some((item) => item.text === 'Veja os créditos'));
});

test('ignora o próprio jogo em edição', () => {
  const results = rankConditions(games, { excludeGameId: '3' });
  assert.ok(!results.some((item) => item.text === 'Vença o chefe final'));
});

test('sem histórico, retorna exemplos padrão', () => {
  const results = rankConditions([], {}, 20);
  assert.equal(results.length, DEFAULT_CONDITIONS.length);
  assert.ok(results.every((item) => item.source === 'default'));
});
