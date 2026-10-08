import { $, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;
let tappable = false;

/** Tapping a message dismisses it. */
function hideOnTap(el) {
  if (tappable) return;
  tappable = true;
  el.addEventListener('click', () => {
    clearTimeout(timer);
    el.classList.remove('show');
  });
}

/**
 * A short message at the top of the screen, always in the same place: sheets stop below it (--toast-room in
 * css/base.css), so it never covers their title or Close button. The page needs <div class="toast" id="toast">.
 * `icon` (an icons.js name, e.g. 'check') shows in front of it. Tapping it dismisses it.
 */
export function toast(message, { error = false, icon = null } = {}) {
  const el = $('toast');
  hideOnTap(el);
  el.innerHTML = `${icon ? `<span class="toast-icon">${iconHtml(icon)}</span>` : ''}<span class="toast-text">${escapeHtml(message)}</span>`;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), error ? 4000 : 2600);
}
