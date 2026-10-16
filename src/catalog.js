const MIN_SCORE = 1;
const MAX_SCORE = 11;

const STATUS_COLORS = ['purple', 'blue', 'cyan', 'emerald', 'amber', 'orange', 'red', 'pink', 'gray'];

// Ids fixos: "wishlist" e "completed" alimentam os cards do dashboard e não podem ser excluídos.
const DEFAULT_STATUSES = [
  { id: 'wishlist', name: 'Lista de Desejo', color: 'purple', order: 1 },
  { id: 'planned', name: 'Planejado para Jogar', color: 'blue', order: 2 },
  { id: 'completed', name: 'Zerado', color: 'emerald', order: 3 },
  { id: 'dropped', name: 'Dropado', color: 'gray', order: 4 },
];

const PROTECTED_STATUS_IDS = ['wishlist', 'completed'];

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
  MIN_SCORE,
  MAX_SCORE,
  STATUS_COLORS,
  DEFAULT_STATUSES,
  PROTECTED_STATUS_IDS,
  DEFAULT_SCORES,
  DEFAULT_DIFFICULTIES,
};
