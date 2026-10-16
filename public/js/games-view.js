import { removeGame, saveGame } from './data.js';
import { openCatalogForm } from './catalog-views.js';
import { statusBadgeClass } from './constants.js';
import { createDataTable } from './datatable.js';
import { createImportPanel } from './import-view.js';
import { store, reload, findById, findScore, sortedStatuses } from './store.js';
import { attachConditionSuggestions } from './suggestions.js';
import { tagChip } from './tag-chip.js';
import { confirmDialog, escapeHtml, formatDate, formatPlayTime, optionsHtml, scoreColor, toast } from './ui.js';

const STAR = '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3l-6.2 3.7 1.6-7-5.4-4.7 7.1-.6L12 2l2.9 6.7 7.1.6-5.4 4.7 1.6 7z"/></svg>';

const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
const dash = '<span class="text-gray-400">-</span>';

function gameTags(game) {
  return (game.tagIds || []).map((id) => findById('tags', id)).filter(Boolean).sort(byName);
}

export function statusBadge(status) {
  const item = findById('statuses', status);
  return item ? `<span class="badge ${statusBadgeClass(item.color)}">${escapeHtml(item.name)}</span>` : dash;
}

export function scoreBadge(value) {
  if (value === null || value === undefined) {
    return dash;
  }

  const score = findScore(value);
  return `
    <span class="inline-flex items-center gap-2 whitespace-nowrap">
      <span class="score-pill" style="background:${scoreColor(value)}">${value}</span>
      <span class="text-xs text-gray-500">${escapeHtml(score?.label ?? '')}</span>
    </span>`;
}

function difficultyBadge(id) {
  const difficulty = findById('difficulties', id);
  return difficulty
    ? `<span class="difficulty-pill" title="${escapeHtml(difficulty.label)}">${escapeHtml(difficulty.key)}</span>`
    : dash;
}

// O jogo "ocupa" o intervalo [início, término]; entra no filtro se o intervalo cruzar o período.
function overlapsPeriod(game, { from, to }) {
  const start = game.startDate || game.endDate;
  const end = game.endDate || game.startDate;

  if (!start) {
    return false;
  }

  return (!from || end >= from) && (!to || start <= to);
}


const FORM_HTML = `
  <div class="panel max-w-3xl">
    <div class="flex items-center justify-between gap-4 mb-4">
      <h2 class="panel-title mb-0" data-role="form-title">Cadastrar jogo</h2>
    </div>
    <form data-role="game-form" novalidate>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div class="field sm:col-span-2">
          <label for="game-title">Nome do jogo <span class="text-red-500">*</span></label>
          <input id="game-title" name="title" required maxlength="200" class="input-field" />
        </div>

        <div class="field">
          <label for="game-status">Status <span class="text-red-500">*</span></label>
          <select id="game-status" name="status" required class="input-field"></select>
        </div>

        <div class="field">
          <label for="game-platform">Plataforma</label>
          <div class="flex gap-2">
            <select id="game-platform" name="platformId" class="input-field flex-1"></select>
            <button type="button" data-quick-add="platforms" class="btn-secondary px-3" title="Nova plataforma" aria-label="Nova plataforma">+</button>
          </div>
        </div>

        <div class="field">
          <label for="game-genre">Gênero</label>
          <div class="flex gap-2">
            <select id="game-genre" name="genreId" class="input-field flex-1"></select>
            <button type="button" data-quick-add="genres" class="btn-secondary px-3" title="Novo gênero" aria-label="Novo gênero">+</button>
          </div>
        </div>

        <div class="field">
          <label for="game-type">Tipo</label>
          <div class="flex gap-2">
            <select id="game-type" name="typeId" class="input-field flex-1"></select>
            <button type="button" data-quick-add="types" class="btn-secondary px-3" title="Novo tipo" aria-label="Novo tipo">+</button>
          </div>
        </div>

        <div class="field">
          <label for="game-start">Data de início</label>
          <input id="game-start" name="startDate" type="date" class="input-field" />
        </div>

        <div class="field">
          <label for="game-end">Data de término</label>
          <input id="game-end" name="endDate" type="date" class="input-field" />
        </div>

        <p data-role="dates-hint" class="sm:col-span-2 -mt-2 mb-4 text-xs text-gray-500">As datas são opcionais (ex.: jogos na lista de desejo ou planejados).</p>

        <div class="field">
          <label for="game-playtime">Tempo total</label>
          <input id="game-playtime" name="playTime" class="input-field" placeholder="HH:MM:SS ou horas (ex.: 12,5)" />
        </div>

        <div class="field">
          <label for="game-difficulty">Dificuldade</label>
          <select id="game-difficulty" name="difficultyId" class="input-field"></select>
        </div>

        <div class="field sm:col-span-2">
          <label for="game-score">Nota</label>
          <select id="game-score" name="score" class="input-field"></select>
        </div>

        <div class="field sm:col-span-2">
          <label for="game-condition">Condição de zeramento</label>
          <div>
            <input id="game-condition" name="completionCondition" maxlength="300" class="input-field" placeholder="Ex.: Ver os créditos, conquistar as 80 estrelas..." />
          </div>
          <p class="text-xs text-gray-500 mt-1">Ao focar ou digitar, sugerimos condições usadas em jogos parecidos do seu histórico.</p>
        </div>

        <div class="field sm:col-span-2">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span id="game-tags-label" class="text-sm font-medium text-gray-700">Tags</span>
            <button type="button" data-quick-add="tags" class="btn-secondary px-3 py-1 text-sm" title="Nova tag" aria-label="Nova tag">+ Nova tag</button>
          </div>
          <div data-role="tag-options" class="flex flex-wrap gap-2" role="group" aria-labelledby="game-tags-label"></div>
        </div>

        <div class="field sm:col-span-2">
          <label for="game-notes">Observações</label>
          <textarea id="game-notes" name="notes" rows="3" maxlength="2000" class="input-field"></textarea>
        </div>

        <div class="field sm:col-span-2">
          <label class="goty-toggle">
            <input type="checkbox" name="isGoty" class="sr-only peer" />
            <span class="goty-box peer-checked:bg-amber-400 peer-checked:text-white peer-checked:border-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">${STAR}</span>
            <span>
              <span class="block text-sm font-medium text-gray-800">Destaque / GOTY</span>
              <span class="block text-xs text-gray-500">Marque como "meu jogo do ano".</span>
            </span>
          </label>
        </div>
      </div>

      <p data-role="form-error" class="hidden text-sm text-red-600 mb-3" role="alert"></p>

      <div class="flex gap-3 mt-2">
        <button type="submit" class="btn-primary">Salvar</button>
        <button type="button" data-role="cancel" class="btn-secondary">Voltar para a lista</button>
      </div>
    </form>
  </div>
`;

export function createGamesView(root) {
  root.innerHTML = `
    <div data-role="list">
      <div class="panel">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="panel-title mb-1">Minha biblioteca</h2>
            <p class="text-sm text-gray-500">Todos os seus jogos, em qualquer status.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-role="import" class="btn-secondary">Importar JSON</button>
            <button type="button" data-role="create" class="btn-primary">+ Adicionar jogo</button>
          </div>
        </div>
        <div data-role="table"></div>
      </div>
    </div>
    <div data-role="form-view" class="hidden">${FORM_HTML}</div>
    <div data-role="import-view" class="hidden"></div>
  `;

  const listView = root.querySelector('[data-role="list"]');
  const formView = root.querySelector('[data-role="form-view"]');
  const importView = root.querySelector('[data-role="import-view"]');
  const importPanel = createImportPanel(importView, { onClose: () => showList() });
  const form = root.querySelector('[data-role="game-form"]');
  const formTitle = root.querySelector('[data-role="form-title"]');
  const formError = root.querySelector('[data-role="form-error"]');
  const fields = form.elements;
  const tagOptions = root.querySelector('[data-role="tag-options"]');
  let editingId = null;

  const table = createDataTable(root.querySelector('[data-role="table"]'), {
    getRows: () => store.games,
    searchText: (game) => `${game.title} ${game.completionCondition} ${game.notes} ${gameTags(game).map((tag) => tag.name).join(' ')}`,
    searchPlaceholder: 'Buscar por nome, condição ou observação...',
    defaultSort: null,
    columns: [
      {
        key: 'title',
        label: 'Nome',
        sortable: true,
        render: (game) => `
          <span class="inline-flex items-center gap-1.5 font-medium text-gray-900">
            ${game.isGoty ? `<span class="text-amber-500" title="GOTY - meu jogo do ano">${STAR}</span>` : ''}
            ${escapeHtml(game.title)}
          </span>
          ${game.completionCondition ? `<span class="block text-xs text-gray-500">${escapeHtml(game.completionCondition)}</span>` : ''}
          ${gameTags(game).length ? `<span class="flex flex-wrap gap-1 mt-1">${gameTags(game).map((tag) => tagChip(tag)).join('')}</span>` : ''}`,
      },
      {
        key: 'platform',
        label: 'Plataforma',
        sortable: true,
        sortValue: (game) => findById('platforms', game.platformId)?.name ?? null,
        render: (game) => escapeHtml(findById('platforms', game.platformId)?.name ?? '-'),
      },
      {
        key: 'genre',
        label: 'Gênero / Tipo',
        sortable: true,
        sortValue: (game) => findById('genres', game.genreId)?.name ?? null,
        render: (game) => {
          const genre = findById('genres', game.genreId)?.name;
          const type = findById('types', game.typeId)?.name;
          if (!genre && !type) {
            return dash;
          }
          return `${escapeHtml(genre ?? '-')}${type ? `<span class="block text-xs text-gray-500">${escapeHtml(type)}</span>` : ''}`;
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        sortValue: (game) => findById('statuses', game.status)?.order ?? null,
        render: (game) => statusBadge(game.status),
      },
      { key: 'startDate', label: 'Início', sortable: true, className: 'whitespace-nowrap', render: (game) => formatDate(game.startDate) },
      { key: 'endDate', label: 'Término', sortable: true, className: 'whitespace-nowrap', render: (game) => formatDate(game.endDate) },
      {
        key: 'playTimeSeconds',
        label: 'Tempo',
        sortable: true,
        className: 'whitespace-nowrap tabular-nums',
        render: (game) => (game.playTimeSeconds === null ? dash : formatPlayTime(game.playTimeSeconds)),
      },
      { key: 'score', label: 'Nota', sortable: true, render: (game) => scoreBadge(game.score) },
      {
        key: 'difficulty',
        label: 'Dific.',
        sortable: true,
        sortValue: (game) => findById('difficulties', game.difficultyId)?.order ?? null,
        render: (game) => difficultyBadge(game.difficultyId),
      },
    ],
    filters: [
      {
        id: 'platform',
        label: 'Plataforma',
        type: 'select',
        options: () => [...store.platforms].sort(byName).map((item) => ({ value: item.id, label: item.name })),
        predicate: (game, value) => game.platformId === value,
      },
      {
        id: 'genre',
        label: 'Gênero',
        type: 'select',
        options: () => [...store.genres].sort(byName).map((item) => ({ value: item.id, label: item.name })),
        predicate: (game, value) => game.genreId === value,
      },
      {
        id: 'status',
        label: 'Status',
        type: 'select',
        options: () => sortedStatuses().map((status) => ({ value: status.id, label: status.name })),
        predicate: (game, value) => game.status === value,
      },
      { id: 'period', label: 'Período', type: 'date-range', predicate: overlapsPeriod },
      {
        id: 'tag',
        label: 'Tag',
        type: 'select',
        options: () => [...store.tags].sort(byName).map((item) => ({ value: item.id, label: item.name })),
        predicate: (game, value) => game.tagIds.includes(value),
      },
      { id: 'goty', label: 'Só GOTY', type: 'checkbox', predicate: (game) => game.isGoty },
    ],
    actions: [
      { id: 'edit', label: 'Editar', onClick: (game) => openForm(game) },
      {
        id: 'delete',
        label: 'Excluir',
        onClick: async (game) => {
          if (!(await confirmDialog(`Excluir "${game.title}"? Essa ação não pode ser desfeita.`))) {
            return;
          }
          try {
            await removeGame(game.id);
            await reload('games');
            toast('Jogo excluído.');
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
  });

  function typeOptions(genreId) {
    return [...store.types]
      .filter((type) => !type.genreId || !genreId || type.genreId === genreId)
      .sort(byName)
      .map((type) => {
        const genre = !genreId && type.genreId ? findById('genres', type.genreId)?.name : null;
        return { value: type.id, label: genre ? `${type.name} (${genre})` : type.name };
      });
  }

  function populateSelects(values) {
    fields.status.innerHTML = optionsHtml(
      sortedStatuses().map((status) => ({ value: status.id, label: status.name })),
      values.status
    );
    fields.platformId.innerHTML = optionsHtml(
      [...store.platforms].sort(byName).map((item) => ({ value: item.id, label: item.name })),
      values.platformId,
      'Selecione'
    );
    fields.genreId.innerHTML = optionsHtml(
      [...store.genres].sort(byName).map((item) => ({ value: item.id, label: item.name })),
      values.genreId,
      'Selecione'
    );
    fields.typeId.innerHTML = optionsHtml(typeOptions(values.genreId), values.typeId, 'Selecione');
    fields.difficultyId.innerHTML = optionsHtml(
      [...store.difficulties]
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ value: item.id, label: `${item.key} — ${item.label}` })),
      values.difficultyId,
      'Sem dificuldade'
    );
    fields.score.innerHTML = optionsHtml(
      [...store.scores].sort((a, b) => b.value - a.value).map((item) => ({ value: item.value, label: `${item.value} — ${item.label}` })),
      values.score,
      'Sem nota'
    );

    const selectedTags = new Set(values.tagIds || []);
    const tags = [...store.tags].sort(byName);
    tagOptions.innerHTML = tags.length
      ? tags
          .map(
            (tag) => `
              <label class="tag-toggle">
                <input type="checkbox" name="tagIds" value="${escapeHtml(tag.id)}" class="sr-only"${selectedTags.has(tag.id) ? ' checked' : ''} />
                ${tagChip(tag)}
              </label>`
          )
          .join('')
      : '<p class="text-sm text-gray-500">Nenhuma tag cadastrada. Use "+ Nova tag" ou o menu Cadastros &gt; Tags.</p>';
  }

  function currentValues() {
    return {
      title: fields.title.value,
      status: fields.status.value,
      platformId: fields.platformId.value,
      genreId: fields.genreId.value,
      typeId: fields.typeId.value,
      startDate: fields.startDate.value,
      endDate: fields.endDate.value,
      playTime: fields.playTime.value,
      score: fields.score.value,
      difficultyId: fields.difficultyId.value,
      completionCondition: fields.completionCondition.value,
      notes: fields.notes.value,
      isGoty: fields.isGoty.checked,
      tagIds: [...tagOptions.querySelectorAll('input[name="tagIds"]:checked')].map((input) => input.value),
    };
  }

  function showError(message) {
    formError.textContent = message;
    formError.classList.toggle('hidden', !message);
  }

  function showList() {
    formView.classList.add('hidden');
    importView.classList.add('hidden');
    listView.classList.remove('hidden');
    editingId = null;
  }

  function openForm(game = null) {
    editingId = game?.id ?? null;
    formTitle.textContent = game ? 'Editar jogo' : 'Cadastrar jogo';
    form.reset();
    showError('');

    const values = game
      ? { ...game, playTime: formatPlayTime(game.playTimeSeconds) }
      : { status: 'planned' };

    populateSelects(values);
    fields.title.value = values.title ?? '';
    fields.startDate.value = values.startDate ?? '';
    fields.endDate.value = values.endDate ?? '';
    fields.playTime.value = values.playTime ?? '';
    fields.completionCondition.value = values.completionCondition ?? '';
    fields.notes.value = values.notes ?? '';
    fields.isGoty.checked = Boolean(values.isGoty);

    listView.classList.add('hidden');
    formView.classList.remove('hidden');
    window.scrollTo({ top: 0 });
    fields.title.focus();
  }

  fields.genreId.addEventListener('change', () => {
    const values = currentValues();
    const type = findById('types', values.typeId);
    if (type?.genreId && values.genreId && type.genreId !== values.genreId) {
      values.typeId = '';
    }
    fields.typeId.innerHTML = optionsHtml(typeOptions(values.genreId), values.typeId, 'Selecione');
  });

  fields.typeId.addEventListener('change', () => {
    const type = findById('types', fields.typeId.value);
    if (type?.genreId && !fields.genreId.value) {
      const values = { ...currentValues(), genreId: type.genreId };
      populateSelects(values);
    }
  });

  attachConditionSuggestions(fields.completionCondition, () => ({
    games: store.games,
    genreId: fields.genreId.value || null,
    typeId: fields.typeId.value || null,
    platformId: fields.platformId.value || null,
    excludeGameId: editingId,
  }));

  form.querySelectorAll('[data-quick-add]').forEach((button) => {
    button.addEventListener('click', async () => {
      const collection = button.dataset.quickAdd;
      const saved = await openCatalogForm(collection);
      if (saved) {
        const values = currentValues();
        if (collection === 'tags') {
          populateSelects({ ...values, tagIds: [...values.tagIds, saved.id] });
          return;
        }
        const field = { platforms: 'platformId', genres: 'genreId', types: 'typeId' }[collection];
        populateSelects({ ...values, [field]: saved.id, ...(saved.genreId && collection === 'types' ? { genreId: saved.genreId } : {}) });
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    const values = currentValues();
    if (!values.title.trim()) {
      showError('O nome do jogo é obrigatório.');
      fields.title.focus();
      return;
    }

    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      showError('A data de término não pode ser anterior à data de início.');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      await saveGame(values, editingId ? findById('games', editingId) : null);
      await reload('games');
      toast('Jogo salvo com sucesso.');
      showList();
    } catch (error) {
      showError(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  root.querySelector('[data-role="cancel"]').addEventListener('click', showList);
  root.querySelector('[data-role="create"]').addEventListener('click', () => openForm());
  root.querySelector('[data-role="import"]').addEventListener('click', () => {
    importPanel.reset();
    listView.classList.add('hidden');
    importView.classList.remove('hidden');
    window.scrollTo({ top: 0 });
  });

  return {
    refresh: () => table.refresh(),
    showList,
    filterBy: (filterId, value) => {
      showList();
      table.setFilter(filterId, value);
    },
  };
}
