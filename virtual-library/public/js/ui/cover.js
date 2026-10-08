import { escapeHtml } from '../shared/dom.js';
import { kindOf } from '../shared/library.js';
import { icon } from './icons.js';

// Each category's color family (a hue), and how far a title's own shade may drift from it.
const HUES = { movie: 330, series: 215, book: 45, comic: 18, game: 155 };
const HUE_SPREAD = 24;

/** The same title always gets the same shade, so a generated cover never changes. */
function hueFor(category, title) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return (HUES[category] ?? 260) + (hash % (2 * HUE_SPREAD + 1)) - HUE_SPREAD;
}

/**
 * A cover made up for items without a picture, like a book jacket: a gradient in the category's colors,
 * the kind, the title and a large faint icon. In small frames (thumbnails) only the icon shows (css/base.css).
 */
const generatedHtml = (category, title, kind) => `
  <div class="cover-generated" style="--hue:${hueFor(category, title)}">
    <span class="generated-mark">${icon(category)}</span>
    <span class="generated-kind">${kind}</span>
    <span class="generated-rule"></span>
    <span class="generated-title">${escapeHtml(title)}</span>
  </div>`;

/**
 * A cover image in a 2:3 frame, or a generated cover when there's no image (or it fails to load).
 * A dropped item (given up on) is greyed out, with a red "Dropped" band across the bottom.
 */
export function coverHtml({ image, title, category, source = null, dropped = false }, className = '') {
  const inner = image
    ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : generatedHtml(category, title, kindOf({ category, source }));
  const badge = dropped ? `<span class="cover-dropped">${icon('trash')}<span>Dropped</span></span>` : '';
  const kind = escapeHtml(kindOf({ category, source }));
  return `<div class="cover ${className} ${dropped ? 'dropped' : ''}" data-category="${category}" data-title="${escapeHtml(title)}" data-kind="${kind}">${inner}${badge}</div>`;
}

/** Images that didn't load (since the page opened): the home screen leaves their items off its tiles. */
export const failedImages = new Set();

/**
 * Swaps images that fail to load for a generated cover, and tells the page ('cover-failed', with the image's
 * address as `detail`). Call once.
 */
export function installCoverFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target instanceof HTMLImageElement ? e.target : null;
    const frame = img?.parentElement;
    if (!frame?.classList.contains('cover')) return;
    const src = img.getAttribute('src');
    failedImages.add(src);
    // only the image is replaced, so a "Dropped" band stays
    img.outerHTML = generatedHtml(frame.dataset.category, frame.dataset.title, frame.dataset.kind ?? '');
    document.dispatchEvent(new CustomEvent('cover-failed', { detail: src }));
  }, true);   // error events don't bubble, so listen while capturing
}
