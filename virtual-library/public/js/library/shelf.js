// The grid of covers, or a message when there's nothing to show.
import { $, escapeHtml } from '../shared/dom.js';
import { byRecent, formatCount, formatRuntime } from '../shared/format.js';
import { categoryOf, isManga, kindOf, LEFT_OFF, platformOf } from '../shared/library.js';
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
  movie: { label: 'Duration', value: (i) => i.runtime, show: (i) => formatRuntime(i.runtime) },
  series: { label: 'Seasons', value: (i) => i.seasons, then: (i) => i.episodes,
    show: (i) => formatCount(i.seasons, 'season') },
  book: { label: 'Pages', value: (i) => i.pages, show: (i) => formatCount(i.pages, 'page') },
  comic: { label: 'Volumes', value: (i) => i.volumes, show: (i) => formatCount(i.volumes, 'volume') },
  game: { label: 'Playtime', value: (i) => i.hoursPlayed, doneOnly: true,
    show: (i) => (i.hoursPlayed ? `${i.hoursPlayed}h played` : '') },
};

/**
 * How a shelf can be sorted; the arrow next to it turns any of them the other way round. `doneOnly` ones need
 * a rating (or a playtime), so they're offered on the Done tab only. Ties are A–Z.
 */
export const SORTS = [
  { id: 'recent', label: 'Recent', compare: (a, b) => byRecent(a, b) || byTitle(a, b) },
  { id: 'title', label: 'Name', compare: byTitle },
  { id: 'rating', label: 'Rating', doneOnly: true,
    compare: (a, b) => Number(a.dropped) - Number(b.dropped) || (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b) },   // dropped last
];

/** The length sort for a kind (duration, seasons, pages, playtime). */
function lengthSort(category) {
  const length = LENGTHS[category];
  if (!length) return null;
  const compare = (a, b) => byMost(length.value)(a, b) || (length.then && byMost(length.then)(a, b)) || byTitle(a, b);
  return { id: 'length', label: length.label, doneOnly: length.doneOnly, compare };
}

/** Games by platform (A–Z, then the games A–Z); ones without a platform last. */
const PLATFORM_SORT = {
  id: 'platform', label: 'Platform',
  compare: (a, b) => {
    const [pa, pb] = [platformOf(a), platformOf(b)];
    return Number(!pa) - Number(!pb) || (pa && pb ? pa.localeCompare(pb) : 0) || byTitle(a, b);
  },
};

/** Manga/Comics by type: comics first, then manga (each A–Z). */
const TYPE_SORT = {
  id: 'type', label: 'Type',
  compare: (a, b) => Number(isManga(a)) - Number(isManga(b)) || byTitle(a, b),
};

/** The sorts offered on a tab of a kind. */
export const sortsFor = (category, status) =>
  [...SORTS, lengthSort(category), category === 'game' ? PLATFORM_SORT : null, category === 'comic' ? TYPE_SORT : null].filter((s) => s && (!s.doneOnly || status === 'done'));

/** Where you left off a pending book or comic, or a series not done: "Page 120", "Vol. 3", "S2 · E5". */
function leftOffText({ category, leftOff, seenUpTo }) {
  if (seenUpTo) return seenUpTo.episode ? `S${seenUpTo.season} · E${seenUpTo.episode}` : `Season ${seenUpTo.season}`;
  return leftOff ? `${LEFT_OFF[category] === 'page' ? 'Page' : 'Vol.'} ${leftOff}` : '';
}

function cardHtml(item, index, sort) {
  const meta = item.rating ? starsHtml(item.rating) : escapeHtml(item.year ?? '');
  // sorting by length: show it, so the order makes sense
  const fact = sort === 'length' ? LENGTHS[item.category]?.show(item) : sort === 'platform' ? platformOf(item) ?? ''
    : sort === 'type' ? kindOf(item) : leftOffText(item);
  return `
    <button type="button" class="card" data-item="${item.id}" style="--i:${Math.min(index, 20)}">
      ${coverHtml(item, '', item.note ? `<span class="card-note" title="Has a note">${icon('note')}</span>` : '')}
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="card-meta">${meta}</div>
      ${fact ? `<div class="card-fact">${escapeHtml(fact)}</div>` : ''}
    </button>`;
}

function emptyHtml({ category, status, inCategory, query }) {
  if (query) return `${icon('search')}<h2>No matches</h2>`;
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
 * Renders `items` (one category and status) in the order `context.sort` names (a SORTS id; recent by default),
 * or the other way round when `context.reversed`.
 * `animate` plays the cards' entrance: when the shelf opens and when the tab or the order changes.
 */
export function renderShelf(items, context, { animate = false } = {}) {
  const shelf = $('shelf');
  const empty = $('empty');
  const sort = sortsFor(context.category, context.status).find((s) => s.id === context.sort) ?? SORTS[0];
  const sorted = [...items].sort(sort.compare);
  if (context.reversed) sorted.reverse();

  shelf.innerHTML = sorted.map((item, index) => cardHtml(item, index, sort.id)).join('');
  shelf.classList.toggle('still', !animate);
  empty.hidden = sorted.length > 0;
  if (!sorted.length) empty.innerHTML = emptyHtml(context);
}
