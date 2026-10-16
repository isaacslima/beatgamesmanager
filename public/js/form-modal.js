import { escapeHtml, optionsHtml } from './ui.js';

let modalCount = 0;

function fieldHtml(field, value, prefix) {
  const id = `${prefix}-${field.name}`;
  const required = field.required ? ' required' : '';
  const readonly = field.readonly ? ' readonly' : '';
  const hint = field.hint ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(field.hint)}</p>` : '';
  const label = `<label for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="text-red-500">*</span>' : ''}</label>`;

  if (field.type === 'checkbox') {
    return `
      <div class="field">
        <label class="flex items-center gap-2 cursor-pointer">
          <input id="${id}" name="${field.name}" type="checkbox" class="w-4 h-4 accent-blue-600"${value ? ' checked' : ''} />
          ${escapeHtml(field.label)}
        </label>
        ${hint}
      </div>`;
  }

  if (field.type === 'html') {
    return `<div class="field">${field.html}</div>`;
  }

  if (field.type === 'textarea') {
    return `<div class="field">${label}<textarea id="${id}" name="${field.name}" rows="3" class="input-field"${required}>${escapeHtml(value ?? '')}</textarea>${hint}</div>`;
  }

  if (field.type === 'select') {
    return `<div class="field">${label}<select id="${id}" name="${field.name}" class="input-field"${required}>${optionsHtml(field.options(), value, 'placeholder' in field ? field.placeholder : 'Selecione')}</select>${hint}</div>`;
  }

  if (field.type === 'file') {
    return `<div class="field">${label}<input id="${id}" name="${field.name}" type="file" accept="${escapeHtml(field.accept || '')}" class="input-field" />${hint}</div>`;
  }

  const extra = [
    field.min !== undefined ? ` min="${field.min}"` : '',
    field.max !== undefined ? ` max="${field.max}"` : '',
    field.maxlength ? ` maxlength="${field.maxlength}"` : '',
    field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '',
  ].join('');

  return `<div class="field">${label}<input id="${id}" name="${field.name}" type="${field.type || 'text'}" value="${escapeHtml(value ?? '')}" class="input-field"${required}${readonly}${extra} />${hint}</div>`;
}

/**
 * Abre um modal com formulário. onSubmit(values) pode lançar erro (mensagem exibida no modal).
 * Resolve com o retorno de onSubmit, ou null se cancelado.
 */
export function openFormModal({ title, fields, values = {}, onSubmit, submitLabel = 'Salvar' }) {
  const prefix = `fm${++modalCount}`;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="panel w-full max-w-md max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="${prefix}-title">
        <h2 id="${prefix}-title" class="panel-title">${escapeHtml(title)}</h2>
        <form novalidate>
          ${fields.map((field) => fieldHtml(field, values[field.name], prefix)).join('')}
          <p data-role="error" class="hidden text-sm text-red-600 mb-3" role="alert"></p>
          <div class="flex justify-end gap-3">
            <button type="button" data-role="cancel" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector('form');
    const errorBox = overlay.querySelector('[data-role="error"]');
    const submitButton = form.querySelector('button[type="submit"]');

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        close(null);
      }
    }

    overlay.querySelector('[data-role="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const formValues = {};
      fields.forEach((field) => {
        const input = form.elements[field.name];
        if (!input) {
          return;
        }
        if (field.type === 'checkbox') {
          formValues[field.name] = input.checked;
        } else if (field.type === 'file') {
          formValues[field.name] = input.files[0] || null;
        } else {
          formValues[field.name] = input.value;
        }
      });

      errorBox.classList.add('hidden');
      submitButton.disabled = true;

      try {
        close(await onSubmit(formValues));
      } catch (error) {
        errorBox.textContent = error.message || 'Erro ao salvar.';
        errorBox.classList.remove('hidden');
        submitButton.disabled = false;
      }
    });

    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    form.querySelector('input:not([readonly]):not([type="hidden"]), select, textarea')?.focus();
  });
}
