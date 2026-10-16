// Modo claro/escuro: segue o sistema até o usuário escolher; a escolha fica no navegador.
const STORAGE_KEY = 'color-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}

export function isDark() {
  return document.documentElement.classList.contains('dark');
}

function apply(dark) {
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}

export function toggleTheme() {
  const dark = !isDark();
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch (_error) {
    // Sem armazenamento: vale só para esta visita.
  }
  apply(dark);
}

// Acompanha mudanças do sistema enquanto o usuário não escolheu um tema.
media.addEventListener('change', (event) => {
  if (!savedTheme()) {
    apply(event.matches);
  }
});
