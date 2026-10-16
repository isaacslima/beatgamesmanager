// Painel lateral (drawer) no estilo do Flowbite, empilhável, com foco preso e Esc para fechar.
import { iconSvg } from './shared/icons.js';
import { escapeHtml } from './ui.js';

const stack = [];
let count = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onKeydown(event) {
  const top = stack[stack.length - 1];
  if (!top) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    top.close();
    return;
  }

  if (event.key === 'Tab') {
    const focusable = [...top.panel.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null);
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!top.panel.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }
}

/**
 * Abre um drawer. `body` é o HTML do conteúdo. Retorna { panel, body, close }.
 * `onClose` é chamado depois que o painel some.
 */
export function openDrawer({ title, body, width = 'max-w-md', onClose }) {
  const id = `drawer-${++count}`;
  const zIndex = 50 + stack.length * 2;
  const previousFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop opacity-0 transition-opacity duration-200';
  backdrop.style.zIndex = String(zIndex);

  const panel = document.createElement('div');
  panel.className = `drawer ${width} translate-x-full`;
  panel.style.zIndex = String(zIndex + 1);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', `${id}-title`);
  panel.tabIndex = -1;
  panel.innerHTML = `
    <div class="mb-6 flex items-center justify-between gap-3">
      <h2 id="${id}-title" class="drawer-title mb-0">${escapeHtml(title)}</h2>
      <button type="button" data-role="drawer-close" class="icon-btn" aria-label="Fechar">${iconSvg('x', 'h-5 w-5')}</button>
    </div>
    <div data-role="drawer-body" class="flex flex-1 flex-col">${body}</div>
  `;

  let closed = false;
  const entry = { panel, close };

  function close() {
    if (closed) {
      return;
    }
    closed = true;
    stack.splice(stack.indexOf(entry), 1);
    if (!stack.length) {
      document.removeEventListener('keydown', onKeydown);
      document.body.classList.remove('overflow-hidden');
    }
    panel.classList.add('translate-x-full');
    backdrop.classList.add('opacity-0');
    setTimeout(() => {
      panel.remove();
      backdrop.remove();
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
      onClose?.();
    }, 200);
  }

  backdrop.addEventListener('click', close);
  panel.querySelector('[data-role="drawer-close"]').addEventListener('click', close);

  if (!stack.length) {
    document.addEventListener('keydown', onKeydown);
  }
  stack.push(entry);
  document.body.classList.add('overflow-hidden');
  document.body.append(backdrop, panel);

  requestAnimationFrame(() => {
    panel.classList.remove('translate-x-full');
    backdrop.classList.remove('opacity-0');
  });

  return { panel, body: panel.querySelector('[data-role="drawer-body"]'), close };
}
