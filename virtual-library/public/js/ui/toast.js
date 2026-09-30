import { $ } from '../shared/dom.js';

let timer = null;

/** A short message at the bottom of the screen. The page needs <div class="toast" id="toast">. */
export function toast(message, { error = false } = {}) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), error ? 4000 : 2400);
}
