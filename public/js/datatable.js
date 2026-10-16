import { escapeHtml, normalizeText, optionsHtml } from './ui.js';

const ICONS = {
  edit: '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke-linejoin="round"/></svg>',
  delete: '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

let tableCount = 0;

function isEmptyFilter(value) {
  if (value && typeof value === 'object') {
    return !value.from && !value.to;
  }
  return value === '' || value === false || value === undefined || value === null;
}

function compareValues(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';

  if (aEmpty || bEmpty) {
    return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

/**
 * DataTable com busca, filtros, ordenação e paginação no cliente.
 *
 * columns: [{ key, label, sortable?, sortValue?(row), render?(row) -> HTML, className? }]
 * filters: [{ id, label, type: 'select' | 'date-range' | 'checkbox', options?() -> [{value,label}], predicate(row, value) }]
 * actions: [{ id: 'edit' | 'delete', label, onClick(row) }]
 */
export function createDataTable(root, config) {
  const {
    columns,
    getRows,
    searchText,
    searchPlaceholder = 'Buscar...',
    filters = [],
    actions = [],
    emptyMessage = 'Nenhum registro encontrado.',
    defaultSort = null,
    pageSizes = [10, 25, 50, 100],
  } = config;

  const prefix = `dt${++tableCount}`;
  const state = {
    search: '',
    filters: {},
    sort: defaultSort ? { ...defaultSort } : null,
    page: 1,
    pageSize: pageSizes[0],
  };

  function filterHtml(filter) {
    const id = `${prefix}-${filter.id}`;

    if (filter.type === 'date-range') {
      return `
        <div class="field mb-0">
          <label for="${id}-from">${escapeHtml(filter.label)}: de</label>
          <input id="${id}-from" type="date" data-filter="${filter.id}" data-part="from" class="input-field" />
        </div>
        <div class="field mb-0">
          <label for="${id}-to">até</label>
          <input id="${id}-to" type="date" data-filter="${filter.id}" data-part="to" class="input-field" />
        </div>`;
    }

    if (filter.type === 'checkbox') {
      return `
        <label class="flex items-center gap-2 text-sm text-gray-700 pb-2.5 cursor-pointer">
          <input type="checkbox" data-filter="${filter.id}" class="w-4 h-4 accent-blue-600" />
          ${escapeHtml(filter.label)}
        </label>`;
    }

    return `
      <div class="field mb-0">
        <label for="${id}">${escapeHtml(filter.label)}</label>
        <select id="${id}" data-filter="${filter.id}" class="input-field"></select>
      </div>`;
  }

  root.innerHTML = `
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <div class="field mb-0 flex-1 min-w-[12rem]">
        <label for="${prefix}-search">Buscar</label>
        <input id="${prefix}-search" type="search" data-role="search" class="input-field" placeholder="${escapeHtml(searchPlaceholder)}" />
      </div>
      ${filters.map(filterHtml).join('')}
      <button type="button" data-role="clear" class="btn-secondary">Limpar filtros</button>
    </div>
    <div class="overflow-x-auto border border-gray-200 rounded-lg">
      <table class="data-table">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
    <div data-role="pagination" class="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-gray-500"></div>
  `;

  const searchInput = root.querySelector('[data-role="search"]');
  const thead = root.querySelector('thead');
  const tbody = root.querySelector('tbody');
  const pagination = root.querySelector('[data-role="pagination"]');
  let currentRows = [];

  function refreshFilterOptions() {
    filters
      .filter((filter) => filter.type === 'select')
      .forEach((filter) => {
        const select = root.querySelector(`select[data-filter="${filter.id}"]`);
        const options = filter.options();
        const current = state.filters[filter.id] ?? '';
        const stillExists = options.some((option) => String(option.value) === String(current));
        state.filters[filter.id] = stillExists ? current : '';
        select.innerHTML = optionsHtml(options, state.filters[filter.id], 'Todos');
      });
  }

  function filteredRows() {
    const terms = normalizeText(state.search).split(' ').filter(Boolean);

    let rows = getRows().filter((row) => {
      if (terms.length) {
        const haystack = normalizeText(searchText(row));
        if (!terms.every((term) => haystack.includes(term))) {
          return false;
        }
      }

      return filters.every((filter) => {
        const value = state.filters[filter.id];
        return isEmptyFilter(value) || filter.predicate(row, value);
      });
    });

    const column = state.sort && columns.find((item) => item.key === state.sort.key);
    if (column) {
      const getValue = column.sortValue || ((row) => row[column.key]);
      const direction = state.sort.dir === 'desc' ? -1 : 1;
      rows = rows
        .map((row) => ({ row, value: getValue(row) }))
        .sort((a, b) => {
          const result = compareValues(a.value, b.value);
          // Vazios sempre no fim, independentemente da direção.
          const aEmpty = a.value === null || a.value === undefined || a.value === '';
          const bEmpty = b.value === null || b.value === undefined || b.value === '';
          return aEmpty || bEmpty ? result : result * direction;
        })
        .map((item) => item.row);
    }

    return rows;
  }

  function renderHead() {
    const cells = columns.map((column) => {
      if (!column.sortable) {
        return `<th class="${column.className || ''}">${escapeHtml(column.label)}</th>`;
      }

      const active = state.sort?.key === column.key;
      const arrow = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕';
      const ariaSort = active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      return `
        <th class="${column.className || ''}" aria-sort="${ariaSort}">
          <button type="button" data-sort="${column.key}" class="sort-btn ${active ? 'text-blue-600' : ''}">
            ${escapeHtml(column.label)} <span class="text-xs ${active ? '' : 'text-gray-300'}">${arrow}</span>
          </button>
        </th>`;
    });

    if (actions.length) {
      cells.push('<th class="text-right">Ações</th>');
    }

    thead.innerHTML = `<tr>${cells.join('')}</tr>`;
  }

  function renderBody(pageRows) {
    if (!pageRows.length) {
      const span = columns.length + (actions.length ? 1 : 0);
      tbody.innerHTML = `<tr><td colspan="${span}" class="text-center text-gray-500 py-8">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }

    tbody.innerHTML = pageRows
      .map((row) => {
        const cells = columns.map((column) => {
          const content = column.render ? column.render(row) : escapeHtml(row[column.key] ?? '-');
          return `<td class="${column.className || ''}">${content}</td>`;
        });

        if (actions.length) {
          const buttons = actions
            .map(
              (action) => `
                <button type="button" data-action="${action.id}" data-id="${escapeHtml(row.id)}"
                  class="icon-btn ${action.id === 'delete' ? 'icon-btn-danger' : ''}" title="${escapeHtml(action.label)}" aria-label="${escapeHtml(action.label)}">
                  ${ICONS[action.id] || escapeHtml(action.label)}
                </button>`
            )
            .join('');
          cells.push(`<td class="text-right whitespace-nowrap">${buttons}</td>`);
        }

        return `<tr>${cells.join('')}</tr>`;
      })
      .join('');
  }

  function renderPagination(total, totalPages) {
    const first = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const last = Math.min(state.page * state.pageSize, total);

    pagination.innerHTML = `
      <div class="flex items-center gap-2">
        <label for="${prefix}-size">Itens por página</label>
        <select id="${prefix}-size" data-role="page-size" class="input-field w-auto py-1.5">
          ${pageSizes.map((size) => `<option value="${size}"${size === state.pageSize ? ' selected' : ''}>${size}</option>`).join('')}
        </select>
        <span class="ml-2">${first}–${last} de ${total}</span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" data-page="prev" class="btn-secondary py-1.5 text-sm" ${state.page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${state.page} de ${totalPages}</span>
        <button type="button" data-page="next" class="btn-secondary py-1.5 text-sm" ${state.page >= totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    `;
  }

  function render() {
    const rows = filteredRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    const start = (state.page - 1) * state.pageSize;
    currentRows = rows.slice(start, start + state.pageSize);

    renderHead();
    renderBody(currentRows);
    renderPagination(rows.length, totalPages);
  }

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value;
      state.page = 1;
      render();
    }, 150);
  });

  root.addEventListener('change', (event) => {
    const target = event.target;

    if (target.dataset.role === 'page-size') {
      state.pageSize = Number(target.value);
      state.page = 1;
      render();
      return;
    }

    const filterId = target.dataset.filter;
    if (!filterId) {
      return;
    }

    if (target.dataset.part) {
      state.filters[filterId] = { ...(state.filters[filterId] || {}), [target.dataset.part]: target.value };
    } else {
      state.filters[filterId] = target.type === 'checkbox' ? target.checked : target.value;
    }

    state.page = 1;
    render();
  });

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) {
      return;
    }

    if (button.dataset.role === 'clear') {
      state.search = '';
      state.filters = {};
      state.page = 1;
      searchInput.value = '';
      root.querySelectorAll('[data-filter]').forEach((input) => {
        if (input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
      render();
      return;
    }

    if (button.dataset.sort) {
      const key = button.dataset.sort;
      state.sort = state.sort?.key === key && state.sort.dir === 'asc' ? { key, dir: 'desc' } : { key, dir: 'asc' };
      render();
      return;
    }

    if (button.dataset.page) {
      state.page += button.dataset.page === 'next' ? 1 : -1;
      render();
      return;
    }

    if (button.dataset.action) {
      const action = actions.find((item) => item.id === button.dataset.action);
      const row = currentRows.find((item) => String(item.id) === button.dataset.id);
      if (action && row) {
        action.onClick(row);
      }
    }
  });

  refreshFilterOptions();
  render();

  return {
    refresh() {
      refreshFilterOptions();
      render();
    },
    setFilter(filterId, value) {
      state.filters[filterId] = value;
      const input = root.querySelector(`[data-filter="${filterId}"]:not([data-part])`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = value;
        }
      }
      state.page = 1;
      render();
    },
  };
}
