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

export function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm';
    document.body.appendChild(container);
  }

  const item = document.createElement('div');
  const colors = type === 'error' ? 'bg-red-600' : 'bg-gray-900';
  item.className = `${colors} text-white text-sm rounded-lg shadow-lg px-4 py-3`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.textContent = message;
  container.appendChild(item);

  setTimeout(() => item.remove(), type === 'error' ? 6000 : 3500);
}

export function confirmDialog(message, { confirmLabel = 'Excluir', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="panel w-full max-w-sm" role="dialog" aria-modal="true">
        <p class="text-sm text-gray-700 mb-5">${escapeHtml(message)}</p>
        <div class="flex justify-end gap-3">
          <button type="button" data-answer="no" class="btn-secondary">Cancelar</button>
          <button type="button" data-answer="yes" class="${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    function close(answer) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(answer);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
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

    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-answer="yes"]').focus();
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
