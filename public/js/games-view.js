import { bulkUpdateGames, removeGame, removeGames, saveGame } from './data.js';
import { openCatalogForm } from './catalog-views.js';
import { statusBadgeClass } from './constants.js';
import { createDataTable } from './datatable.js';
import { openDrawer } from './drawer.js';
import { createImportPanel } from './import-view.js';
import { iconSvg } from './shared/icons.js';
import { store, reload, findById, findScore, sortedStatuses } from './store.js';
import { attachConditionSuggestions } from './suggestions.js';
import { tagChip } from './tag-chip.js';
import { confirmDialog, escapeHtml, formatDate, formatPlayTime, optionsHtml, scoreColor, toast } from './ui.js';

const STAR = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.3l-6.2 3.7 1.6-7-5.4-4.7 7.1-.6L12 2l2.9 6.7 7.1.6-5.4 4.7 1.6 7z"/></svg>';

// Valores especiais dos selects da edição em lote.
const KEEP = '';
const CLEAR = '__clear__';

const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
const dash = '<span class="text-gray-400 dark:text-gray-500">-</span>';

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
      <span class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(score?.label ?? '')}</span>
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

const platformOptions = () => [...store.platforms].sort(byName).map((item) => ({ value: item.id, label: item.name }));
const genreOptions = () => [...store.genres].sort(byName).map((item) => ({ value: item.id, label: item.name }));
const statusOptions = () => sortedStatuses().map((status) => ({ value: status.id, label: status.name }));
const difficultyOptions = () =>
  [...store.difficulties].sort((a, b) => a.order - b.order).map((item) => ({ value: item.id, label: `${item.key} — ${item.label}` }));

function typeOptions(genreId) {
  return [...store.types]
    .filter((type) => !type.genreId || !genreId || type.genreId === genreId)
    .sort(byName)
    .map((type) => {
      const genre = !genreId && type.genreId ? findById('genres', type.genreId)?.name : null;
      return { value: type.id, label: genre ? `${type.name} (${genre})` : type.name };
    });
}

function tagToggles(name, tags, selected = new Set()) {
  return tags
    .map(
      (tag) => `
        <label class="tag-toggle">
          <input type="checkbox" name="${name}" value="${escapeHtml(tag.id)}" class="sr-only"${selected.has(tag.id) ? ' checked' : ''} />
          ${tagChip(tag)}
        </label>`
    )
    .join('');
}

const quickAddButton = (collection, label) =>
  `<button type="button" data-quick-add="${collection}" class="btn-secondary shrink-0 px-3" title="${label}" aria-label="${label}">${iconSvg('plus', 'h-4 w-4')}</button>`;

const GAME_FORM_HTML = `
  <form data-role="game-form" novalidate class="flex flex-1 flex-col">
    <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
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
        <div class="flex gap-2"><select id="game-platform" name="platformId" class="input-field"></select>${quickAddButton('platforms', 'Nova plataforma')}</div>
      </div>

      <div class="field">
        <label for="game-genre">Gênero</label>
        <div class="flex gap-2"><select id="game-genre" name="genreId" class="input-field"></select>${quickAddButton('genres', 'Novo gênero')}</div>
      </div>

      <div class="field">
        <label for="game-type">Tipo</label>
        <div class="flex gap-2"><select id="game-type" name="typeId" class="input-field"></select>${quickAddButton('types', 'Novo tipo')}</div>
      </div>

      <div class="field">
        <label for="game-start">Data de início</label>
        <input id="game-start" name="startDate" type="date" class="input-field" />
      </div>

      <div class="field">
        <label for="game-end">Data de término</label>
        <input id="game-end" name="endDate" type="date" class="input-field" />
      </div>

      <p class="hint -mt-2 mb-4 sm:col-span-2">As datas são opcionais (ex.: jogos na lista de desejo ou planejados).</p>

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
        <p class="hint">Ao focar ou digitar, sugerimos condições usadas em jogos parecidos do seu histórico.</p>
      </div>

      <div class="field sm:col-span-2">
        <div class="mb-2 flex items-center justify-between gap-2">
          <span id="game-tags-label" class="text-sm font-medium text-gray-900 dark:text-white">Tags</span>
          <button type="button" data-quick-add="tags" class="btn-secondary btn-sm">${iconSvg('plus', 'h-4 w-4')} Nova tag</button>
        </div>
        <div data-role="tag-options" class="flex flex-wrap gap-2" role="group" aria-labelledby="game-tags-label"></div>
      </div>

      <div class="field sm:col-span-2">
        <label for="game-notes">Observações</label>
        <textarea id="game-notes" name="notes" rows="3" maxlength="2000" class="input-field"></textarea>
      </div>

      <div class="field sm:col-span-2">
        <label class="goty-toggle">
          <input type="checkbox" name="isGoty" class="peer sr-only" />
          <span class="goty-box peer-checked:border-amber-400 peer-checked:bg-amber-400 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">${STAR}</span>
          <span>
            <span class="block text-sm font-medium text-gray-900 dark:text-white">Destaque / GOTY</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">Marque como "meu jogo do ano".</span>
          </span>
        </label>
      </div>
    </div>

    <p data-role="form-error" class="form-error hidden" role="alert"></p>

    <div class="mt-auto flex gap-3 pt-4">
      <button type="submit" class="btn-primary w-full">Salvar</button>
      <button type="button" data-role="cancel" class="btn-secondary w-full">Cancelar</button>
    </div>
  </form>
`;

function bulkSelect(id, label, options, { clearable = true } = {}) {
  const extra = clearable ? [{ value: CLEAR, label: '— Remover —' }] : [];
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <select id="${id}" name="${id}" class="input-field">${optionsHtml([...extra, ...options], KEEP, 'Não alterar')}</select>
    </div>`;
}

function readBulkSelect(value) {
  if (value === KEEP) {
    return undefined;
  }
  return value === CLEAR ? null : value;
}

export function createGamesView(root) {
  root.innerHTML = `
    <div data-role="list"></div>
    <div data-role="import-view" class="hidden"></div>
  `;

  const listView = root.querySelector('[data-role="list"]');
  const importView = root.querySelector('[data-role="import-view"]');
  const importPanel = createImportPanel(importView, { onClose: () => showList() });

  const table = createDataTable(listView, {
    getRows: () => store.games,
    searchText: (game) => `${game.title} ${game.completionCondition} ${game.notes} ${gameTags(game).map((tag) => tag.name).join(' ')}`,
    searchPlaceholder: 'Buscar por nome, condição, observação ou tag...',
    defaultSort: null,
    itemLabel: 'jogo(s)',
    toolbarEnd: `
      <button type="button" data-role="import" class="btn-secondary">${iconSvg('upload', 'h-4 w-4')} Importar JSON</button>
      <button type="button" data-role="create" class="btn-primary">${iconSvg('plus', 'h-4 w-4')} Adicionar jogo</button>`,
    selectable: true,
    bulkActions: [
      { id: 'edit', label: 'Editar em lote', icon: 'square-pen', variant: 'primary', onClick: (rows) => openBulkEdit(rows) },
      {
        id: 'delete',
        label: 'Excluir selecionados',
        icon: 'trash-2',
        variant: 'danger',
        onClick: async (rows) => {
          if (!(await confirmDialog(`Excluir ${rows.length} jogo(s)? Essa ação não pode ser desfeita.`))) {
            return;
          }
          try {
            const removed = await removeGames(rows.map((game) => game.id));
            await reload('games');
            table.clearSelection();
            toast(`${removed} jogo(s) excluído(s).`);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
    columns: [
      {
        key: 'title',
        label: 'Nome',
        sortable: true,
        render: (game) => `
          <span class="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
            ${game.isGoty ? `<span class="text-amber-500" title="GOTY - meu jogo do ano">${STAR}</span>` : ''}
            ${escapeHtml(game.title)}
          </span>
          ${game.completionCondition ? `<span class="block text-xs text-gray-500 dark:text-gray-400">${escapeHtml(game.completionCondition)}</span>` : ''}
          ${gameTags(game).length ? `<span class="mt-1 flex flex-wrap gap-1">${gameTags(game).map((tag) => tagChip(tag)).join('')}</span>` : ''}`,
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
          return `${escapeHtml(genre ?? '-')}${type ? `<span class="block text-xs text-gray-500 dark:text-gray-400">${escapeHtml(type)}</span>` : ''}`;
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
      { id: 'platform', label: 'Plataforma', type: 'select', options: platformOptions, predicate: (game, value) => game.platformId === value },
      { id: 'genre', label: 'Gênero', type: 'select', options: genreOptions, predicate: (game, value) => game.genreId === value },
      { id: 'status', label: 'Status', type: 'select', options: statusOptions, predicate: (game, value) => game.status === value },
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
      { id: 'edit', label: 'Editar', onClick: (game) => openGameForm(game) },
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

  // ---------- Formulário (drawer) ----------

  function openGameForm(game = null) {
    const drawer = openDrawer({ title: game ? 'Editar jogo' : 'Adicionar jogo', width: 'max-w-2xl', body: GAME_FORM_HTML });
    const form = drawer.body.querySelector('[data-role="game-form"]');
    const fields = form.elements;
    const tagOptions = form.querySelector('[data-role="tag-options"]');
    const formError = form.querySelector('[data-role="form-error"]');

    function populateSelects(values) {
      fields.status.innerHTML = optionsHtml(statusOptions(), values.status);
      fields.platformId.innerHTML = optionsHtml(platformOptions(), values.platformId, 'Selecione');
      fields.genreId.innerHTML = optionsHtml(genreOptions(), values.genreId, 'Selecione');
      fields.typeId.innerHTML = optionsHtml(typeOptions(values.genreId), values.typeId, 'Selecione');
      fields.difficultyId.innerHTML = optionsHtml(difficultyOptions(), values.difficultyId, 'Sem dificuldade');
      fields.score.innerHTML = optionsHtml(
        [...store.scores].sort((a, b) => b.value - a.value).map((item) => ({ value: item.value, label: `${item.value} — ${item.label}` })),
        values.score,
        'Sem nota'
      );

      const tags = [...store.tags].sort(byName);
      tagOptions.innerHTML = tags.length
        ? tagToggles('tagIds', tags, new Set(values.tagIds || []))
        : '<p class="muted">Nenhuma tag cadastrada. Use "Nova tag" ou o menu Cadastros &gt; Tags.</p>';
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

    const values = game ? { ...game, playTime: formatPlayTime(game.playTimeSeconds) } : { status: 'planned' };
    populateSelects(values);
    fields.title.value = values.title ?? '';
    fields.startDate.value = values.startDate ?? '';
    fields.endDate.value = values.endDate ?? '';
    fields.playTime.value = values.playTime ?? '';
    fields.completionCondition.value = values.completionCondition ?? '';
    fields.notes.value = values.notes ?? '';
    fields.isGoty.checked = Boolean(values.isGoty);

    fields.genreId.addEventListener('change', () => {
      const current = currentValues();
      const type = findById('types', current.typeId);
      if (type?.genreId && current.genreId && type.genreId !== current.genreId) {
        current.typeId = '';
      }
      fields.typeId.innerHTML = optionsHtml(typeOptions(current.genreId), current.typeId, 'Selecione');
    });

    fields.typeId.addEventListener('change', () => {
      const type = findById('types', fields.typeId.value);
      if (type?.genreId && !fields.genreId.value) {
        populateSelects({ ...currentValues(), genreId: type.genreId });
      }
    });

    attachConditionSuggestions(fields.completionCondition, () => ({
      games: store.games,
      genreId: fields.genreId.value || null,
      typeId: fields.typeId.value || null,
      platformId: fields.platformId.value || null,
      excludeGameId: game?.id ?? null,
    }));

    form.querySelectorAll('[data-quick-add]').forEach((button) => {
      button.addEventListener('click', async () => {
        const collection = button.dataset.quickAdd;
        const saved = await openCatalogForm(collection);
        if (!saved) {
          return;
        }
        const current = currentValues();
        if (collection === 'tags') {
          populateSelects({ ...current, tagIds: [...current.tagIds, saved.id] });
          return;
        }
        const field = { platforms: 'platformId', genres: 'genreId', types: 'typeId' }[collection];
        populateSelects({ ...current, [field]: saved.id, ...(saved.genreId && collection === 'types' ? { genreId: saved.genreId } : {}) });
      });
    });

    form.querySelector('[data-role="cancel"]').addEventListener('click', drawer.close);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('');

      const current = currentValues();
      if (!current.title.trim()) {
        showError('O nome do jogo é obrigatório.');
        fields.title.focus();
        return;
      }

      if (current.startDate && current.endDate && current.endDate < current.startDate) {
        showError('A data de término não pode ser anterior à data de início.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;

      try {
        await saveGame(current, game ? findById('games', game.id) : null);
        await reload('games');
        toast('Jogo salvo com sucesso.');
        drawer.close();
      } catch (error) {
        showError(error.message);
        submitButton.disabled = false;
      }
    });

    fields.title.focus();
  }

  // ---------- Edição em lote (drawer) ----------

  function openBulkEdit(games) {
    const tags = [...store.tags].sort(byName);
    const usedTagIds = new Set(games.flatMap((game) => game.tagIds));
    const usedTags = tags.filter((tag) => usedTagIds.has(tag.id));

    const drawer = openDrawer({
      title: `Editar ${games.length} jogo(s)`,
      width: 'max-w-lg',
      body: `
        <form data-role="bulk-form" novalidate class="flex flex-1 flex-col">
          <p class="mb-5 rounded-lg bg-primary-50 p-3 text-sm text-primary-800 dark:bg-gray-700 dark:text-primary-300">
            Só os campos alterados serão aplicados. "Não alterar" mantém o valor de cada jogo.
          </p>
          ${bulkSelect('status', 'Status', statusOptions(), { clearable: false })}
          ${bulkSelect('platformId', 'Plataforma', platformOptions())}
          ${bulkSelect('genreId', 'Gênero', genreOptions())}
          ${bulkSelect('typeId', 'Tipo', typeOptions(null))}
          <p class="hint -mt-2 mb-4">Um tipo ligado a um gênero também define o gênero. Ao trocar o gênero, tipos de outro gênero são removidos.</p>
          ${bulkSelect('difficultyId', 'Dificuldade', difficultyOptions())}
          <div class="field">
            <label for="bulk-goty">Destaque / GOTY</label>
            <select id="bulk-goty" name="isGoty" class="input-field">${optionsHtml(
              [
                { value: 'true', label: 'Marcar como GOTY' },
                { value: 'false', label: 'Remover GOTY' },
              ],
              KEEP,
              'Não alterar'
            )}</select>
          </div>
          <div class="field">
            <span class="field-label">Adicionar tags</span>
            <div class="flex flex-wrap gap-2">${tags.length ? tagToggles('addTagIds', tags) : '<p class="muted">Nenhuma tag cadastrada.</p>'}</div>
          </div>
          <div class="field">
            <span class="field-label">Remover tags</span>
            <div class="flex flex-wrap gap-2">${usedTags.length ? tagToggles('removeTagIds', usedTags) : '<p class="muted">Os jogos selecionados não têm tags.</p>'}</div>
          </div>
          <p data-role="form-error" class="form-error hidden" role="alert"></p>
          <div class="mt-auto flex gap-3 pt-4">
            <button type="submit" class="btn-primary w-full">Aplicar a ${games.length} jogo(s)</button>
            <button type="button" data-role="cancel" class="btn-secondary w-full">Cancelar</button>
          </div>
        </form>`,
    });

    const form = drawer.body.querySelector('[data-role="bulk-form"]');
    const formError = form.querySelector('[data-role="form-error"]');
    form.querySelector('[data-role="cancel"]').addEventListener('click', drawer.close);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fields = form.elements;
      const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
      const changes = {
        status: readBulkSelect(fields.status.value),
        platformId: readBulkSelect(fields.platformId.value),
        genreId: readBulkSelect(fields.genreId.value),
        typeId: readBulkSelect(fields.typeId.value),
        difficultyId: readBulkSelect(fields.difficultyId.value),
        isGoty: fields.isGoty.value === KEEP ? undefined : fields.isGoty.value === 'true',
        addTagIds: checked('addTagIds'),
        removeTagIds: checked('removeTagIds'),
      };

      const nothing =
        ['status', 'platformId', 'genreId', 'typeId', 'difficultyId', 'isGoty'].every((key) => changes[key] === undefined) &&
        !changes.addTagIds.length &&
        !changes.removeTagIds.length;
      if (nothing) {
        formError.textContent = 'Escolha pelo menos uma alteração.';
        formError.classList.remove('hidden');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      formError.classList.add('hidden');

      try {
        const { updated, unchanged } = await bulkUpdateGames(games, changes);
        await reload('games');
        table.clearSelection();
        toast(`${updated} jogo(s) atualizado(s).${unchanged ? ` ${unchanged} já estavam assim.` : ''}`);
        drawer.close();
      } catch (error) {
        formError.textContent = error.message;
        formError.classList.remove('hidden');
        submitButton.disabled = false;
      }
    });
  }

  // ---------- Navegação interna ----------

  function showList() {
    importView.classList.add('hidden');
    listView.classList.remove('hidden');
  }

  listView.querySelector('[data-role="create"]').addEventListener('click', () => openGameForm());
  listView.querySelector('[data-role="import"]').addEventListener('click', () => {
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
