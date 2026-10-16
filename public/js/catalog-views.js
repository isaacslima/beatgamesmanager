import { removeCatalog, removeCatalogMany, saveCatalog } from './data.js';
import { iconSvg } from './shared/icons.js';
import { PROTECTED_STATUS_IDS, STATUS_COLORS, statusBadgeClass } from './constants.js';
import { createDataTable } from './datatable.js';
import { openFormModal } from './form-modal.js';
import { tagChip } from './tag-chip.js';
import { store, reload, findById, countGamesBy } from './store.js';
import { confirmDialog, escapeHtml, scoreColor, toast } from './ui.js';

const gamesColumn = (field, value = (row) => row.id) => ({
  key: 'games',
  label: 'Jogos',
  sortable: true,
  className: 'text-right w-24',
  sortValue: (row) => countGamesBy(field, value(row)),
  render: (row) => String(countGamesBy(field, value(row))),
});

const descriptionColumn = {
  key: 'description',
  label: 'Descrição',
  render: (row) => (row.description ? escapeHtml(row.description) : '<span class="text-gray-400">-</span>'),
};

const descriptionField = { name: 'description', label: 'Descrição', type: 'textarea' };

function countGamesWithTag(tagId) {
  return store.games.filter((game) => game.tagIds?.includes(tagId)).length;
}

function byName(a, b) {
  return a.name.localeCompare(b.name, 'pt-BR');
}

export const CATALOGS = {
  tags: {
    title: 'Tags',
    singular: 'tag',
    gender: 'f',
    description: 'Etiquetas livres para os jogos (ex.: Co-op, Aconchegante, Difícil pra caramba), com ícone e cor.',
    columns: [
      { key: 'name', label: 'Tag', sortable: true, render: (row) => tagChip(row) },
      descriptionColumn,
      {
        key: 'games',
        label: 'Jogos',
        sortable: true,
        className: 'text-right w-24',
        sortValue: (row) => countGamesWithTag(row.id),
        render: (row) => String(countGamesWithTag(row.id)),
      },
    ],
    defaultSort: { key: 'name', dir: 'asc' },
    searchText: (row) => `${row.name} ${row.description}`,
    fields: () => [
      { name: 'name', label: 'Nome', required: true, maxlength: 40, placeholder: 'Ex.: Co-op' },
      { name: 'icon', label: 'Ícone', type: 'icon' },
      {
        name: 'color',
        label: 'Cor',
        type: 'select',
        placeholder: undefined,
        options: () => STATUS_COLORS.map((color) => ({ value: color.value, label: color.label })),
      },
      descriptionField,
    ],
    defaults: () => ({ icon: 'tag', color: 'blue' }),
    // Excluir uma tag a retira dos jogos.
    deleteMessage: (row) => {
      const count = countGamesWithTag(row.id);
      return count
        ? `Excluir a tag "${row.name}"? Ela será removida de ${count} jogo(s).`
        : `Excluir a tag "${row.name}"?`;
    },
  },

  statuses: {
    title: 'Status',
    singular: 'status',
    gender: 'm',
    description: 'Situações dos jogos (ex.: Lista de Desejo, Jogando, Zerado). Você pode renomear e criar novos.',
    columns: [
      { key: 'order', label: 'Ordem', sortable: true, className: 'w-24' },
      {
        key: 'name',
        label: 'Nome',
        sortable: true,
        render: (row) => `
          <span class="badge ${statusBadgeClass(row.color)}">${escapeHtml(row.name)}</span>
          ${PROTECTED_STATUS_IDS.includes(row.id) ? '<span class="ml-2 text-xs text-gray-400" title="Usado nos cards do dashboard: pode ser renomeado, mas não excluído">fixo</span>' : ''}`,
      },
      descriptionColumn,
      gamesColumn('status'),
    ],
    defaultSort: { key: 'order', dir: 'asc' },
    searchText: (row) => `${row.name} ${row.description}`,
    fields: () => [
      { name: 'name', label: 'Nome', required: true, maxlength: 80, placeholder: 'Ex.: Jogando' },
      {
        name: 'color',
        label: 'Cor',
        type: 'select',
        placeholder: undefined,
        options: () => STATUS_COLORS.map((color) => ({ value: color.value, label: color.label })),
      },
      { name: 'order', label: 'Ordem', type: 'number', min: 0, required: true, hint: 'Posição nas listas e filtros.' },
      descriptionField,
    ],
    defaults: () => ({ color: 'amber', order: Math.max(0, ...store.statuses.map((item) => item.order)) + 1 }),
  },

  platforms: {
    title: 'Plataformas',
    singular: 'plataforma',
    gender: 'f',
    description: 'Consoles e plataformas onde você joga (ex.: Switch, PC, NDS, SG-1000).',
    columns: [
      {
        key: 'imageUrl',
        label: '',
        className: 'w-14',
        render: (row) =>
          row.imageUrl
            ? `<img src="${escapeHtml(row.imageUrl)}" alt="" class="h-9 w-9 rounded-lg border border-gray-200 object-cover dark:border-gray-600" />`
            : '<span class="inline-flex w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700"></span>',
      },
      { key: 'name', label: 'Nome', sortable: true, render: (row) => `<span class="font-medium">${escapeHtml(row.name)}</span>` },
      gamesColumn('platformId'),
    ],
    defaultSort: { key: 'name', dir: 'asc' },
    searchText: (row) => row.name,
    fields: (record) => [
      { name: 'name', label: 'Nome', required: true, maxlength: 80 },
      ...(record?.imageUrl
        ? [
            {
              type: 'html',
              name: '_preview',
              html: `<img src="${escapeHtml(record.imageUrl)}" alt="Imagem atual" class="h-16 w-16 rounded-lg border border-gray-200 object-cover dark:border-gray-600" />`,
            },
            { name: 'removeImage', label: 'Remover imagem atual', type: 'checkbox' },
          ]
        : []),
      { name: 'image', label: record?.imageUrl ? 'Nova imagem' : 'Imagem', type: 'file', accept: 'image/*', hint: 'Opcional. Até 4 MB.' },
    ],
  },

  genres: {
    title: 'Gêneros',
    singular: 'gênero',
    gender: 'm',
    description: 'Gêneros dos jogos (ex.: RPG, Ação, Plataforma).',
    columns: [
      { key: 'name', label: 'Nome', sortable: true, render: (row) => `<span class="font-medium">${escapeHtml(row.name)}</span>` },
      descriptionColumn,
      {
        key: 'types',
        label: 'Tipos',
        sortable: true,
        className: 'text-right w-24',
        sortValue: (row) => store.types.filter((type) => type.genreId === row.id).length,
        render: (row) => String(store.types.filter((type) => type.genreId === row.id).length),
      },
      gamesColumn('genreId'),
    ],
    defaultSort: { key: 'name', dir: 'asc' },
    searchText: (row) => `${row.name} ${row.description}`,
    fields: () => [{ name: 'name', label: 'Nome', required: true, maxlength: 80 }, descriptionField],
  },

  types: {
    title: 'Tipos',
    singular: 'tipo',
    gender: 'm',
    description: 'Subcategorias de gêneros (ex.: Ação RPG, Exploratório, Vida).',
    columns: [
      { key: 'name', label: 'Nome', sortable: true, render: (row) => `<span class="font-medium">${escapeHtml(row.name)}</span>` },
      {
        key: 'genreId',
        label: 'Gênero',
        sortable: true,
        sortValue: (row) => findById('genres', row.genreId)?.name ?? null,
        render: (row) => escapeHtml(findById('genres', row.genreId)?.name ?? '-'),
      },
      descriptionColumn,
      gamesColumn('typeId'),
    ],
    defaultSort: { key: 'name', dir: 'asc' },
    searchText: (row) => `${row.name} ${row.description} ${findById('genres', row.genreId)?.name ?? ''}`,
    filters: [
      {
        id: 'genre',
        label: 'Gênero',
        type: 'select',
        options: () => [...store.genres].sort(byName).map((genre) => ({ value: genre.id, label: genre.name })),
        predicate: (row, value) => row.genreId === value,
      },
    ],
    fields: () => [
      { name: 'name', label: 'Nome', required: true, maxlength: 80 },
      {
        name: 'genreId',
        label: 'Gênero',
        type: 'select',
        placeholder: 'Sem gênero (vale para todos)',
        options: () => [...store.genres].sort(byName).map((genre) => ({ value: genre.id, label: genre.name })),
      },
      descriptionField,
    ],
  },

  scores: {
    title: 'Notas / Avaliações',
    singular: 'nota',
    gender: 'f',
    description: 'Escala de pontuação de 1 a 11, de "Tragédia" até "Jogo da vida".',
    columns: [
      {
        key: 'value',
        label: 'Nota',
        sortable: true,
        className: 'w-24',
        render: (row) => `<span class="score-pill" style="background:${scoreColor(row.value)}">${row.value}</span>`,
      },
      { key: 'label', label: 'Rótulo', sortable: true, render: (row) => `<span class="font-medium">${escapeHtml(row.label)}</span>` },
      descriptionColumn,
      gamesColumn('score', (row) => row.value),
    ],
    defaultSort: { key: 'value', dir: 'desc' },
    searchText: (row) => `${row.value} ${row.label} ${row.description}`,
    fields: (record) => [
      {
        name: 'value',
        label: 'Valor (1 a 11)',
        type: 'number',
        min: 1,
        max: 11,
        required: true,
        readonly: Boolean(record),
        hint: record ? 'O valor não pode ser alterado depois de criado.' : undefined,
      },
      { name: 'label', label: 'Rótulo', required: true, maxlength: 60, placeholder: 'Ex.: Jogo da vida' },
      descriptionField,
    ],
  },

  difficulties: {
    title: 'Níveis de Dificuldade',
    singular: 'dificuldade',
    gender: 'f',
    description: 'Escala de dificuldade (ex.: C/Fácil até AAA/Imperdoável).',
    columns: [
      { key: 'order', label: 'Ordem', sortable: true, className: 'w-24' },
      { key: 'key', label: 'Chave', sortable: true, render: (row) => `<span class="difficulty-pill">${escapeHtml(row.key)}</span>` },
      { key: 'label', label: 'Nome', sortable: true, render: (row) => `<span class="font-medium">${escapeHtml(row.label)}</span>` },
      descriptionColumn,
      gamesColumn('difficultyId'),
    ],
    defaultSort: { key: 'order', dir: 'asc' },
    searchText: (row) => `${row.key} ${row.label} ${row.description}`,
    fields: () => [
      { name: 'key', label: 'Chave', required: true, maxlength: 10, placeholder: 'Ex.: AA' },
      { name: 'label', label: 'Nome', required: true, maxlength: 60, placeholder: 'Ex.: Difícil' },
      { name: 'order', label: 'Ordem', type: 'number', min: 0, required: true, hint: 'Define a posição na escala (menor = mais fácil).' },
      descriptionField,
    ],
    defaults: () => ({ order: Math.max(0, ...store.difficulties.map((item) => item.order)) + 1 }),
  },
};

function words(catalog) {
  const masculine = catalog.gender === 'm';
  return {
    new: masculine ? 'Novo' : 'Nova',
    saved: masculine ? 'salvo' : 'salva',
    none: masculine ? `Nenhum ${catalog.singular} encontrado.` : `Nenhuma ${catalog.singular} encontrada.`,
  };
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

/** Abre o formulário de criação/edição. Resolve com o registro salvo, ou null se cancelado. */
export async function openCatalogForm(name, record = null) {
  const catalog = CATALOGS[name];
  const text = words(catalog);
  const values = record ? { ...record } : { ...(catalog.defaults?.() || {}) };

  const saved = await openFormModal({
    title: record ? `Editar ${catalog.singular}` : `${text.new} ${catalog.singular}`,
    fields: catalog.fields(record),
    values,
    onSubmit: (formValues) => saveCatalog(name, formValues, record),
  });

  if (saved) {
    await reload(name);
    toast(`${capitalize(catalog.singular)} ${text.saved} com sucesso.`);
  }

  return saved;
}

export function createCatalogView(name, root) {
  const catalog = CATALOGS[name];
  const text = words(catalog);
  const reloadAfterDelete = () => reload(name, ...(catalog.deleteMessage ? ['games'] : []));

  const table = createDataTable(root, {
    columns: catalog.columns,
    getRows: () => store[name],
    searchText: catalog.searchText,
    searchPlaceholder: `Buscar ${catalog.singular}...`,
    filters: catalog.filters || [],
    defaultSort: catalog.defaultSort,
    emptyMessage: text.none,
    itemLabel: 'registro(s)',
    toolbarEnd: `<button type="button" data-role="create" class="btn-primary">${iconSvg('plus', 'h-4 w-4')} ${text.new} ${escapeHtml(catalog.singular)}</button>`,
    selectable: true,
    bulkActions: [
      {
        id: 'delete',
        label: 'Excluir selecionados',
        icon: 'trash-2',
        variant: 'danger',
        onClick: async (rows) => {
          if (!(await confirmDialog(`Excluir ${rows.length} registro(s)? Registros em uso por jogos serão mantidos.`))) {
            return;
          }

          const { removed, failed } = await removeCatalogMany(name, rows);
          await reloadAfterDelete();
          table.clearSelection();

          if (removed) {
            toast(`${removed} registro(s) excluído(s).`);
          }
          if (failed.length) {
            const names = failed.map(({ record }) => record.name || record.label).join(', ');
            toast(`${failed.length} não excluído(s) por estarem em uso ou protegidos: ${names}.`, 'error');
          }
        },
      },
    ],
    actions: [
      { id: 'edit', label: 'Editar', onClick: (row) => openCatalogForm(name, row) },
      {
        id: 'delete',
        label: 'Excluir',
        onClick: async (row) => {
          const label = row.name || row.label;
          const message = catalog.deleteMessage?.(row) ?? `Excluir "${label}"? Essa ação não pode ser desfeita.`;
          if (!(await confirmDialog(message))) {
            return;
          }

          try {
            await removeCatalog(name, row);
            await reloadAfterDelete();
            toast('Registro excluído.');
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
    ],
  });

  root.querySelector('[data-role="create"]').addEventListener('click', () => openCatalogForm(name));

  return table;
}
