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
import { clearStore, loadAll, onStoreChange } from './store.js';

const VIEWS = {
  dashboard: { title: 'Dashboard', subtitle: 'Resumo da sua biblioteca de jogos.' },
  games: { title: 'Jogos', subtitle: 'Gerencie os jogos que você quer zerar, está jogando ou já zerou.' },
  statuses: { title: 'Status', subtitle: 'Situações possíveis dos jogos.' },
  platforms: { title: 'Plataformas', subtitle: 'Cadastro de consoles e plataformas.' },
  genres: { title: 'Gêneros', subtitle: 'Cadastro de gêneros dos jogos.' },
  types: { title: 'Tipos', subtitle: 'Subcategorias dos gêneros.' },
  scores: { title: 'Notas / Avaliações', subtitle: 'Tabela de referência da pontuação dos jogos.' },
  difficulties: { title: 'Níveis de Dificuldade', subtitle: 'Escala de dificuldade dos jogos.' },
};

const CATALOG_VIEWS = ['statuses', 'platforms', 'genres', 'types', 'scores', 'difficulties'];

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

// ---------- Autenticação ----------

let isRegisterMode = false;

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.toggle('hidden', !message);
}

function setRegisterMode(enabled) {
  isRegisterMode = enabled;
  authTitle.textContent = enabled ? 'Criar conta' : 'Entrar';
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
    alert('Enviamos um e-mail com o link para redefinir sua senha.');
  } catch (error) {
    showAuthError(authErrorMessage(error));
  }
});

logoutBtn.addEventListener('click', () => logout());

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

  userEmail.textContent = user.email || user.displayName || '';
  authView.classList.add('hidden');
  appView.classList.remove('hidden');

  setupViews();
  navigate(location.hash.slice(1) || 'dashboard');

  try {
    loadError.classList.add('hidden');
    await loadAll();
  } catch (error) {
    loadError.textContent = `Não foi possível carregar seus dados: ${error.message}`;
    loadError.classList.remove('hidden');
  }
});
