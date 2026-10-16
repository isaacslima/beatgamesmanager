import { api } from './api.js';
import { findById, reload, sortedStatuses } from './store.js';
import { escapeHtml, formatDate, formatPlayTime, scoreColor, toast } from './ui.js';

const FIELDS = [
  ['title', 'Sim', 'Nome do jogo.'],
  ['status', 'Sim', 'Nome de um status cadastrado (sem diferenciar maiúsculas/acentos).'],
  ['platform', 'Não', 'Nome da plataforma. Se não existir, será criada.'],
  ['genre', 'Não', 'Nome do gênero. Se não existir, será criado.'],
  ['type', 'Não', 'Nome do tipo. Se não existir, será criado (ligado ao gênero informado).'],
  ['startDate', 'Não', 'Data de início: AAAA-MM-DD ou DD/MM/AAAA.'],
  ['endDate', 'Não', 'Data de término: AAAA-MM-DD ou DD/MM/AAAA.'],
  ['playTime', 'Não', 'Tempo total: "HH:MM:SS", "HH:MM" ou horas decimais ("12,5").'],
  ['score', 'Não', 'Nota inteira de 1 a 11 (precisa existir na tabela de notas).'],
  ['difficulty', 'Não', 'Chave (C, B, A, AA, AAA) ou nome da dificuldade.'],
  ['completionCondition', 'Não', 'Condição de zeramento (texto livre).'],
  ['isGoty', 'Não', 'true para marcar como GOTY.'],
  ['notes', 'Não', 'Observações.'],
];

function statusName(id, fallback) {
  return findById('statuses', id)?.name ?? fallback;
}

export function exampleGames() {
  return [
    {
      title: 'Super Mario 64',
      status: statusName('completed', 'Zerado'),
      platform: 'Nintendo 64',
      genre: 'Plataforma',
      type: 'Plataforma 3D',
      startDate: '2024-01-05',
      endDate: '2024-02-01',
      playTime: '18:30:00',
      score: 11,
      difficulty: 'B',
      completionCondition: 'Conquiste as 70 estrelas',
      isGoty: true,
      notes: 'Exemplo com todos os campos.',
    },
    {
      title: 'Chrono Trigger',
      status: statusName('planned', 'Planejado para Jogar'),
      platform: 'NDS',
      genre: 'RPG',
      type: 'JRPG',
      playTime: '32,5',
      difficulty: 'Médio',
    },
    {
      title: 'Hollow Knight: Silksong',
      status: statusName('wishlist', 'Lista de Desejo'),
    },
  ];
}

function downloadExample() {
  const blob = new Blob([`${JSON.stringify(exampleGames(), null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'beatgames-importacao-exemplo.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const newTag = '<span class="ml-1 rounded bg-blue-50 px-1 text-[10px] font-semibold uppercase text-blue-700">novo</span>';
const dash = '<span class="text-gray-400">-</span>';

function refCell(name, isNew) {
  return name ? `${escapeHtml(name)}${isNew ? newTag : ''}` : dash;
}

export function createImportPanel(root, { onClose }) {
  root.innerHTML = `
    <div class="panel">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="panel-title mb-1">Importar jogos de um arquivo JSON</h2>
          <p class="text-sm text-gray-500">O arquivo deve conter uma lista de jogos: <code class="text-xs bg-gray-100 rounded px-1">[ { ... }, { ... } ]</code>. Até 1000 jogos por vez.</p>
        </div>
        <div class="flex gap-2">
          <button type="button" data-role="download" class="btn-secondary">Baixar exemplo</button>
          <button type="button" data-role="close" class="btn-secondary">Voltar para a lista</button>
        </div>
      </div>

      <details class="mb-5 rounded-lg border border-gray-200">
        <summary class="cursor-pointer px-4 py-2.5 text-sm font-medium text-gray-700">Campos aceitos</summary>
        <div class="overflow-x-auto border-t border-gray-200">
          <table class="data-table">
            <thead><tr><th>Campo</th><th>Obrigatório</th><th>Formato</th></tr></thead>
            <tbody>
              ${FIELDS.map(
                ([field, required, description]) => `
                  <tr>
                    <td><code class="text-xs">${field}</code></td>
                    <td>${required === 'Sim' ? '<span class="font-medium text-red-600">Sim</span>' : 'Não'}</td>
                    <td>${escapeHtml(description)}</td>
                  </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>
        <p data-role="statuses" class="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-200"></p>
      </details>

      <label data-role="drop" class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40">
        <span class="text-sm font-medium text-gray-700">Clique para selecionar ou arraste o arquivo .json aqui</span>
        <span data-role="file-name" class="text-xs text-gray-500">Nenhum arquivo selecionado</span>
        <input type="file" accept=".json,application/json" class="sr-only" data-role="file" />
      </label>

      <p data-role="error" class="hidden mt-4 text-sm text-red-600" role="alert"></p>
      <div data-role="preview" class="hidden mt-6"></div>
    </div>
  `;

  const fileInput = root.querySelector('[data-role="file"]');
  const fileName = root.querySelector('[data-role="file-name"]');
  const dropZone = root.querySelector('[data-role="drop"]');
  const errorBox = root.querySelector('[data-role="error"]');
  const preview = root.querySelector('[data-role="preview"]');
  let items = null;
  let rows = [];
  const selected = new Set();

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.toggle('hidden', !message);
  }

  function reset() {
    items = null;
    rows = [];
    selected.clear();
    fileInput.value = '';
    fileName.textContent = 'Nenhum arquivo selecionado';
    preview.classList.add('hidden');
    preview.innerHTML = '';
    showError('');
    root.querySelector('[data-role="statuses"]').textContent = `Status cadastrados: ${sortedStatuses().map((status) => status.name).join(', ') || 'nenhum'}.`;
  }

  function updateImportButton() {
    const button = preview.querySelector('[data-role="confirm"]');
    if (button) {
      button.disabled = selected.size === 0;
      button.textContent = `Importar ${selected.size} jogo(s)`;
    }
    const all = preview.querySelector('[data-role="select-all"]');
    if (all) {
      const selectable = rows.filter((row) => row.valid).length;
      all.checked = selectable > 0 && selected.size === selectable;
      all.indeterminate = selected.size > 0 && selected.size < selectable;
    }
  }

  function renderPreview(summary) {
    const toCreate = Object.entries({ Plataformas: summary.toCreate.platforms, Gêneros: summary.toCreate.genres, Tipos: summary.toCreate.types })
      .filter(([, names]) => names.length)
      .map(([label, names]) => `<li><strong>${label}:</strong> ${names.map(escapeHtml).join(', ')}</li>`)
      .join('');

    preview.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <span class="badge bg-gray-100 text-gray-700">${summary.total} no arquivo</span>
        <span class="badge bg-emerald-50 text-emerald-700">${summary.valid} válido(s)</span>
        ${summary.duplicates ? `<span class="badge bg-amber-50 text-amber-700">${summary.duplicates} possível(is) duplicado(s)</span>` : ''}
        ${summary.invalid ? `<span class="badge bg-red-50 text-red-700">${summary.invalid} com erro</span>` : ''}
      </div>
      ${toCreate ? `<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><p class="font-medium mb-1">Cadastros que serão criados:</p><ul class="space-y-0.5">${toCreate}</ul></div>` : ''}
      <p class="mb-3 text-xs text-gray-500">Linhas com erro não podem ser importadas. Possíveis duplicados ficam desmarcados; marque se quiser importar mesmo assim.</p>
      <div class="overflow-x-auto max-h-[32rem] overflow-y-auto border border-gray-200 rounded-lg">
        <table class="data-table">
          <thead class="sticky top-0">
            <tr>
              <th class="w-10"><input type="checkbox" data-role="select-all" class="w-4 h-4 accent-blue-600" aria-label="Selecionar todos os válidos" /></th>
              <th>#</th><th>Nome</th><th>Status</th><th>Plataforma</th><th>Gênero / Tipo</th>
              <th>Início</th><th>Término</th><th>Tempo</th><th>Nota</th><th>Dific.</th><th>Mensagens</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const p = row.preview;
                const rowClass = !row.valid ? 'bg-red-50/60' : row.duplicate ? 'bg-amber-50/60' : '';
                const messages = [
                  ...row.errors.map((message) => `<li class="text-red-700">${escapeHtml(message)}</li>`),
                  ...row.warnings.map((message) => `<li class="text-amber-700">${escapeHtml(message)}</li>`),
                ].join('');
                return `
                  <tr class="${rowClass}">
                    <td><input type="checkbox" data-index="${row.index}" class="w-4 h-4 accent-blue-600" ${row.valid ? '' : 'disabled'} ${selected.has(row.index) ? 'checked' : ''} aria-label="Importar item ${row.index + 1}" /></td>
                    <td class="text-gray-400">${row.index + 1}</td>
                    <td class="font-medium text-gray-900">${p.isGoty ? '<span class="text-amber-500" title="GOTY">★</span> ' : ''}${row.title ? escapeHtml(row.title) : dash}</td>
                    <td>${p.status ? escapeHtml(p.status) : dash}</td>
                    <td>${refCell(p.platform, p.platformNew)}</td>
                    <td>${refCell(p.genre, p.genreNew)}${p.type ? `<span class="block text-xs text-gray-500">${refCell(p.type, p.typeNew)}</span>` : ''}</td>
                    <td class="whitespace-nowrap">${formatDate(p.startDate)}</td>
                    <td class="whitespace-nowrap">${formatDate(p.endDate)}</td>
                    <td class="whitespace-nowrap tabular-nums">${p.playTimeSeconds === null ? dash : formatPlayTime(p.playTimeSeconds)}</td>
                    <td>${p.score ? `<span class="score-pill" style="background:${scoreColor(p.score)}">${p.score}</span>` : dash}</td>
                    <td>${p.difficulty ? `<span class="difficulty-pill">${escapeHtml(p.difficulty)}</span>` : dash}</td>
                    <td class="text-xs min-w-[14rem]">${messages ? `<ul class="space-y-0.5">${messages}</ul>` : '<span class="text-emerald-700">OK</span>'}</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-3 mt-4">
        <button type="button" data-role="confirm" class="btn-primary"></button>
        <button type="button" data-role="discard" class="btn-secondary">Escolher outro arquivo</button>
      </div>
    `;

    preview.classList.remove('hidden');
    updateImportButton();
  }

  async function handleFile(file) {
    if (!file) {
      return;
    }

    reset();
    fileName.textContent = file.name;

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      showError(`O arquivo não é um JSON válido: ${error.message}`);
      return;
    }

    items = Array.isArray(parsed?.games) ? parsed.games : parsed;

    try {
      const result = await api.post('/api/games/import', { items, dryRun: true });
      rows = result.rows;
      rows.filter((row) => row.valid && !row.duplicate).forEach((row) => selected.add(row.index));
      renderPreview(result.summary);
    } catch (error) {
      showError(error.message);
    }
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('border-blue-400');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, () => dropZone.classList.remove('border-blue-400'))
  );
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0]);
  });

  preview.addEventListener('change', (event) => {
    const target = event.target;

    if (target.dataset.role === 'select-all') {
      selected.clear();
      if (target.checked) {
        rows.filter((row) => row.valid).forEach((row) => selected.add(row.index));
      }
      preview.querySelectorAll('input[data-index]:not(:disabled)').forEach((input) => {
        input.checked = target.checked;
      });
    } else if (target.dataset.index !== undefined) {
      const index = Number(target.dataset.index);
      if (target.checked) {
        selected.add(index);
      } else {
        selected.delete(index);
      }
    }

    updateImportButton();
  });

  preview.addEventListener('click', async (event) => {
    const role = event.target.closest('button')?.dataset.role;

    if (role === 'discard') {
      reset();
      return;
    }

    if (role !== 'confirm' || !selected.size) {
      return;
    }

    const button = event.target.closest('button');
    button.disabled = true;
    button.textContent = 'Importando...';

    try {
      const counts = await api.post('/api/games/import', { items, dryRun: false, indexes: [...selected] });
      await reload('games', 'platforms', 'genres', 'types');
      const created = [
        counts.platforms && `${counts.platforms} plataforma(s)`,
        counts.genres && `${counts.genres} gênero(s)`,
        counts.types && `${counts.types} tipo(s)`,
      ].filter(Boolean);
      toast(`${counts.games} jogo(s) importado(s).${created.length ? ` Criados: ${created.join(', ')}.` : ''}`);
      reset();
      onClose();
    } catch (error) {
      showError(error.message);
      updateImportButton();
    }
  });

  root.querySelector('[data-role="download"]').addEventListener('click', downloadExample);
  root.querySelector('[data-role="close"]').addEventListener('click', onClose);

  return { reset };
}
