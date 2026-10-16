import { iconSvg } from './shared/icons.js';
import { store, findById } from './store.js';
import { isDark } from './theme.js';
import { escapeHtml, formatDate, scoreColor } from './ui.js';

const CARDS = [
  { id: 'total', label: 'Total de jogos', icon: 'gamepad-2', color: 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300' },
  { id: 'platforms', label: 'Plataformas cadastradas', icon: 'monitor', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' },
  { id: 'completed', label: 'Jogos zerados', icon: 'circle-check', color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300', status: 'completed' },
  { id: 'wishlist', label: 'Lista de desejo', icon: 'heart', color: 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300', status: 'wishlist' },
];

const charts = {};

function renderChart(id, config) {
  charts[id]?.destroy();
  const canvas = document.getElementById(id);
  charts[id] = new window.Chart(canvas, config);
}

// Cores dos eixos/grade de acordo com o tema (paleta do Flowbite).
function chartTheme() {
  return isDark()
    ? { text: '#9ca3af', grid: '#374151', primary: '#3b82f6' }
    : { text: '#6b7280', grid: '#e5e7eb', primary: '#1d4ed8' };
}

function baseOptions({ horizontal = false } = {}) {
  const theme = chartTheme();
  const valueAxis = { beginAtZero: true, ticks: { precision: 0, color: theme.text }, grid: { color: theme.grid }, border: { display: false } };
  const categoryAxis = { ticks: { color: theme.text, font: { family: 'Inter' } }, grid: { display: false }, border: { display: false } };

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: false } },
    scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
  };
}

const chartPanel = (id, title, label, height, extraClass = '', counterRole = '') => `
  <div class="panel ${extraClass}">
    <div class="mb-4 flex items-baseline justify-between gap-2">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h2>
      ${counterRole ? `<span data-role="${counterRole}" class="muted"></span>` : ''}
    </div>
    <div class="relative ${height}"><canvas id="${id}" aria-label="${label}" role="img"></canvas></div>
  </div>`;

export function createDashboard(root, { onFilterByStatus }) {
  root.innerHTML = `
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      ${CARDS.map(
        (card) => `
          <${card.status ? 'button type="button"' : 'div'} data-card="${card.id}" class="panel flex items-center justify-between gap-4 text-left ${card.status ? 'transition hover:border-primary-300 hover:shadow-md dark:hover:border-primary-700' : ''}">
            <span>
              <span data-label class="mb-1 block text-sm font-normal text-gray-500 dark:text-gray-400">${card.label}</span>
              <span data-value class="block text-2xl leading-none font-bold text-gray-900 sm:text-3xl dark:text-white">0</span>
            </span>
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.color}">${iconSvg(card.icon, 'h-6 w-6')}</span>
          </${card.status ? 'button' : 'div'}>`
      ).join('')}
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      ${chartPanel('chart-scores', 'Distribuição por nota', 'Gráfico de jogos por nota', 'h-[26rem]', 'lg:row-span-2', 'rated')}
      ${chartPanel('chart-difficulties', 'Distribuição por dificuldade', 'Gráfico de jogos por dificuldade', 'h-48', '', 'with-difficulty')}
      ${chartPanel('chart-platforms', 'Top plataformas', 'Gráfico das plataformas mais usadas', 'h-48')}
      <div class="panel lg:col-span-2">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Meus GOTY</h2>
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
    const theme = chartTheme();

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
    const rated = games.filter((game) => game.score !== null).length;
    root.querySelector('[data-role="rated"]').textContent = `${rated} jogo(s) avaliado(s)`;

    renderChart('chart-scores', {
      type: 'bar',
      data: {
        labels: scores.map((score) => `${score.value} - ${score.label}`),
        datasets: [
          {
            label: 'Jogos',
            data: scores.map((score) => games.filter((game) => game.score === score.value).length),
            backgroundColor: scores.map((score) => scoreColor(score.value)),
            borderRadius: 4,
          },
        ],
      },
      options: baseOptions({ horizontal: true }),
    });

    // Dificuldade: C até AAA
    const difficulties = [...store.difficulties].sort((a, b) => a.order - b.order);
    const withDifficulty = games.filter((game) => game.difficultyId && findById('difficulties', game.difficultyId)).length;
    root.querySelector('[data-role="with-difficulty"]').textContent = `${withDifficulty} jogo(s)`;

    const difficultyOptions = baseOptions();
    difficultyOptions.plugins.tooltip = {
      callbacks: { title: (items) => `${difficulties[items[0].dataIndex].key} — ${difficulties[items[0].dataIndex].label}` },
    };
    renderChart('chart-difficulties', {
      type: 'bar',
      data: {
        labels: difficulties.map((item) => item.key),
        datasets: [
          {
            label: 'Jogos',
            data: difficulties.map((item) => games.filter((game) => game.difficultyId === item.id).length),
            backgroundColor: difficulties.map((_item, index) => `hsl(${220 - index * (180 / Math.max(1, difficulties.length - 1))} 70% 52%)`),
            borderRadius: 4,
          },
        ],
      },
      options: difficultyOptions,
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
        datasets: [{ label: 'Jogos', data: platformCounts.map((item) => item.count), backgroundColor: theme.primary, borderRadius: 4 }],
      },
      options: baseOptions({ horizontal: true }),
    });

    const goty = games
      .filter((game) => game.isGoty)
      .sort((a, b) => String(b.endDate || b.startDate || '').localeCompare(String(a.endDate || a.startDate || '')));

    root.querySelector('[data-role="goty"]').innerHTML = goty.length
      ? `<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${goty
            .map((game) => {
              const date = game.endDate || game.startDate;
              const platform = findById('platforms', game.platformId)?.name;
              return `
                <li class="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-900/60 dark:bg-yellow-900/20">
                  <span class="text-yellow-500" aria-hidden="true">${iconSvg('trophy', 'h-5 w-5')}</span>
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-gray-900 dark:text-white">${escapeHtml(game.title)}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">${escapeHtml([platform, findById('statuses', game.status)?.name, date ? formatDate(date) : null].filter(Boolean).join(' · '))}</span>
                  </span>
                </li>`;
            })
            .join('')}
        </ul>`
      : '<p class="muted">Nenhum jogo marcado como GOTY ainda. Marque "Destaque / GOTY" no cadastro do jogo.</p>';
  }

  // Redesenha os gráficos com as cores do novo tema, se o dashboard estiver visível.
  window.addEventListener('themechange', () => {
    if (!root.classList.contains('hidden')) {
      render();
    }
  });

  return { render };
}
