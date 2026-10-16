export const STATUSES = [
  { value: 'wishlist', label: 'Lista de Desejo', badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
  { value: 'planned', label: 'Planejado para Jogar', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { value: 'completed', label: 'Zerado', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'dropped', label: 'Dropado', badge: 'bg-gray-100 text-gray-600 ring-gray-200' },
];

export const STATUS_BY_VALUE = new Map(STATUSES.map((status) => [status.value, status]));
