import { escapeHtml } from '../shared/dom.js';
import { icon } from './icons.js';

const fallbackHtml = (category, title) => `<div class="cover-fallback">${icon(category)}<span>${escapeHtml(title)}</span></div>`;

/**
 * A cover image in a 2:3 frame. Without an image (or when it fails to load) it shows a tinted
 * placeholder with the category icon and the title instead.
 */
export function coverHtml({ image, title, category }, className = '') {
  const inner = image
    ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : fallbackHtml(category, title);
  return `<div class="cover ${className}" data-category="${category}" data-title="${escapeHtml(title)}">${inner}</div>`;
}

/** Swaps images that fail to load for the placeholder. Call once. */
export function installCoverFallback() {
  document.addEventListener('error', (e) => {
    const frame = e.target instanceof HTMLImageElement && e.target.parentElement;
    if (frame?.classList.contains('cover')) frame.innerHTML = fallbackHtml(frame.dataset.category, frame.dataset.title);
  }, true);   // error events don't bubble, so listen while capturing
}
