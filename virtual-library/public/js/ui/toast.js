import { $, closest, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;
let tappable = false;
let action = null;                  // the message's button: { label, run }

/** Tapping a message dismisses it; tapping its button does what it says, too. */
function hideOnTap(el) {
  if (tappable) return;
  tappable = true;
  el.addEventListener('click', (e) => {
    const run = closest(e, '[data-toast-action]') ? action?.run : null;
    hideToast();
    run?.();
  });
}

export function hideToast() {
  clearTimeout(timer);
  $('toast').classList.remove('show');
}

/**
 * A short message at the top of the screen, always in the same place: sheets stop below it (--toast-room in
 * css/base.css), so it never covers their title or Close button. The page needs <div class="toast" id="toast">.
 * `icon` (an icons.js name, e.g. 'check') shows in front of it, `action` ({ label, run }) as a button after it
 * (it stays a little longer). `sticky` ones stay until tapped or replaced. Tapping it dismisses it.
 */
export function toast(message, { error = false, icon = null, action: button = null, sticky = false } = {}) {
  const el = $('toast');
  hideOnTap(el);
  action = button;
  const buttonHtml = button ? `<button type="button" class="toast-action" data-toast-action>${escapeHtml(button.label)}</button>` : '';
  el.innerHTML = `${icon ? `<span class="toast-icon">${iconHtml(icon)}</span>` : ''}<span class="toast-text">${escapeHtml(message)}</span>${buttonHtml}`;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  if (!sticky) timer = setTimeout(hideToast, error ? 4000 : button ? 5000 : 2600);
}
