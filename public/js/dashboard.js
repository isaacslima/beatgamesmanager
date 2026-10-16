import { store, findById } from './store.js';
import { escapeHtml, formatDate, scoreColor } from './ui.js';

const CARDS = [
  { id: 'total', label: 'Total de jogos', color: 'bg-blue-50 text-blue-600', icon: '<rect x="2" y="6" width="20" height="12" rx="3" />' },
  { id: 'platforms', label: 'Plataformas cadastradas', color: 'bg-indigo-50 text-indigo-600', icon: '<path d="M12 3l9 6-9 6-9-6 9-6zM3 15l9 6 9-6" stroke-linejoin="round" />' },
  { id: 'completed', label: 'Jogos zerados', color: 'bg-emerald-50 text-emerald-600', icon: '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />', status: 'completed' },
  { id: 'wishlist', label: 'Lista de desejo', color: 'bg-purple-50 text-purple-600', icon: '<path d="M12 21s-7-4.4-9.5-9A5.5 5.5 0 0112 5.6 5.5 5.5 0 0121.5 12C19 16.6 12 21 12 21z" stroke-linejoin="round" />', status: 'wishlist' },
];

const charts = {};

function renderChart(id, config) {
  charts[id]?.destroy();
  const canvas = document.getElementById(id);
  charts[id] = new window.Chart(canvas, config);
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

export function createDashboard(root, { onFilterByStatus }) {
  root.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      ${CARDS.map(
        (card) => `
          <${card.status ? 'button type="button"' : 'div'} data-card="${card.id}" class="panel flex items-center gap-4 text-left ${card.status ? 'hover:border-blue-300 transition-colors' : ''}">
            <span class="flex items-center justify-center w-12 h-12 rounded-full ${card.color}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${card.icon}</svg>
            </span>
            <span>
              <span data-label class="block text-sm text-gray-500">${card.label}</span>
              <span data-value class="block text-2xl font-bold">0</span>
            </span>
          </${card.status ? 'button' : 'div'}>`
      ).join('')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="panel lg:row-span-2">
        <div class="flex items-baseline justify-between gap-2 mb-4">
          <h2 class="panel-title mb-0">Distribuição por nota</h2>
          <span data-role="rated" class="text-sm text-gray-500"></span>
        </div>
        <div class="relative h-[26rem]"><canvas id="chart-scores" aria-label="Gráfico de jogos por nota" role="img"></canvas></div>
      </div>

      <div class="panel">
        <div class="flex items-baseline justify-between gap-2 mb-4">
          <h2 class="panel-title mb-0">Distribuição por dificuldade</h2>
          <span data-role="with-difficulty" class="text-sm text-gray-500"></span>
        </div>
        <div class="relative h-48"><canvas id="chart-difficulties" aria-label="Gráfico de jogos por dificuldade" role="img"></canvas></div>
      </div>

      <div class="panel">
        <h2 class="panel-title">Top plataformas</h2>
        <div class="relative h-48"><canvas id="chart-platforms" aria-label="Gráfico das plataformas mais usadas" role="img"></canvas></div>
      </div>

      <div class="panel lg:col-span-2">
        <h2 class="panel-title">Meus GOTY</h2>
        <div data-role="goty"></div>
      </div>
    </div>
  `;

  root.querySelectorAll('button[data-card]').forEach((button) => {
    const card = CARDS.find((item) => item.id === button.dataset.card);
    button.addEventListener('click', () => onFilterByStatus(card.status));
  });

  function setCard(id, value) {
    root.querySelector(`[data-card="${id}"] [data-value]`).textContent = value;
  }

  function render() {
    const games = store.games;

    setCard('total', games.length);
    setCard('platforms', store.platforms.length);
    setCard('completed', games.filter((game) => game.status === 'completed').length);
    setCard('wishlist', games.filter((game) => game.status === 'wishlist').length);

    // Os nomes dos status são editáveis; os cards acompanham.
    CARDS.filter((card) => card.status).forEach((card) => {
      const name = findById('statuses', card.status)?.name;
      root.querySelector(`[data-card="${card.id}"] [data-label]`).textContent = name || card.label;
    });

    // Notas: 11 (Jogo da vida) até 1 (Tragédia)
    const scores = [...store.scores].sort((a, b) => b.value - a.value);
    const scoreCounts = scores.map((score) => games.filter((game) => game.score === score.value).length);
    const rated = games.filter((game) => game.score !== null).length;
    root.querySelector('[data-role="rated"]').textContent = `${rated} jogo(s) avaliado(s)`;

    renderChart('chart-scores', {
      type: 'bar',
      data: {
        labels: scores.map((score) => `${score.value} - ${score.label}`),
        datasets: [{ label: 'Jogos', data: scoreCounts, backgroundColor: scores.map((score) => scoreColor(score.value)), borderRadius: 4 }],
      },
      options: {
        ...baseOptions,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
      },
    });

    // Dificuldade: C até AAA
    const difficulties = [...store.difficulties].sort((a, b) => a.order - b.order);
    const withDifficulty = games.filter((game) => game.difficultyId && findById('difficulties', game.difficultyId)).length;
    root.querySelector('[data-role="with-difficulty"]').textContent = `${withDifficulty} jogo(s)`;

    renderChart('chart-difficulties', {
      type: 'bar',
      data: {
        labels: difficulties.map((item) => item.key),
        datasets: [
          {
            label: 'Jogos',
            data: difficulties.map((item) => games.filter((game) => game.difficultyId === item.id).length),
            backgroundColor: difficulties.map((_item, index) => `hsl(${220 - index * (180 / Math.max(1, difficulties.length - 1))} 70% 50%)`),
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...baseOptions,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
        plugins: {
          ...baseOptions.plugins,
          tooltip: { callbacks: { title: (items) => `${difficulties[items[0].dataIndex].key} — ${difficulties[items[0].dataIndex].label}` } },
        },
      },
    });

    // Top 7 plataformas
    const platformCounts = store.platforms
      .map((platform) => ({ name: platform.name, count: games.filter((game) => game.platformId === platform.id).length }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    renderChart('chart-platforms', {
      type: 'bar',
      data: {
        labels: platformCounts.map((item) => item.name),
        datasets: [{ label: 'Jogos', data: platformCounts.map((item) => item.count), backgroundColor: '#2563eb', borderRadius: 4 }],
      },
      options: {
        ...baseOptions,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
      },
    });

    const goty = games
      .filter((game) => game.isGoty)
      .sort((a, b) => String(b.endDate || b.startDate || '').localeCompare(String(a.endDate || a.startDate || '')));

    root.querySelector('[data-role="goty"]').innerHTML = goty.length
      ? `<ul class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          ${goty
            .map((game) => {
              const date = game.endDate || game.startDate;
              const platform = findById('platforms', game.platformId)?.name;
              return `
                <li class="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span class="text-amber-500 text-lg" aria-hidden="true">★</span>
                  <span class="min-w-0">
                    <span class="block font-medium text-gray-900 truncate">${escapeHtml(game.title)}</span>
                    <span class="block text-xs text-gray-500">${escapeHtml([platform, findById('statuses', game.status)?.name, date ? formatDate(date) : null].filter(Boolean).join(' · '))}</span>
                  </span>
                </li>`;
            })
            .join('')}
        </ul>`
      : '<p class="text-sm text-gray-500">Nenhum jogo marcado como GOTY ainda. Marque "Destaque / GOTY" no cadastro do jogo.</p>';
  }

  return { render };
}
