// Home: one tile per category, with how many are pending and done, and a few covers picked at random.
import { $ } from '../shared/dom.js';
import { CATEGORIES } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';

const TILE_COVERS = 3;

// category → ids of the items on its tile. Kept until coming back to the home screen (reshuffleHome), so the
// tiles don't reshuffle every time the library changes; an item that's removed is replaced by another random one.
const picked = new Map();

/** New random covers on the next render. */
export function reshuffleHome() {
  picked.clear();
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Up to TILE_COVERS random items of a category, the ones with a picture first. */
function tileItems(categoryId, items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const kept = (picked.get(categoryId) ?? []).filter((id) => byId.has(id));
  const others = shuffled(items.filter((item) => !kept.includes(item.id)))
    .sort((a, b) => Boolean(b.image) - Boolean(a.image));        // stable: still random within each group
  const ids = [...kept, ...others.map((item) => item.id)].slice(0, TILE_COVERS);
  picked.set(categoryId, ids);
  return ids.map((id) => byId.get(id));
}

function countsText(items) {
  if (!items.length) return 'Nothing hoarded yet';
  const done = items.filter((i) => i.status === 'done').length;
  return `${items.length - done} pending · ${done} done`;
}

function tileHtml(category, items) {
  const shown = tileItems(category.id, items);
  const covers = shown.length
    ? shown.map((item) => coverHtml(item)).join('')
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
