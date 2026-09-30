import { MAX_RATING } from '../shared/library.js';
import { star } from './icons.js';

const range = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

/** Small read-only stars, e.g. ★★★★☆ under a cover. */
export function starsHtml(rating) {
  return `<span class="stars" aria-label="${rating} of ${MAX_RATING} stars">${range.map((n) => star(n <= rating ? '' : 'off')).join('')}</span>`;
}

/** Big tappable stars. Each button has data-rate="n". */
export function starInputHtml(rating) {
  return `<div class="star-input" role="group" aria-label="Your rating">${range.map((n) => `
    <button type="button" data-rate="${n}" class="${n <= (rating ?? 0) ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}"
            aria-pressed="${n === rating}">${star()}</button>`).join('')}</div>`;
}

/** Lights up the first `rating` stars right away, before the server confirms. */
export function previewStars(container, rating) {
  for (const button of container.querySelectorAll('[data-rate]')) {
    button.classList.toggle('on', Number(button.dataset.rate) <= (rating ?? 0));
  }
}
