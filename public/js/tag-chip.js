import { statusBadgeClass } from './constants.js';
import { iconSvg } from './shared/icons.js';
import { escapeHtml } from './ui.js';

export function tagChip(tag, { extraClass = '' } = {}) {
  if (!tag) {
    return '';
  }

  return `<span class="tag-chip ${statusBadgeClass(tag.color)} ${extraClass}">${iconSvg(tag.icon, 'w-3.5 h-3.5 shrink-0')}<span>${escapeHtml(tag.name)}</span></span>`;
}
