const gameForm = document.getElementById('game-form');
const gamesList = document.getElementById('games-list');
const cancelEditButton = document.getElementById('cancel-edit');
const searchForm = document.getElementById('search-form');
const searchResults = document.getElementById('search-results');
const platformSelect = document.getElementById('platform');
const platformThumb = document.getElementById('platform-thumb');
const emulatorWrapper = document.getElementById('emulator-wrapper');
const emulatorNameInput = document.getElementById('emulatorName');
const ratingInput = document.getElementById('rating');
const ratingValue = document.getElementById('rating-value');
const navDashboard = document.getElementById('nav-dashboard');
const navGames = document.getElementById('nav-games');
const pageTitle = document.getElementById('page-title');
const dashboardView = document.getElementById('dashboard-view');
const gamesView = document.getElementById('games-view');
const addPlatformBtn = document.getElementById('add-platform-btn');
const cancelPlatformBtn = document.getElementById('cancel-platform');
const platformModal = document.getElementById('platform-modal');
const platformForm = document.getElementById('platform-form');
const gamesListView = document.getElementById('games-list-view');
const gameFormView = document.getElementById('game-form-view');
const gameFormTitle = document.getElementById('game-form-title');
const addGameBtn = document.getElementById('add-game-btn');
const filterPlatform = document.getElementById('filter-platform');
const filterStart = document.getElementById('filter-start');
const filterEnd = document.getElementById('filter-end');
const filterName = document.getElementById('filter-name');
const filterNameBtn = document.getElementById('filter-name-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const gamesPagination = document.getElementById('games-pagination');

const PAGE_SIZE = 10;

let platformsById = new Map();
let platformChart = null;
let allGames = [];
let currentPage = 1;

async function loadPlatforms(selectId) {
  const response = await fetch('/api/platforms');
  const platforms = await response.json();
  platformsById = new Map(platforms.map((platform) => [platform.id, platform]));

  const previousValue = selectId || platformSelect.value;
  platformSelect.innerHTML = '<option value="">Selecione</option>';
  filterPlatform.innerHTML = '<option value="">Todas</option>';

  platforms.forEach((platform) => {
    const option = document.createElement('option');
    option.value = platform.name;
    option.dataset.imageUrl = platform.imageUrl || '';
    option.textContent = platform.name;
    platformSelect.appendChild(option);

    const filterOption = document.createElement('option');
    filterOption.value = platform.name;
    filterOption.textContent = platform.name;
    filterPlatform.appendChild(filterOption);
  });

  platformSelect.value = previousValue;
  updatePlatformThumb();
}

function updatePlatformThumb() {
  const selectedOption = platformSelect.selectedOptions[0];
  const imageUrl = selectedOption ? selectedOption.dataset.imageUrl : '';

  if (imageUrl) {
    platformThumb.src = imageUrl;
    platformThumb.classList.remove('hidden');
  } else {
    platformThumb.classList.add('hidden');
  }
}

function toggleEmulatorField() {
  const isEmulator = platformSelect.value === 'PC com emulador';
  emulatorWrapper.classList.toggle('hidden', !isEmulator);
  emulatorNameInput.required = isEmulator;

  if (!isEmulator) {
    emulatorNameInput.value = '';
  }
}

async function fetchGames() {
  const response = await fetch('/api/games');
  return response.json();
}

function applyFilters(resetPage = true) {
  const platform = filterPlatform.value;
  const start = filterStart.value;
  const end = filterEnd.value;
  const name = filterName.value.trim().toLowerCase();

  const filtered = allGames.filter((game) => {
    if (platform && game.platform !== platform) {
      return false;
    }

    if (name && !game.name.toLowerCase().includes(name)) {
      return false;
    }

    if ((start || end) && !game.startDate) {
      return false;
    }

    if (start && game.startDate < start) {
      return false;
    }

    if (end && game.startDate > end) {
      return false;
    }

    return true;
  });

  if (resetPage) {
    currentPage = 1;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  const start_ = (currentPage - 1) * PAGE_SIZE;
  renderGames(filtered.slice(start_, start_ + PAGE_SIZE));
  renderPagination(filtered.length, totalPages);
}

function renderPagination(total, totalPages) {
  if (total === 0) {
    gamesPagination.innerHTML = '';
    return;
  }

  gamesPagination.innerHTML = `
    <span class="text-sm text-gray-500">${total} jogo(s) — página ${currentPage} de ${totalPages}</span>
    <div class="flex gap-2">
      <button type="button" id="prev-page-btn" class="btn-secondary text-sm" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
      <button type="button" id="next-page-btn" class="btn-secondary text-sm" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima</button>
    </div>
  `;

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    currentPage -= 1;
    applyFilters(false);
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    currentPage += 1;
    applyFilters(false);
  });
}

function renderGames(games) {
  gamesList.innerHTML = '';

  if (!games.length) {
    gamesList.innerHTML = '<div class="row-item">Nenhum jogo cadastrado.</div>';
    return;
  }

  games.forEach((game) => {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.innerHTML = `
      <strong>${game.name}</strong>
      <span>Plataforma: ${game.platform || '-'}</span>
      <span>Emulador: ${game.emulatorName || '-'}</span>
      <span>Início: ${game.startDate || '-'}</span>
      <span>Fim: ${game.endDate || '-'}</span>
      <span>Nota: ${game.rating ?? '-'}</span>
      <span>Tempo total (h): ${game.totalPlayTimeHours ?? '-'}</span>
      <span>Observações: ${game.notes || '-'}</span>
      <div class="flex gap-2">
        <button type="button" data-action="edit" data-id="${game.id}" class="btn-secondary text-sm">Editar</button>
        <button type="button" data-action="delete" data-id="${game.id}" class="btn-secondary text-sm">Excluir</button>
      </div>
    `;

    gamesList.appendChild(row);
  });
}

function resetForm() {
  gameForm.reset();
  document.getElementById('game-id').value = '';
  ratingValue.textContent = ratingInput.value;
  toggleEmulatorField();
  updatePlatformThumb();
}

async function loadGames() {
  allGames = await fetchGames();
  applyFilters();
}

gameForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('name').value,
    platform: document.getElementById('platform').value || '',
    emulatorName: document.getElementById('emulatorName').value || '',
    totalPlayTimeHours: document.getElementById('totalPlayTimeHours').value || null,
    startDate: document.getElementById('startDate').value || null,
    endDate: document.getElementById('endDate').value || null,
    notes: document.getElementById('notes').value,
    rating: document.getElementById('rating').value || null,
  };

  const id = document.getElementById('game-id').value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/games/${id}` : '/api/games';

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.message || 'Erro ao salvar jogo.');
    return;
  }

  resetForm();
  await loadGames();
  showGamesList();
});

cancelEditButton.addEventListener('click', () => {
  resetForm();
  showGamesList();
});

addGameBtn.addEventListener('click', () => {
  resetForm();
  showGameForm();
});

gamesList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (!action || !id) {
    return;
  }

  const game = allGames.find((item) => item.id === id);

  if (action === 'edit' && game) {
    document.getElementById('game-id').value = game.id;
    document.getElementById('name').value = game.name;
    document.getElementById('platform').value = game.platform || '';
    document.getElementById('emulatorName').value = game.emulatorName || '';
    document.getElementById('startDate').value = game.startDate || '';
    document.getElementById('endDate').value = game.endDate || '';
    document.getElementById('notes').value = game.notes || '';
    document.getElementById('rating').value = game.rating ?? 0;
    ratingValue.textContent = document.getElementById('rating').value;
    document.getElementById('totalPlayTimeHours').value = game.totalPlayTimeHours ?? '';
    toggleEmulatorField();
    updatePlatformThumb();
    showGameForm('Editar jogo');
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm('Tem certeza que deseja excluir este jogo?');
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/games/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      alert('Erro ao excluir jogo.');
      return;
    }

    await loadGames();
  }
});

filterPlatform.addEventListener('change', () => applyFilters());
filterStart.addEventListener('change', () => applyFilters());
filterEnd.addEventListener('change', () => applyFilters());
filterNameBtn.addEventListener('click', () => applyFilters());
filterName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    applyFilters();
  }
});

clearFiltersBtn.addEventListener('click', () => {
  filterPlatform.value = '';
  filterStart.value = '';
  filterEnd.value = '';
  filterName.value = '';
  applyFilters();
});

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = document.getElementById('search-term').value.trim();

  if (!term) {
    return;
  }

  const response = await fetch(`/api/search-games?q=${encodeURIComponent(term)}`);

  if (!response.ok) {
    searchResults.innerHTML = '<div class="row-item">Não foi possível buscar jogos na API externa.</div>';
    return;
  }

  const results = await response.json();

  if (!results.length) {
    searchResults.innerHTML = '<div class="row-item">Nenhum jogo encontrado.</div>';
    return;
  }

  searchResults.innerHTML = '';

  results.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.innerHTML = `
      <strong>${item.title}</strong>
      <span>Steam App ID: ${item.steamAppID || '-'}</span>
      <span>Menor preço histórico: ${item.cheapestPriceEver || '-'}</span>
    `;

    searchResults.appendChild(row);
  });
});

platformSelect.addEventListener('change', () => {
  toggleEmulatorField();
  updatePlatformThumb();
});

ratingInput.addEventListener('input', () => {
  ratingValue.textContent = ratingInput.value;
});

addPlatformBtn.addEventListener('click', () => {
  platformModal.classList.remove('hidden');
});

cancelPlatformBtn.addEventListener('click', () => {
  platformForm.reset();
  platformModal.classList.add('hidden');
});

platformForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const response = await fetch('/api/platforms', {
    method: 'POST',
    body: new FormData(platformForm),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.message || 'Erro ao criar plataforma.');
    return;
  }

  const platform = await response.json();
  platformForm.reset();
  platformModal.classList.add('hidden');
  await loadPlatforms(platform.name);
});

function showDashboard() {
  dashboardView.classList.remove('hidden');
  gamesView.classList.add('hidden');
  navDashboard.classList.add('active');
  navGames.classList.remove('active');
  pageTitle.textContent = 'Dashboard';
  loadStats();
}

function showGames() {
  gamesView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  navGames.classList.add('active');
  navDashboard.classList.remove('active');
  pageTitle.textContent = 'Jogos';
  showGamesList();
}

function showGamesList() {
  gamesListView.classList.remove('hidden');
  gameFormView.classList.add('hidden');
}

function showGameForm(title) {
  gameFormTitle.textContent = title || 'Cadastrar jogo';
  gameFormView.classList.remove('hidden');
  gamesListView.classList.add('hidden');
}

navDashboard.addEventListener('click', showDashboard);
navGames.addEventListener('click', showGames);

function renderLastGames(lastGames) {
  const lastGamesList = document.getElementById('last-games-list');
  lastGamesList.innerHTML = '';

  if (!lastGames.length) {
    lastGamesList.innerHTML = '<div class="row-item">Nenhum jogo cadastrado.</div>';
    return;
  }

  lastGames.forEach((game) => {
    const row = document.createElement('div');
    row.className = 'row-item';
    row.innerHTML = `
      <strong>${game.name}</strong>
      <span>Plataforma: ${game.platform || '-'}</span>
    `;
    lastGamesList.appendChild(row);
  });
}

async function loadStats() {
  const response = await fetch('/api/stats');
  const stats = await response.json();

  document.getElementById('stat-total-games').textContent = stats.totalGames;
  document.getElementById('stat-total-platforms').textContent = stats.platformCounts.length;
  document.getElementById('stat-top-platform').textContent = stats.platformCounts[0]
    ? stats.platformCounts[0].platform
    : '-';

  renderLastGames(stats.lastGames);

  const top7 = stats.platformCounts.slice(0, 7);
  const ctx = document.getElementById('platform-chart');

  if (platformChart) {
    platformChart.destroy();
  }

  platformChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top7.map((item) => item.platform),
      datasets: [
        {
          label: 'Jogos',
          data: top7.map((item) => item.count),
          backgroundColor: '#2563eb',
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

loadPlatforms();
loadGames();
showDashboard();
