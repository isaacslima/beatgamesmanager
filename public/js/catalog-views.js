import { api } from './api.js';
import { createDataTable } from './datatable.js';
import { openFormModal } from './form-modal.js';
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

function byName(a, b) {
  return a.name.localeCompare(b.name, 'pt-BR');
}

export const CATALOGS = {
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
            ? `<img src="${escapeHtml(row.imageUrl)}" alt="" class="w-9 h-9 object-cover rounded-lg border border-gray-200" />`
            : '<span class="inline-flex w-9 h-9 rounded-lg bg-gray-100"></span>',
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
              html: `<img src="${escapeHtml(record.imageUrl)}" alt="Imagem atual" class="w-16 h-16 object-cover rounded-lg border border-gray-200" />`,
            },
            { name: 'removeImage', label: 'Remover imagem atual', type: 'checkbox' },
          ]
        : []),
      { name: 'image', label: record?.imageUrl ? 'Nova imagem' : 'Imagem', type: 'file', accept: 'image/*', hint: 'Opcional. Até 5 MB.' },
    ],
    toPayload(values) {
      const formData = new FormData();
      formData.append('name', values.name);
      if (values.image) {
        formData.append('image', values.image);
      }
      if (values.removeImage) {
        formData.append('removeImage', 'true');
      }
      return formData;
    },
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
    toPayload: (values) => values,
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
    toPayload: (values) => values,
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
    toPayload: (values) => values,
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
    toPayload: (values) => values,
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
    onSubmit: (formValues) => {
      const payload = catalog.toPayload(formValues);
      return record ? api.put(`/api/${name}/${record.id}`, payload) : api.post(`/api/${name}`, payload);
    },
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

  root.innerHTML = `
    <div class="panel">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="panel-title mb-1">${escapeHtml(catalog.title)}</h2>
          <p class="text-sm text-gray-500">${escapeHtml(catalog.description)}</p>
        </div>
        <button type="button" data-role="create" class="btn-primary">+ ${text.new} ${escapeHtml(catalog.singular)}</button>
      </div>
      <div data-role="table"></div>
    </div>
  `;

  const table = createDataTable(root.querySelector('[data-role="table"]'), {
    columns: catalog.columns,
    getRows: () => store[name],
    searchText: catalog.searchText,
    searchPlaceholder: `Buscar ${catalog.singular}...`,
    filters: catalog.filters || [],
    defaultSort: catalog.defaultSort,
    emptyMessage: text.none,
    actions: [
      { id: 'edit', label: 'Editar', onClick: (row) => openCatalogForm(name, row) },
      {
        id: 'delete',
        label: 'Excluir',
        onClick: async (row) => {
          const label = row.name || row.label;
          const confirmed = await confirmDialog(`Excluir "${label}"? Essa ação não pode ser desfeita.`);
          if (!confirmed) {
            return;
          }

          try {
            await api.del(`/api/${name}/${row.id}`);
            await reload(name);
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
