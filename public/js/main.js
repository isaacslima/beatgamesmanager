import {
  authErrorMessage,
  loginWithEmail,
  loginWithGoogle,
  logout,
  onUserChanged,
  registerWithEmail,
  resetPassword,
} from './auth.js';
import { createCatalogView } from './catalog-views.js';
import { createDashboard } from './dashboard.js';
import { createGamesView } from './games-view.js';
import { ensureUserDefaults } from './data.js';
import { iconSvg } from './shared/icons.js';
import { clearStore, loadAll, onStoreChange } from './store.js';
import { isDark, toggleTheme } from './theme.js';
import { escapeHtml, toast } from './ui.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', subtitle: 'Resumo da sua biblioteca de jogos.' },
  games: { title: 'Jogos', subtitle: 'Gerencie os jogos que você quer zerar, está jogando ou já zerou.' },
  statuses: { title: 'Status', subtitle: 'Situações possíveis dos jogos.' },
  tags: { title: 'Tags', subtitle: 'Etiquetas com ícone para organizar os jogos.' },
  platforms: { title: 'Plataformas', subtitle: 'Cadastro de consoles e plataformas.' },
  genres: { title: 'Gêneros', subtitle: 'Cadastro de gêneros dos jogos.' },
  types: { title: 'Tipos', subtitle: 'Subcategorias dos gêneros.' },
  scores: { title: 'Notas / Avaliações', subtitle: 'Tabela de referência da pontuação dos jogos.' },
  difficulties: { title: 'Níveis de Dificuldade', subtitle: 'Escala de dificuldade dos jogos.' },
};

const CATALOG_VIEWS = ['statuses', 'tags', 'platforms', 'genres', 'types', 'scores', 'difficulties'];

// Ícones declarados no HTML com data-icon (vindos do Lucide).
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon, element.dataset.iconClass || 'h-5 w-5');
  });
}

hydrateIcons();

const authLoading = document.getElementById('auth-loading');
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggleMode = document.getElementById('auth-toggle-mode');
const authResetPassword = document.getElementById('auth-reset-password');
const authError = document.getElementById('auth-error');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const googleLoginBtn = document.getElementById('google-login-btn');
const userEmail = document.getElementById('user-email');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const userInitial = document.getElementById('user-initial');
const userMenu = document.getElementById('user-menu');
const userMenuButton = document.getElementById('user-menu-button');
const themeToggle = document.getElementById('theme-toggle');
const catalogToggle = document.getElementById('catalog-toggle');
const catalogMenu = document.getElementById('catalog-menu');
const catalogChevron = document.getElementById('catalog-chevron');
const breadcrumb = document.getElementById('breadcrumb');
const logoutBtn = document.getElementById('logout-btn');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const loadError = document.getElementById('load-error');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const menuBtn = document.getElementById('menu-btn');

// ---------- Views ----------

let currentView = 'dashboard';
let views = null;

function setupViews() {
  if (views) {
    return views;
  }

  const games = createGamesView(document.getElementById('view-games'));
  const dashboard = createDashboard(document.getElementById('view-dashboard'), {
    onFilterByStatus: (status) => {
      navigate('games');
      games.filterBy('status', status);
    },
  });

  views = { dashboard, games };
  CATALOG_VIEWS.forEach((name) => {
    views[name] = createCatalogView(name, document.getElementById(`view-${name}`));
  });

  onStoreChange(() => {
    games.refresh();
    CATALOG_VIEWS.forEach((name) => views[name].refresh());
    if (currentView === 'dashboard') {
      dashboard.render();
    }
  });

  return views;
}

const CHEVRON = iconSvg('chevron-right', 'h-4 w-4 text-gray-400');

function renderBreadcrumb(view) {
  const items = [{ label: 'Início', view: 'dashboard' }];
  if (CATALOG_VIEWS.includes(view)) {
    items.push({ label: 'Cadastros' });
  }
  if (view !== 'dashboard') {
    items.push({ label: VIEWS[view].title });
  }

  breadcrumb.innerHTML = items
    .map((item, index) => {
      const last = index === items.length - 1;
      const content = item.view && !last
        ? `<a href="#${item.view}" class="inline-flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-white">${index === 0 ? iconSvg('house', 'h-4 w-4') : ''}${escapeHtml(item.label)}</a>`
        : `<span class="inline-flex items-center gap-1.5 ${last ? 'text-gray-400 dark:text-gray-500' : ''}" ${last ? 'aria-current="page"' : ''}>${index === 0 ? iconSvg('house', 'h-4 w-4') : ''}${escapeHtml(item.label)}</span>`;
      return `<li class="inline-flex items-center gap-1 md:gap-2">${index ? CHEVRON : ''}${content}</li>`;
    })
    .join('');
}

function setCatalogOpen(open) {
  catalogMenu.classList.toggle('hidden', !open);
  catalogToggle.setAttribute('aria-expanded', String(open));
  catalogChevron.classList.toggle('rotate-180', open);
}

catalogToggle.addEventListener('click', () => setCatalogOpen(catalogMenu.classList.contains('hidden')));

function setSidebarOpen(open) {
  sidebar.classList.toggle('-translate-x-full', !open);
  sidebarBackdrop.classList.toggle('hidden', !open);
  menuBtn.setAttribute('aria-expanded', String(open));
}

function navigate(view, { updateHash = true } = {}) {
  if (!VIEWS[view]) {
    view = 'dashboard';
  }

  currentView = view;
  pageTitle.textContent = VIEWS[view].title;
  pageSubtitle.textContent = VIEWS[view].subtitle;
  document.title = `${VIEWS[view].title} · Beat Games`;
  renderBreadcrumb(view);
  if (CATALOG_VIEWS.includes(view)) {
    setCatalogOpen(true);
  }

  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.viewPanel !== view);
  });

  document.querySelectorAll('.sidebar-link[data-view]').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (view === 'dashboard') {
    views?.dashboard.render();
  }

  if (view === 'games') {
    views?.games.showList();
  }

  if (updateHash && location.hash !== `#${view}`) {
    history.replaceState(null, '', `#${view}`);
  }

  setSidebarOpen(false);
}

document.querySelectorAll('.sidebar-link[data-view]').forEach((link) => {
  link.addEventListener('click', () => navigate(link.dataset.view));
});

window.addEventListener('hashchange', () => navigate(location.hash.slice(1), { updateHash: false }));
menuBtn.addEventListener('click', () => setSidebarOpen(sidebar.classList.contains('-translate-x-full')));
sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));

// ---------- Tema ----------

function syncThemeIcon() {
  document.getElementById('theme-icon-dark').classList.toggle('hidden', isDark());
  document.getElementById('theme-icon-light').classList.toggle('hidden', !isDark());
  themeToggle.setAttribute('aria-label', isDark() ? 'Usar modo claro' : 'Usar modo escuro');
}

themeToggle.addEventListener('click', toggleTheme);
window.addEventListener('themechange', syncThemeIcon);
syncThemeIcon();

// ---------- Menu do usuário ----------

function setUserMenuOpen(open) {
  userMenu.classList.toggle('hidden', !open);
  userMenuButton.setAttribute('aria-expanded', String(open));
}

userMenuButton.addEventListener('click', (event) => {
  event.stopPropagation();
  setUserMenuOpen(userMenu.classList.contains('hidden'));
});

document.addEventListener('click', (event) => {
  if (!userMenu.contains(event.target)) {
    setUserMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setUserMenuOpen(false);
    setSidebarOpen(false);
  }
});

function showUser(user) {
  const name = user.displayName || user.email || '';
  userName.textContent = user.displayName || 'Minha conta';
  userEmail.textContent = user.email || '';
  userInitial.textContent = (name.trim()[0] || '?').toUpperCase();

  if (user.photoURL) {
    userAvatar.src = user.photoURL;
    userAvatar.classList.remove('hidden');
    userInitial.classList.add('hidden');
  } else {
    userAvatar.classList.add('hidden');
    userInitial.classList.remove('hidden');
  }
}

// ---------- Autenticação ----------

let isRegisterMode = false;

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.toggle('hidden', !message);
}

function setRegisterMode(enabled) {
  isRegisterMode = enabled;
  authTitle.textContent = enabled ? 'Criar sua conta' : 'Entrar na sua biblioteca';
  authSubmit.textContent = enabled ? 'Criar conta' : 'Entrar';
  authToggleMode.textContent = enabled ? 'Já tenho conta' : 'Criar conta';
  authPassword.autocomplete = enabled ? 'new-password' : 'current-password';
  showAuthError('');
}

authToggleMode.addEventListener('click', () => setRegisterMode(!isRegisterMode));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthError('');
  authSubmit.disabled = true;

  try {
    const email = authEmail.value.trim();
    if (isRegisterMode) {
      await registerWithEmail(email, authPassword.value);
    } else {
      await loginWithEmail(email, authPassword.value);
    }
  } catch (error) {
    showAuthError(authErrorMessage(error));
  } finally {
    authSubmit.disabled = false;
  }
});

googleLoginBtn.addEventListener('click', async () => {
  showAuthError('');

  try {
    await loginWithGoogle();
  } catch (error) {
    showAuthError(authErrorMessage(error));
  }
});

authResetPassword.addEventListener('click', async () => {
  const email = authEmail.value.trim();

  if (!email) {
    showAuthError('Informe seu e-mail para redefinir a senha.');
    return;
  }

  try {
    await resetPassword(email);
    showAuthError('');
    toast('Enviamos um e-mail com o link para redefinir sua senha.');
  } catch (error) {
    showAuthError(authErrorMessage(error));
  }
});

logoutBtn.addEventListener('click', () => {
  setUserMenuOpen(false);
  logout();
});

onUserChanged(async (user) => {
  authLoading.classList.add('hidden');

  if (!user) {
    appView.classList.add('hidden');
    authView.classList.remove('hidden');
    authForm.reset();
    setRegisterMode(false);
    clearStore();
    return;
  }

  showUser(user);
  authView.classList.add('hidden');
  appView.classList.remove('hidden');

  setupViews();
  navigate(location.hash.slice(1) || 'dashboard');

  try {
    loadError.classList.add('hidden');
    await ensureUserDefaults();
    await loadAll();
  } catch (error) {
    loadError.textContent = `Não foi possível carregar seus dados: ${error.message}`;
    loadError.classList.remove('hidden');
  }
});
