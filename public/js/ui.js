import { iconSvg } from './shared/icons.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function formatPlayTime(seconds) {
  if (seconds === null || seconds === undefined) {
    return '';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
}

// Cor de 1 (vermelho) a 11 (verde).
export function scoreColor(value) {
  const hue = Math.round(((value - 1) / 10) * 130);
  return `hsl(${hue} 65% 42%)`;
}

const TOAST_STYLES = {
  success: { icon: 'check', box: 'bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200' },
  error: { icon: 'triangle-alert', box: 'bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200' },
};

// Toast no estilo do Flowbite (canto inferior direito).
export function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed right-4 bottom-4 z-[70] flex w-full max-w-xs flex-col gap-2';
    document.body.appendChild(container);
  }

  const style = TOAST_STYLES[type] || TOAST_STYLES.success;
  const item = document.createElement('div');
  item.className = 'flex w-full items-center rounded-lg bg-white p-4 text-gray-500 shadow-lg dark:bg-gray-800 dark:text-gray-400';
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.innerHTML = `
    <div class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.box}">${iconSvg(style.icon, 'h-5 w-5')}</div>
    <div class="ms-3 text-sm font-normal">${escapeHtml(message)}</div>
    <button type="button" class="icon-btn ms-auto -my-1.5 -me-1.5 h-8 w-8" aria-label="Fechar">${iconSvg('x', 'h-4 w-4')}</button>
  `;
  item.querySelector('button').addEventListener('click', () => item.remove());
  container.appendChild(item);

  setTimeout(() => item.remove(), type === 'error' ? 6000 : 3500);
}

// Confirmação no estilo do modal "popup" do Flowbite.
export function confirmDialog(message, { confirmLabel = 'Sim, excluir', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4 dark:bg-gray-900/80';
    overlay.innerHTML = `
      <div class="relative w-full max-w-md rounded-lg bg-white p-6 text-center shadow-sm dark:bg-gray-800" role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
        <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${danger ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'}">${iconSvg('triangle-alert', 'h-6 w-6')}</span>
        <p id="confirm-message" class="mb-6 text-base text-gray-600 dark:text-gray-300">${escapeHtml(message)}</p>
        <div class="flex justify-center gap-3">
          <button type="button" data-answer="yes" class="${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmLabel)}</button>
          <button type="button" data-answer="no" class="btn-secondary">Cancelar</button>
        </div>
      </div>
    `;

    function close(answer) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown, true);
      resolve(answer);
    }

    // Captura o Esc antes de um drawer aberto por baixo.
    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(false);
      }
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(false);
      }

      const answer = event.target.closest('[data-answer]')?.dataset.answer;
      if (answer) {
        close(answer === 'yes');
      }
    });

    document.addEventListener('keydown', onKeydown, true);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-answer="no"]').focus();
  });
}

export function optionsHtml(options, selected, placeholder) {
  const items = placeholder === undefined ? [] : [`<option value="">${escapeHtml(placeholder)}</option>`];

  options.forEach((option) => {
    const isSelected = String(option.value) === String(selected ?? '') ? ' selected' : '';
    items.push(`<option value="${escapeHtml(option.value)}"${isSelected}>${escapeHtml(option.label)}</option>`);
  });

  return items.join('');
}
