// Home: one tile per category, with how many are pending and done, and its newest covers.
import { $ } from '../shared/dom.js';
import { byRecent } from '../shared/format.js';
import { CATEGORIES } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';

const TILE_COVERS = 3;

function countsText(items) {
  if (!items.length) return 'Nothing hoarded yet';
  const done = items.filter((i) => i.status === 'done').length;
  return `${items.length - done} pending · ${done} done`;
}

function tileHtml(category, items) {
  const recent = [...items].sort(byRecent).slice(0, TILE_COVERS).reverse();   // newest in front
  const covers = recent.length
    ? recent.map((item) => coverHtml(item)).join('')
    : '<div class="cover ghost"></div>'.repeat(TILE_COVERS);
  return `
    <button type="button" class="tile" data-open-category="${category.id}" data-category="${category.id}">
      <span class="tile-icon">${icon(category.id)}</span>
      <span class="tile-text">
        <span class="tile-name">${category.plural}</span>
        <span class="tile-counts">${countsText(items)}</span>
      </span>
      <span class="tile-covers">${covers}</span>
    </button>`;
}

export function renderHome(library) {
  const done = library.filter((i) => i.status === 'done').length;
  $('summary').textContent = library.length
    ? `${library.length} ${library.length === 1 ? 'story' : 'stories'} hoarded · ${done} finished`
    : 'Movies, series, books & games — hoard them all';
  $('tiles').innerHTML = CATEGORIES.map((c) => tileHtml(c, library.filter((i) => i.category === c.id))).join('');
}

/** Calls `onOpen(categoryId)` when a tile is tapped. */
export function onTileTap(onOpen) {
  $('tiles').addEventListener('click', (e) => {
    const tile = e.target.closest('[data-open-category]');
    if (tile) onOpen(tile.dataset.openCategory);
  });
}
