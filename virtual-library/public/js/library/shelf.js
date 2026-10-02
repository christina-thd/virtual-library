// The grid of covers, or a message when there's nothing to show.
import { $, escapeHtml } from '../shared/dom.js';
import { byRecent, formatCount, formatRuntime } from '../shared/format.js';
import { categoryOf } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { starsHtml } from '../ui/stars.js';

/** "The Witcher" sorts under W, and "Part 2" before "Part 10". */
const sortTitle = (title) => title.toLocaleLowerCase().replace(/^(the|a|an)\s+/, '');
const byTitle = (a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title), undefined, { numeric: true, sensitivity: 'base' });

/** Biggest first; items without one last. */
const byMost = (valueOf) => (a, b) => (valueOf(b) ?? -Infinity) - (valueOf(a) ?? -Infinity);

/**
 * How long something is, per kind: what the Length sort orders by, and what the cards show while sorting by it.
 * Games: the hours you played, entered once done (so on the Done tab only).
 */
const LENGTHS = {
  movie: { label: 'Duration', name: 'Duration (longest first)', value: (i) => i.runtime, show: (i) => formatRuntime(i.runtime) },
  series: { label: 'Seasons', name: 'Seasons (most first)', value: (i) => i.seasons, then: (i) => i.episodes,
    show: (i) => formatCount(i.seasons, 'season') },
  book: { label: 'Pages', name: 'Pages (longest first)', value: (i) => i.pages, show: (i) => formatCount(i.pages, 'page') },
  game: { label: 'Playtime', name: 'Playtime (most first)', value: (i) => i.hoursPlayed, doneOnly: true,
    show: (i) => (i.hoursPlayed ? `${i.hoursPlayed}h played` : '') },
};

/**
 * How a shelf can be sorted. `label` is shown on the button, `name` in the list; `doneOnly` ones need
 * a rating (or a playtime), so they're offered on the Done tab only. Ties are A–Z.
 */
export const SORTS = [
  { id: 'recent', label: 'Recent', name: 'Recently added or finished', compare: (a, b) => byRecent(a, b) || byTitle(a, b) },
  { id: 'title', label: 'A–Z', name: 'Name (A–Z)', compare: byTitle },
  { id: 'rating', label: 'Rating', name: 'Rating (highest first)', doneOnly: true,
    compare: (a, b) => Number(a.dropped) - Number(b.dropped) || (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b) },   // dropped last
];

/** The length sort for a kind (duration, seasons, pages, playtime). */
function lengthSort(category) {
  const length = LENGTHS[category];
  if (!length) return null;
  const compare = (a, b) => byMost(length.value)(a, b) || (length.then && byMost(length.then)(a, b)) || byTitle(a, b);
  return { id: 'length', label: length.label, name: length.name, doneOnly: length.doneOnly, compare };
}

/** The sorts offered on a tab of a kind. */
export const sortsFor = (category, status) =>
  [...SORTS, lengthSort(category)].filter((s) => s && (!s.doneOnly || status === 'done'));

function cardHtml(item, index, sort) {
  const meta = item.rating ? starsHtml(item.rating) : escapeHtml(item.year ?? '');
  // sorting by length: show it, so the order makes sense
  const fact = sort === 'length' ? LENGTHS[item.category]?.show(item) : '';
  return `
    <button type="button" class="card" data-item="${item.id}" style="--i:${Math.min(index, 20)}">
      ${coverHtml(item)}
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="card-meta">${meta}</div>
      ${fact ? `<div class="card-fact">${escapeHtml(fact)}</div>` : ''}
    </button>`;
}

function emptyHtml({ category, status, inCategory }) {
  const kind = categoryOf(category).plural.toLowerCase();
  const [title, hint] = !inCategory
    ? [`No ${kind} yet`, 'Tap + to hoard your first one.']
    : {
      pending: ['Nothing pending', 'All caught up. Tap + to add something new.'],
      waiting: ['Nothing waiting', 'Series you’ve caught up on, waiting for a new season. Move one here from its page.'],
      done: [`No finished ${kind} yet`, 'Things you mark as done show up here, with your rating.'],
    }[status];
  return `${icon(category)}<h2>${title}</h2><p>${hint}</p>`;
}

/**
 * Renders `items` (one category and status) in the order `context.sort` names (a SORTS id; recent by default).
 * `animate` plays the cards' entrance: when the shelf opens and when the tab or the order changes.
 */
export function renderShelf(items, context, { animate = false } = {}) {
  const shelf = $('shelf');
  const empty = $('empty');
  const sort = sortsFor(context.category, context.status).find((s) => s.id === context.sort) ?? SORTS[0];
  const sorted = [...items].sort(sort.compare);

  shelf.innerHTML = sorted.map((item, index) => cardHtml(item, index, sort.id)).join('');
  shelf.classList.toggle('still', !animate);
  empty.hidden = sorted.length > 0;
  if (!sorted.length) empty.innerHTML = emptyHtml(context);
}
