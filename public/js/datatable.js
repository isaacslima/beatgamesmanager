// Tabela no estilo da página de produtos do Flowbite Admin Dashboard: barra de busca/filtros,
// seleção de linhas com ações em lote, ordenação, paginação e ações por linha.
import { iconSvg } from './shared/icons.js';
import { escapeHtml, normalizeText, optionsHtml } from './ui.js';

const ROW_ACTIONS = {
  edit: { icon: 'square-pen', className: 'btn-primary btn-sm' },
  delete: { icon: 'trash-2', className: 'btn-danger btn-sm' },
};

let tableCount = 0;

function isEmptyFilter(value) {
  if (value && typeof value === 'object') {
    return !value.from && !value.to;
  }
  return value === '' || value === false || value === undefined || value === null;
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === '';
}

function compareValues(a, b) {
  if (isEmptyValue(a) || isEmptyValue(b)) {
    return isEmptyValue(a) && isEmptyValue(b) ? 0 : isEmptyValue(a) ? 1 : -1;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

/**
 * columns:      [{ key, label, sortable?, sortValue?(row), render?(row) -> HTML, className? }]
 * filters:      [{ id, label, type: 'select' | 'date-range' | 'checkbox', options?(), predicate(row, value) }]
 * actions:      [{ id: 'edit' | 'delete', label, onClick(row) }]
 * selectable:   mostra checkboxes; bulkActions: [{ id, label, icon, variant: 'primary'|'danger'|'secondary', onClick(rows) }]
 * toolbarEnd:   HTML extra no fim da barra (ex.: botão "Adicionar")
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
    selectable = false,
    bulkActions = [],
    toolbarEnd = '',
    itemLabel = 'registro(s)',
  } = config;

  const prefix = `dt${++tableCount}`;
  const state = {
    search: '',
    filters: {},
    sort: defaultSort ? { ...defaultSort } : null,
    page: 1,
    pageSize: pageSizes[0],
  };
  const selected = new Set();

  function filterHtml(filter) {
    const id = `${prefix}-${filter.id}`;

    if (filter.type === 'date-range') {
      return `
        <div>
          <label for="${id}-from" class="field-label">${escapeHtml(filter.label)}: de</label>
          <input id="${id}-from" type="date" data-filter="${filter.id}" data-part="from" class="input-field" />
        </div>
        <div>
          <label for="${id}-to" class="field-label">até</label>
          <input id="${id}-to" type="date" data-filter="${filter.id}" data-part="to" class="input-field" />
        </div>`;
    }

    if (filter.type === 'checkbox') {
      return `
        <label class="flex cursor-pointer items-center gap-2 pb-3 text-sm font-medium text-gray-900 dark:text-gray-300">
          <input type="checkbox" data-filter="${filter.id}" class="checkbox" />
          ${escapeHtml(filter.label)}
        </label>`;
    }

    return `
      <div>
        <label for="${id}" class="field-label">${escapeHtml(filter.label)}</label>
        <select id="${id}" data-filter="${filter.id}" class="input-field"></select>
      </div>`;
  }

  const bulkVariant = { primary: 'btn-primary', danger: 'btn-danger', secondary: 'btn-secondary' };

  root.innerHTML = `
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 p-4 dark:border-gray-700">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[14rem] flex-1">
            <label for="${prefix}-search" class="sr-only">Buscar</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">${iconSvg('search', 'h-4 w-4')}</span>
              <input id="${prefix}-search" type="search" data-role="search" class="input-field pl-10" placeholder="${escapeHtml(searchPlaceholder)}" />
            </div>
          </div>
          ${filters.length ? `<button type="button" data-role="toggle-filters" class="btn-secondary" aria-expanded="false" aria-controls="${prefix}-filters">${iconSvg('filter', 'h-4 w-4')} Filtros<span data-role="filter-count" class="hidden rounded-full bg-primary-600 px-2 text-xs text-white"></span></button>` : ''}
          ${toolbarEnd}
        </div>
        ${
          filters.length
            ? `<div id="${prefix}-filters" data-role="filters" class="mt-4 hidden flex-wrap items-end gap-3">
                ${filters.map(filterHtml).join('')}
                <button type="button" data-role="clear" class="btn-secondary">Limpar filtros</button>
              </div>`
            : ''
        }
      </div>

      ${
        selectable
          ? `<div data-role="bulk-bar" class="hidden flex-wrap items-center gap-3 border-b border-gray-200 bg-primary-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-700/60" role="region" aria-label="Ações em lote">
              <span data-role="bulk-count" class="text-sm font-medium text-gray-900 dark:text-white"></span>
              <button type="button" data-role="select-all-filtered" class="hidden text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"></button>
              <div class="ms-auto flex flex-wrap gap-2">
                ${bulkActions
                  .map(
                    (action) =>
                      `<button type="button" data-bulk="${action.id}" class="${bulkVariant[action.variant || 'secondary']} btn-sm">${action.icon ? iconSvg(action.icon, 'h-4 w-4') : ''}${escapeHtml(action.label)}</button>`
                  )
                  .join('')}
                <button type="button" data-role="clear-selection" class="btn-secondary btn-sm">Limpar seleção</button>
              </div>
            </div>`
          : ''
      }

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>

      <div data-role="pagination" class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"></div>
    </div>
  `;

  const searchInput = root.querySelector('[data-role="search"]');
  const thead = root.querySelector('thead');
  const tbody = root.querySelector('tbody');
  const pagination = root.querySelector('[data-role="pagination"]');
  const bulkBar = root.querySelector('[data-role="bulk-bar"]');
  const filtersBox = root.querySelector('[data-role="filters"]');
  let currentRows = [];
  let filtered = [];

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

  function computeRows() {
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
          return isEmptyValue(a.value) || isEmptyValue(b.value) ? result : result * direction;
        })
        .map((item) => item.row);
    }

    return rows;
  }

  function renderHead() {
    const cells = [];

    if (selectable) {
      const pageIds = currentRows.map((row) => String(row.id));
      const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
      const someChecked = pageIds.some((id) => selected.has(id));
      cells.push(`
        <th class="w-4 p-4">
          <input type="checkbox" data-role="select-page" class="checkbox" aria-label="Selecionar todos desta página"${allChecked ? ' checked' : ''}${!allChecked && someChecked ? ' data-indeterminate="true"' : ''} />
        </th>`);
    }

    columns.forEach((column) => {
      if (!column.sortable) {
        cells.push(`<th class="${column.className || ''}">${escapeHtml(column.label)}</th>`);
        return;
      }

      const active = state.sort?.key === column.key;
      const arrow = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕';
      const ariaSort = active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      cells.push(`
        <th class="${column.className || ''}" aria-sort="${ariaSort}">
          <button type="button" data-sort="${column.key}" class="sort-btn ${active ? 'text-gray-900 dark:text-white' : ''}">
            ${escapeHtml(column.label)} <span class="text-[0.65rem] ${active ? '' : 'opacity-40'}">${arrow}</span>
          </button>
        </th>`);
    });

    if (actions.length) {
      cells.push('<th class="text-right">Ações</th>');
    }

    thead.innerHTML = `<tr>${cells.join('')}</tr>`;
    const pageCheckbox = thead.querySelector('[data-role="select-page"]');
    if (pageCheckbox) {
      pageCheckbox.indeterminate = pageCheckbox.dataset.indeterminate === 'true';
    }
  }

  function renderBody() {
    const span = columns.length + (actions.length ? 1 : 0) + (selectable ? 1 : 0);

    if (!currentRows.length) {
      tbody.innerHTML = `<tr><td colspan="${span}" class="py-10 text-center text-gray-500 dark:text-gray-400">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }

    tbody.innerHTML = currentRows
      .map((row) => {
        const id = String(row.id);
        const isSelected = selected.has(id);
        const cells = [];

        if (selectable) {
          cells.push(`<td class="w-4 p-4"><input type="checkbox" data-select="${escapeHtml(id)}" class="checkbox" aria-label="Selecionar"${isSelected ? ' checked' : ''} /></td>`);
        }

        columns.forEach((column) => {
          const content = column.render ? column.render(row) : escapeHtml(row[column.key] ?? '-');
          cells.push(`<td class="${column.className || ''}">${content}</td>`);
        });

        if (actions.length) {
          const buttons = actions
            .map((action) => {
              const style = ROW_ACTIONS[action.id] || { className: 'btn-secondary btn-sm' };
              return `
                <button type="button" data-action="${action.id}" data-id="${escapeHtml(id)}" class="${style.className}" aria-label="${escapeHtml(action.label)}">
                  ${style.icon ? iconSvg(style.icon, 'h-4 w-4') : ''}<span class="hidden xl:inline">${escapeHtml(action.label)}</span>
                </button>`;
            })
            .join('');
          cells.push(`<td class="text-right whitespace-nowrap"><div class="inline-flex gap-2">${buttons}</div></td>`);
        }

        return `<tr class="${isSelected ? 'is-selected' : ''}">${cells.join('')}</tr>`;
      })
      .join('');
  }

  function renderPagination(total, totalPages) {
    const first = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const last = Math.min(state.page * state.pageSize, total);

    pagination.innerHTML = `
      <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>Mostrando <span class="font-semibold text-gray-900 dark:text-white">${first}–${last}</span> de <span class="font-semibold text-gray-900 dark:text-white">${total}</span></span>
        <label for="${prefix}-size" class="sr-only">Itens por página</label>
        <select id="${prefix}-size" data-role="page-size" class="input-field w-auto py-1.5">
          ${pageSizes.map((size) => `<option value="${size}"${size === state.pageSize ? ' selected' : ''}>${size} por página</option>`).join('')}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" data-page="prev" class="btn-secondary btn-sm" ${state.page <= 1 ? 'disabled' : ''}>${iconSvg('chevron-left', 'h-4 w-4')} Anterior</button>
        <span class="text-sm text-gray-500 dark:text-gray-400">Página ${state.page} de ${totalPages}</span>
        <button type="button" data-page="next" class="btn-secondary btn-sm" ${state.page >= totalPages ? 'disabled' : ''}>Próxima ${iconSvg('chevron-right', 'h-4 w-4')}</button>
      </div>
    `;
  }

  function renderBulkBar() {
    if (!bulkBar) {
      return;
    }

    bulkBar.classList.toggle('hidden', selected.size === 0);
    bulkBar.classList.toggle('flex', selected.size > 0);
    bulkBar.querySelector('[data-role="bulk-count"]').textContent = `${selected.size} ${itemLabel} selecionado(s)`;

    const selectAll = bulkBar.querySelector('[data-role="select-all-filtered"]');
    const missing = filtered.filter((row) => !selected.has(String(row.id))).length;
    selectAll.classList.toggle('hidden', missing === 0);
    selectAll.textContent = `Selecionar todos os ${filtered.length} resultados`;
  }

  function renderFilterCount() {
    const badge = root.querySelector('[data-role="filter-count"]');
    if (!badge) {
      return;
    }
    const active = filters.filter((filter) => !isEmptyFilter(state.filters[filter.id])).length;
    badge.textContent = String(active);
    badge.classList.toggle('hidden', active === 0);
  }

  function render() {
    // Remove da seleção o que não existe mais (ex.: excluído).
    const existing = new Set(getRows().map((row) => String(row.id)));
    [...selected].forEach((id) => {
      if (!existing.has(id)) {
        selected.delete(id);
      }
    });

    filtered = computeRows();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    const start = (state.page - 1) * state.pageSize;
    currentRows = filtered.slice(start, start + state.pageSize);

    renderHead();
    renderBody();
    renderPagination(filtered.length, totalPages);
    renderBulkBar();
    renderFilterCount();
  }

  function selectedRows() {
    return getRows().filter((row) => selected.has(String(row.id)));
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

    if (target.dataset.role === 'select-page') {
      currentRows.forEach((row) => (target.checked ? selected.add(String(row.id)) : selected.delete(String(row.id))));
      render();
      return;
    }

    if (target.dataset.select !== undefined) {
      if (target.checked) {
        selected.add(target.dataset.select);
      } else {
        selected.delete(target.dataset.select);
      }
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

  function setFiltersOpen(open) {
    if (!filtersBox) {
      return;
    }
    filtersBox.classList.toggle('hidden', !open);
    filtersBox.classList.toggle('flex', open);
    root.querySelector('[data-role="toggle-filters"]').setAttribute('aria-expanded', String(open));
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) {
      return;
    }

    const role = button.dataset.role;

    if (role === 'toggle-filters') {
      setFiltersOpen(filtersBox.classList.contains('hidden'));
      return;
    }

    if (role === 'clear') {
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

    if (role === 'select-all-filtered') {
      filtered.forEach((row) => selected.add(String(row.id)));
      render();
      return;
    }

    if (role === 'clear-selection') {
      selected.clear();
      render();
      return;
    }

    if (button.dataset.bulk) {
      const action = bulkActions.find((item) => item.id === button.dataset.bulk);
      const rows = selectedRows();
      if (action && rows.length) {
        action.onClick(rows);
      }
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
    clearSelection() {
      selected.clear();
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
      setFiltersOpen(true);
      state.page = 1;
      render();
    },
  };
}
