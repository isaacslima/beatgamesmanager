const gameForm = document.getElementById('game-form');
const gamesList = document.getElementById('games-list');
const cancelEditButton = document.getElementById('cancel-edit');
const searchForm = document.getElementById('search-form');
const searchResults = document.getElementById('search-results');

async function fetchGames() {
  const response = await fetch('/api/games');
  return response.json();
}

function renderGames(games) {
  gamesList.innerHTML = '';

  if (!games.length) {
    gamesList.innerHTML = '<li class="list-item">Nenhum jogo cadastrado.</li>';
    return;
  }

  games.forEach((game) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <strong>${game.name}</strong>
      <span>Início: ${game.startDate || '-'}</span>
      <span>Fim: ${game.endDate || '-'}</span>
      <span>Nota: ${game.rating ?? '-'}</span>
      <span>Observações: ${game.notes || '-'}</span>
      <div class="item-actions">
        <button type="button" data-action="edit" data-id="${game.id}">Editar</button>
        <button type="button" data-action="delete" data-id="${game.id}">Excluir</button>
      </div>
    `;

    gamesList.appendChild(li);
  });
}

function resetForm() {
  gameForm.reset();
  document.getElementById('game-id').value = '';
}

async function loadGames() {
  const games = await fetchGames();
  renderGames(games);
}

gameForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('name').value,
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
});

cancelEditButton.addEventListener('click', () => {
  resetForm();
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

  const games = await fetchGames();
  const game = games.find((item) => item.id === id);

  if (action === 'edit' && game) {
    document.getElementById('game-id').value = game.id;
    document.getElementById('name').value = game.name;
    document.getElementById('startDate').value = game.startDate || '';
    document.getElementById('endDate').value = game.endDate || '';
    document.getElementById('notes').value = game.notes || '';
    document.getElementById('rating').value = game.rating ?? '';
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

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = document.getElementById('search-term').value.trim();

  if (!term) {
    return;
  }

  const response = await fetch(`/api/search-games?q=${encodeURIComponent(term)}`);

  if (!response.ok) {
    searchResults.innerHTML = '<li class="list-item">Não foi possível buscar jogos na API externa.</li>';
    return;
  }

  const results = await response.json();

  if (!results.length) {
    searchResults.innerHTML = '<li class="list-item">Nenhum jogo encontrado.</li>';
    return;
  }

  searchResults.innerHTML = '';

  results.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <strong>${item.title}</strong>
      <span>Steam App ID: ${item.steamAppID || '-'}</span>
      <span>Menor preço histórico: ${item.cheapestPriceEver || '-'}</span>
    `;

    searchResults.appendChild(li);
  });
});

loadGames();
