// Cores disponíveis para os status (mesma lista de STATUS_COLORS no backend).
export const STATUS_COLORS = [
  { value: 'purple', label: 'Roxo', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'blue', label: 'Azul', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'cyan', label: 'Ciano', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
  { value: 'emerald', label: 'Verde', badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'amber', label: 'Amarelo', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'orange', label: 'Laranja', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'red', label: 'Vermelho', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  { value: 'pink', label: 'Rosa', badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
  { value: 'gray', label: 'Cinza', badge: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
];

const COLOR_BY_VALUE = new Map(STATUS_COLORS.map((color) => [color.value, color]));

export function statusBadgeClass(color) {
  return (COLOR_BY_VALUE.get(color) || COLOR_BY_VALUE.get('gray')).badge;
}

// Status fixos usados pelos cards do dashboard (podem ser renomeados, não excluídos).
export const PROTECTED_STATUS_IDS = ['wishlist', 'completed'];
