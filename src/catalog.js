const GAME_STATUSES = ['wishlist', 'planned', 'completed', 'dropped'];

const MIN_SCORE = 1;
const MAX_SCORE = 11;

const DEFAULT_SCORES = [
  { value: 11, label: 'Jogo da vida' },
  { value: 10, label: 'Obra-prima' },
  { value: 9, label: 'Excelente' },
  { value: 8, label: 'Muito bom' },
  { value: 7, label: 'Bom' },
  { value: 6, label: 'Legal' },
  { value: 5, label: 'Mediano' },
  { value: 4, label: 'Fraco' },
  { value: 3, label: 'Ruim' },
  { value: 2, label: 'Péssimo' },
  { value: 1, label: 'Tragédia' },
];

const DEFAULT_DIFFICULTIES = [
  { id: 'c', key: 'C', label: 'Fácil', order: 1 },
  { id: 'b', key: 'B', label: 'Médio', order: 2 },
  { id: 'a', key: 'A', label: 'Complicado', order: 3 },
  { id: 'aa', key: 'AA', label: 'Difícil', order: 4 },
  { id: 'aaa', key: 'AAA', label: 'Imperdoável', order: 5 },
];

module.exports = {
  GAME_STATUSES,
  MIN_SCORE,
  MAX_SCORE,
  DEFAULT_SCORES,
  DEFAULT_DIFFICULTIES,
};
