import { escapeHtml, normalizeText } from './ui.js';

export const DEFAULT_CONDITIONS = [
  'Ver os créditos finais',
  'Vencer o chefe final',
  'Completar a história principal',
  'Desbloquear o final verdadeiro',
  'Completar 100% do jogo',
  'Coletar todas as estrelas',
  'Completar todas as missões secundárias',
  'Conquistar todos os troféus / conquistas',
];

/**
 * Ordena condições de zeramento usadas em jogos anteriores (+ exemplos padrão).
 * Condições de jogos com o mesmo tipo, gênero ou plataforma aparecem primeiro.
 */
export function rankConditions(games, context = {}, limit = 8) {
  const { query = '', genreId = null, typeId = null, platformId = null, excludeGameId = null } = context;
  const groups = new Map();

  games.forEach((game) => {
    const condition = (game.completionCondition || '').trim();
    if (!condition || game.id === excludeGameId) {
      return;
    }

    const key = normalizeText(condition);
    const group = groups.get(key) || { text: condition, count: 0, affinity: 0, examples: [], source: 'history' };

    group.count += 1;
    group.affinity +=
      (typeId && game.typeId === typeId ? 3 : 0) +
      (genreId && game.genreId === genreId ? 2 : 0) +
      (platformId && game.platformId === platformId ? 1 : 0);

    if (group.examples.length < 3) {
      group.examples.push(game.title);
    }

    groups.set(key, group);
  });

  DEFAULT_CONDITIONS.forEach((condition) => {
    const key = normalizeText(condition);
    if (!groups.has(key)) {
      groups.set(key, { text: condition, count: 0, affinity: 0, examples: [], source: 'default' });
    }
  });

  const normalizedQuery = normalizeText(query);
  const terms = normalizedQuery.split(' ').filter(Boolean);

  return [...groups.entries()]
    .filter(([key]) => key !== normalizedQuery && terms.every((term) => key.includes(term)))
    .map(([key, group]) => ({
      ...group,
      rank:
        group.count * 2 +
        group.affinity +
        (group.source === 'history' ? 1 : 0) +
        (normalizedQuery && key.startsWith(normalizedQuery) ? 3 : 0),
    }))
    .sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text, 'pt-BR'))
    .slice(0, limit);
}

function describe(suggestion) {
  if (suggestion.source === 'default') {
    return 'Sugestão';
  }

  const examples = suggestion.examples.join(', ');
  return `Usado em ${suggestion.count} jogo(s) · ex.: ${examples}`;
}

/** Liga a lista de sugestões a um input. getContext() -> { games, genreId, typeId, platformId, excludeGameId } */
export function attachConditionSuggestions(input, getContext) {
  const wrapper = input.parentElement;
  wrapper.classList.add('relative');

  const list = document.createElement('ul');
  list.className = 'suggestions hidden';
  list.setAttribute('role', 'listbox');
  list.id = `${input.id}-suggestions`;
  wrapper.appendChild(list);

  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let items = [];
  let activeIndex = -1;

  function hide() {
    list.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function highlight() {
    list.querySelectorAll('[role="option"]').forEach((element, index) => {
      element.classList.toggle('active', index === activeIndex);
      element.setAttribute('aria-selected', String(index === activeIndex));
    });
  }

  function show() {
    const { games, ...context } = getContext();
    items = rankConditions(games, { ...context, query: input.value });
    activeIndex = -1;

    if (!items.length) {
      hide();
      return;
    }

    const hasHistory = items.some((item) => item.source === 'history');
    list.innerHTML = `
      <li class="suggestions-header">${hasHistory ? 'Baseado no seu histórico' : 'Ideias de condição de zeramento'}</li>
      ${items
        .map(
          (item, index) => `
            <li role="option" data-index="${index}" aria-selected="false">
              <span class="block text-sm text-gray-900 dark:text-white">${escapeHtml(item.text)}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400">${escapeHtml(describe(item))}</span>
            </li>`
        )
        .join('')}
    `;
    list.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }

  function choose(index) {
    const item = items[index];
    if (item) {
      input.value = item.text;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    hide();
  }

  input.addEventListener('focus', show);
  input.addEventListener('input', show);
  input.addEventListener('blur', () => setTimeout(hide, 120));

  input.addEventListener('keydown', (event) => {
    if (list.classList.contains('hidden')) {
      if (event.key === 'ArrowDown') {
        show();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + step + items.length) % items.length;
      highlight();
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      hide();
    }
  });

  list.addEventListener('mousedown', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) {
      event.preventDefault();
      choose(Number(option.dataset.index));
    }
  });
}
