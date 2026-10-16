import { DEFAULT_ICON, ICON_NAMES, ICONS, iconSvg } from './shared/icons.js';
import { openDrawer } from './drawer.js';
import { escapeHtml, normalizeText, optionsHtml } from './ui.js';

let modalCount = 0;

function fieldHtml(field, value, prefix) {
  const id = `${prefix}-${field.name}`;
  const required = field.required ? ' required' : '';
  const readonly = field.readonly ? ' readonly' : '';
  const hint = field.hint ? `<p class="hint">${escapeHtml(field.hint)}</p>` : '';
  const label = `<label for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="text-red-500">*</span>' : ''}</label>`;

  if (field.type === 'checkbox') {
    return `
      <div class="field">
        <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
          <input id="${id}" name="${field.name}" type="checkbox" class="checkbox"${value ? ' checked' : ''} />
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

  if (field.type === 'icon') {
    const selected = value || DEFAULT_ICON;
    return `
      <div class="field" data-icon-field>
        <span class="field-label">${escapeHtml(field.label)}</span>
        <input type="search" data-icon-search class="input-field mb-2" placeholder="Buscar ícone (ex.: troféu, espada, co-op)..." aria-label="Buscar ícone" />
        <div class="icon-grid" role="radiogroup" aria-label="${escapeHtml(field.label)}">
          ${ICON_NAMES.map(
            (name) => `
              <label class="icon-option" title="${escapeHtml(ICONS[name].label)}" data-icon-label="${escapeHtml(normalizeText(`${ICONS[name].label} ${name}`))}">
                <input type="radio" name="${field.name}" value="${name}" class="sr-only"${name === selected ? ' checked' : ''} />
                <span>${iconSvg(name, 'w-5 h-5')}<span class="sr-only">${escapeHtml(ICONS[name].label)}</span></span>
              </label>`
          ).join('')}
        </div>
        <p data-icon-empty class="hint hidden">Nenhum ícone encontrado.</p>
        ${hint}
      </div>`;
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
 * Abre um formulário num drawer lateral. onSubmit(values) pode lançar erro (mensagem exibida no drawer).
 * Resolve com o retorno de onSubmit, ou null se cancelado.
 */
export function openFormModal({ title, fields, values = {}, onSubmit, submitLabel = 'Salvar' }) {
  const prefix = `fm${++modalCount}`;

  return new Promise((resolve) => {
    let result = null;
    const drawer = openDrawer({
      title,
      onClose: () => resolve(result),
      body: `
        <form novalidate class="flex flex-1 flex-col">
          ${fields.map((field) => fieldHtml(field, values[field.name], prefix)).join('')}
          <p data-role="error" class="form-error hidden" role="alert"></p>
          <div class="mt-auto flex gap-3 pt-4">
            <button type="submit" class="btn-primary w-full">${escapeHtml(submitLabel)}</button>
            <button type="button" data-role="cancel" class="btn-secondary w-full">Cancelar</button>
          </div>
        </form>
      `,
    });

    const form = drawer.body.querySelector('form');
    const errorBox = form.querySelector('[data-role="error"]');
    const submitButton = form.querySelector('button[type="submit"]');

    function close(value) {
      result = value;
      drawer.close();
    }

    form.querySelector('[data-role="cancel"]').addEventListener('click', () => close(null));

    // Busca no seletor de ícones.
    form.addEventListener('input', (event) => {
      if (!event.target.matches('[data-icon-search]')) {
        return;
      }
      const container = event.target.closest('[data-icon-field]');
      const terms = normalizeText(event.target.value).split(' ').filter(Boolean);
      let visible = 0;
      container.querySelectorAll('[data-icon-label]').forEach((option) => {
        const show = terms.every((term) => option.dataset.iconLabel.includes(term));
        option.classList.toggle('hidden', !show);
        visible += show ? 1 : 0;
      });
      container.querySelector('[data-icon-empty]').classList.toggle('hidden', visible > 0);
    });

    // Enter na busca de ícone não deve enviar o formulário.
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('[data-icon-search]')) {
        event.preventDefault();
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

    form.querySelector('input:not([readonly]):not([type="hidden"]):not([type="radio"]), select, textarea')?.focus();
  });
}
