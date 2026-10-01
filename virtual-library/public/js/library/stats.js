// Stats: what you finished per month, your genres, time spent, ratings and backlog, for the whole library or one
// category (the switch at the top). The numbers come from shared/stats.js.
import { $, escapeHtml } from '../shared/dom.js';
import { CATEGORIES, categoryOf } from '../shared/library.js';
import { libraryStats } from '../shared/stats.js';
import { coverHtml } from '../ui/cover.js';
import { icon, star } from '../ui/icons.js';

const SHORT_MONTH = new Intl.DateTimeFormat('en', { month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const number = (n) => n.toLocaleString('en');
const monthName = (m) => SHORT_MONTH.format(new Date(m.year, m.month, 1));
const monthAndYear = (m) => MONTH_YEAR.format(new Date(m.year, m.month, 1));

const section = (title, body, note = '') => `
  <section class="stats-card">
    <h2>${title}${note ? `<span class="stats-note">${note}</span>` : ''}</h2>
    ${body}
  </section>`;

function summaryHtml(s) {
  const cell = (value, label) => `<div class="stats-number"><strong>${number(value)}</strong><span>${label}</span></div>`;
  return `<div class="stats-summary">
    ${cell(s.finished, 'finished')}
    ${cell(s.finishedThisYear, 'this year')}
    ${cell(s.pending + s.waiting, s.waiting ? `pending (${s.waiting} waiting)` : 'pending')}
    ${cell(s.dropped, 'dropped')}
  </div>`;
}

/** Bars for the last 12 months; for the whole library each bar is split by category, in their colors. */
function monthsHtml(s, category) {
  const most = Math.max(1, ...s.months.map((m) => m.total));
  const bars = s.months.map((m) => {
    const parts = category
      ? [[category, m.total]]
      : CATEGORIES.map((c) => [c.id, m.byCategory[c.id] ?? 0]).filter(([, n]) => n);
    const segments = parts.map(([id, n]) => `<span class="bar-part" data-category="${id}" style="flex-grow:${n}"></span>`).join('');
    return `
      <div class="bar" title="${monthAndYear(m)}: ${m.total} finished">
        <span class="bar-count">${m.total || ''}</span>
        <span class="bar-fill" style="height:${(m.total / most) * 100}%">${segments}</span>
        <span class="bar-month">${monthName(m)}</span>
      </div>`;
  }).join('');
  const legend = category ? '' : `<div class="stats-legend">${CATEGORIES.map((c) =>
    `<span data-category="${c.id}"><i></i>${c.plural}</span>`).join('')}</div>`;
  // the busiest month, when one stands out; and since when it counts (what was finished before has no date)
  const counting = s.since ? `Counting since ${DAY.format(new Date(s.since))}` : '';
  const busiest = s.busiest?.total > 1 ? `Busiest: ${monthAndYear(s.busiest)} · ${s.busiest.total}` : '';
  const foot = [busiest, counting].filter(Boolean).join(' · ');
  return section('Finished per month', `<div class="stats-bars">${bars}</div>${legend}${foot ? `<p class="stats-foot">${foot}</p>` : ''}`);
}

/** Time spent: hours of movies, episodes, pages, hours played; one tile per kind (only its own for one category). */
function timeHtml(s, category) {
  const tiles = {
    movie: [`${number(Math.round(s.time.movieMinutes / 60))}h`, 'of movies'],
    series: [number(s.time.episodes), 'episodes'],
    book: [number(s.time.pages), 'pages read'],
    game: [`${number(s.time.hours)}h`, 'played'],
  };
  const shown = category ? [category] : Object.keys(tiles);
  return section('Time spent', `<div class="stats-summary">${shown.map((id) =>
    `<div class="stats-number" data-category="${id}"><strong>${tiles[id][0]}</strong><span>${icon(id)}${tiles[id][1]}</span></div>`).join('')}</div>`);
}

function genreRows(genres) {
  const most = genres[0]?.count ?? 1;
  return genres.map((g) => `
    <div class="genre-row">
      <span class="genre-name">${escapeHtml(g.name)}</span>
      <span class="genre-bar"><i style="width:${(g.count / most) * 100}%"></i></span>
      <span class="genre-count">${g.count}</span>
    </div>`).join('');
}

/** Top genres of what you finished: one category's top five, or each category's top three. */
function genresHtml(s, category) {
  const empty = '<p class="stats-empty">No genres yet: they show up for finished items found in a catalog.</p>';
  if (category) return section('Top genres', s.genres.length ? `<div data-category="${category}">${genreRows(s.genres)}</div>` : empty);
  const groups = CATEGORIES.filter((c) => s.genresByCategory[c.id].length).map((c) => `
    <div class="genre-group" data-category="${c.id}">
      <h3>${icon(c.id)}${c.plural}</h3>
      ${genreRows(s.genresByCategory[c.id])}
    </div>`).join('');
  return section('Top genres', groups || empty);
}

/** Average rating and the 1–5 star spread; for the whole library also each category's average. */
function ratingsHtml(s, category, items) {
  const r = s.ratings;
  if (!r.rated) return section('Ratings', '<p class="stats-empty">Nothing rated yet.</p>');
  const most = Math.max(...Object.values(r.stars));
  const rows = [5, 4, 3, 2, 1].map((n) => `
    <div class="genre-row">
      <span class="genre-name rating-stars">${n} ${star()}</span>
      <span class="genre-bar"><i style="width:${(r.stars[n] / most) * 100}%"></i></span>
      <span class="genre-count">${r.stars[n]}</span>
    </div>`).join('');
  const perCategory = category ? '' : `<div class="stats-averages">${CATEGORIES.map((c) => {
    const { average } = libraryStats(items, { category: c.id }).ratings;   // all time: no dates needed
    return average ? `<span data-category="${c.id}">${icon(c.id)}${average.toFixed(1)}</span>` : '';
  }).join('')}</div>`;
  return section('Ratings', `
    <div class="stats-average"><strong>${r.average.toFixed(1)}</strong>${star()}<span>average of ${r.rated} rated</span></div>
    ${perCategory}
    <div class="stats-rows">${rows}</div>`);
}

/** The oldest thing still pending: maybe time to start it (or let it go). */
function backlogHtml(s) {
  const item = s.oldestPending;
  if (!item) return section('Backlog', '<p class="stats-empty">Nothing pending. All caught up!</p>');
  const since = MONTH_YEAR.format(new Date(item.addedAt));
  return section('Backlog', `
    <button type="button" class="stats-oldest" data-item="${item.id}">
      ${coverHtml(item)}
      <span><span class="stats-note">Waiting the longest, since ${since}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="stats-kind" data-category="${item.category}">${icon(item.category)}${categoryOf(item.category).label}</span></span>
    </button>`);
}

/** @param {{ onBack: () => void, onOpenItem: (id: string) => void }} options */
export function createStatsView({ onBack, onOpenItem }) {
  const view = $('statsView');
  const body = $('statsBody');
  const filter = $('statsFilter');
  let category = null;              // null: the whole library
  let library = [];
  let since = 0;                    // when the stats started counting (from the server)
  let shown = false;

  $('statsBack').innerHTML = icon('back');
  $('statsBack').addEventListener('click', onBack);
  $('statsTitle').innerHTML = `${icon('chart')}<span>Stats</span>`;
  filter.classList.add('segmented');
  filter.innerHTML = [{ id: '', plural: 'All' }, ...CATEGORIES].map((c) =>
    `<button type="button" role="tab" data-filter="${c.id}">${c.plural}</button>`).join('');

  function render() {
    if (!shown) return;
    for (const button of filter.children) {
      const selected = button.dataset.filter === (category ?? '');
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', selected);
    }
    view.dataset.category = category ?? '';
    const s = libraryStats(library, { category, since });
    body.innerHTML = s.total
      ? summaryHtml(s) + monthsHtml(s, category) + timeHtml(s, category) + genresHtml(s, category)
        + ratingsHtml(s, category, library) + backlogHtml(s)
      : `<div class="empty">${icon('chart')}<h2>No stats yet</h2><p>Add a few things and finish them: they'll show up here.</p></div>`;
  }

  filter.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    category = button.dataset.filter || null;
    render();
  });

  body.addEventListener('click', (e) => {
    const oldest = e.target.closest('[data-item]');
    if (oldest) onOpenItem(oldest.dataset.item);
  });

  // like a category: the bar gets a background once the page scrolls under it
  new IntersectionObserver(([entry]) => $('statsHead').classList.toggle('stuck', !entry.isIntersecting))
    .observe($('statsSentinel'));

  return {
    show() {
      shown = true;
      category = null;                              // always opens on the whole library
      render();
    },
    hide() {
      shown = false;
    },
    /** @param {object[]} items  @param {number} statsSince  when the stats started counting */
    update(items, statsSince = 0) {
      library = items;
      since = statsSince;
      render();
    },
  };
}
