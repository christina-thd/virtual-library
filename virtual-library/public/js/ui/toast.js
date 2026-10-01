import { $, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;

/**
 * A short message at the top of the screen. The page needs <div class="toast" id="toast">.
 * `icon` (an icons.js name, e.g. 'check') shows in front of it.
 */
export function toast(message, { error = false, icon = null } = {}) {
  const el = $('toast');
  el.innerHTML = `${icon ? `<span class="toast-icon">${iconHtml(icon)}</span>` : ''}<span class="toast-text">${escapeHtml(message)}</span>`;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), error ? 4000 : 2600);
}
