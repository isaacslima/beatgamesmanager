// Cores disponíveis para os status (mesma lista de STATUS_COLORS no backend).
export const STATUS_COLORS = [
  { value: 'purple', label: 'Roxo', badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
  { value: 'blue', label: 'Azul', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { value: 'cyan', label: 'Ciano', badge: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  { value: 'emerald', label: 'Verde', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'amber', label: 'Amarelo', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'orange', label: 'Laranja', badge: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { value: 'red', label: 'Vermelho', badge: 'bg-red-50 text-red-700 ring-red-200' },
  { value: 'pink', label: 'Rosa', badge: 'bg-pink-50 text-pink-700 ring-pink-200' },
  { value: 'gray', label: 'Cinza', badge: 'bg-gray-100 text-gray-600 ring-gray-200' },
];

const COLOR_BY_VALUE = new Map(STATUS_COLORS.map((color) => [color.value, color]));

export function statusBadgeClass(color) {
  return (COLOR_BY_VALUE.get(color) || COLOR_BY_VALUE.get('gray')).badge;
}

// Status fixos usados pelos cards do dashboard (podem ser renomeados, não excluídos).
export const PROTECTED_STATUS_IDS = ['wishlist', 'completed'];
