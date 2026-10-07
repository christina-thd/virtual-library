// Home: one tile per category, with how many are pending and done, and a few covers picked at random.
import { $, closest } from '../shared/dom.js';
import { CATEGORIES, statusesFor } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';

const TILE_COVERS = 3;

// category → ids of the items on its tile. Kept until coming back home (reshuffleHome), so the tiles don't
// reshuffle on every library change; a removed item is replaced by another random one.
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

/** Up to TILE_COVERS random items of the category with a real picture, not dropped. */
function tileItems(categoryId, items) {
  const byId = new Map(items.filter((item) => item.image && !item.dropped).map((item) => [item.id, item]));
  const kept = (picked.get(categoryId) ?? []).filter((id) => byId.has(id));
  const others = shuffled([...byId.values()].filter((item) => !kept.includes(item.id)));
  const ids = [...kept, ...others.map((item) => item.id)].slice(0, TILE_COVERS);
  picked.set(categoryId, ids);
  return ids.map((id) => byId.get(id));
}

/** "3 pending · 5 done"; series also "· 2 waiting" (left out while there are none). */
function countsText(categoryId, items) {
  if (!items.length) return 'Nothing hoarded yet';
  return statusesFor(categoryId)
    .map((status) => [status, items.filter((i) => i.status === status).length])
    .filter(([status, count]) => count || status !== 'waiting')
    .map(([status, count]) => `${count} ${status}`)
    .join(' · ');
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
        <span class="tile-counts">${countsText(category.id, items)}</span>
      </span>
      <span class="tile-covers">${covers}</span>
    </button>`;
}

/** The tiles of the kinds shown (`hidden` ones are left out, and so are their items in the counts). */
export function renderHome(items, hidden = []) {
  const library = items.filter((i) => !hidden.includes(i.category));
  const done = library.filter((i) => i.status === 'done').length;
  $('summary').textContent = library.length
    ? `${library.length} ${library.length === 1 ? 'story' : 'stories'} hoarded · ${done} finished`
    : 'Movies, series, books, comics & games — hoard them all';
  $('tiles').innerHTML = CATEGORIES.filter((c) => !hidden.includes(c.id)).map((c) => tileHtml(c, library.filter((i) => i.category === c.id))).join('');
}

/** Calls `onOpen(categoryId)` when a tile is tapped. */
export function onTileTap(onOpen) {
  $('tiles').addEventListener('click', (e) => {
    const tile = closest(e, '[data-open-category]');
    if (tile) onOpen(tile.dataset.openCategory);
  });
}
