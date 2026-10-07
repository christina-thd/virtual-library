// Stats page: streaks, finished per month, time spent, genres, creators, records, decades (not games),
// ratings, backlog and the year in review, for the whole library or one kind (manga and comics apart).
// Numbers: shared/stats.js.
import { $, closest, escapeHtml } from '../shared/dom.js';
import { formatCount, formatRuntime } from '../shared/format.js';
import { CATEGORIES, kindOf } from '../shared/library.js';
import { libraryStats, STAT_KINDS } from '../shared/stats.js';
import { coverHtml } from '../ui/cover.js';
import { icon, star } from '../ui/icons.js';
import { starsHtml } from '../ui/stars.js';

const SHORT_MONTH = new Intl.DateTimeFormat('en', { month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
const LONG_MONTH = new Intl.DateTimeFormat('en', { month: 'long' });
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
    ${cell(s.streak.current, s.streak.current === 1 ? 'month in a row' : 'months in a row')}
    ${cell(s.streak.best, 'best streak')}
  </div>`;
}

/** Bars for the last 12 months; for the whole library each bar is split by category, in their colors. */
function monthsHtml(s, kind) {
  const category = tintOf(kind);
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
  const legend = category ? '' : `<div class="stats-legend">${CATEGORIES.filter((c) => shownKinds.some((k) => k.category === c.id)).map((c) =>
    `<span data-category="${c.id}"><i></i>${c.plural}</span>`).join('')}</div>`;
  // the busiest month, when one stands out; and since when it counts (what was finished before has no date)
  const counting = s.since ? `Counting since ${DAY.format(new Date(s.since))}` : '';
  const busiest = s.busiest?.total > 1 ? `Busiest: ${monthAndYear(s.busiest)} · ${s.busiest.total}` : '';
  const foot = [busiest, counting].filter(Boolean).join(' · ');
  return section('Finished per month', `<div class="stats-bars">${bars}</div>${legend}${foot ? `<p class="stats-foot">${foot}</p>` : ''}`);
}

/** One kind (null: all of them). */
// the kinds whose category isn't hidden (from the home screen's settings)
let shownKinds = STAT_KINDS;
const kindsOf = (kind) => shownKinds.filter((k) => !kind || k.id === kind);
/** The category whose color a kind has (manga and comics: Manga/Comics'). */
const tintOf = (kind) => (kind ? STAT_KINDS.find((k) => k.id === kind).category : null);
const kindIcon = (kind) => icon(STAT_KINDS.find((k) => k.id === kind).icon);

/** Each kind's time: [value, label]. */
const timeTiles = (time) => ({
  movie: [`${number(Math.round(time.movieMinutes / 60))}h`, 'of movies'],
  series: [number(time.episodes), 'episodes'],
  book: [number(time.pages), 'pages read'],
  manga: [number(time.volumes), time.volumes === 1 ? 'manga volume' : 'manga volumes'],
  comic: [number(time.comics), time.comics === 1 ? 'comic read' : 'comics read'],
  game: [`${number(time.hours)}h`, 'playtime'],
});

/** Time tiles of the given kinds. */
const timeNumbers = (time, kinds) => {
  const tiles = timeTiles(time);
  return kinds.map((k) => `<div class="stats-number" data-category="${k.category}"><strong>${tiles[k.id][0]}</strong><span>${icon(k.icon)}${tiles[k.id][1]}</span></div>`).join('');
};

/** What the time card is called: time only for movies and games; a count for the others; "Totals" for them all. */
const TIME_TITLES = { movie: 'Time spent', series: 'Episodes watched', book: 'Pages read', manga: 'Total volumes read', comic: 'Total comics read', game: 'Time spent' };
const timeTitle = (kind) => (kind ? TIME_TITLES[kind] : 'Totals');

/** Hours of movies, episodes, pages, manga volumes, comics, playtime: a tile per kind (one for one kind). */
function timeHtml(s, kind) {
  return section(timeTitle(kind), `<div class="stats-summary">${timeNumbers(s.time, kindsOf(kind))}</div>`);
}

/** A list per kind (manga and comics apart), each under its name. */
const groupsHtml = (byKind, title, rows) => kindsOf(null).filter((k) => byKind[k.id]?.length).map((k) => `
    <div class="genre-group" data-category="${k.category}">
      <h3>${icon(k.icon)}${title(k)}</h3>
      ${rows(byKind[k.id])}
    </div>`).join('');

function genreRows(genres) {
  const most = genres[0]?.count ?? 1;
  return genres.map((g) => `
    <div class="genre-row">
      <span class="genre-name">${escapeHtml(g.name)}</span>
      <span class="genre-bar"><i style="width:${(g.count / most) * 100}%"></i></span>
      <span class="genre-count">${g.count}</span>
    </div>`).join('');
}

/** Top genres of what you finished: one kind's top five, or each kind's top three. */
function genresHtml(s, kind) {
  const empty = '<p class="stats-empty">No genres yet: they show up for finished items found in a catalog.</p>';
  if (s.genres) return section('Top genres', s.genres.length ? `<div data-category="${tintOf(kind)}">${genreRows(s.genres)}</div>` : empty);
  return section('Top genres', groupsHtml(s.genresByKind, (k) => k.plural, genreRows) || empty);
}

/** The chosen year: how much of each kind, the favourite, top genres, busiest month, time spent. A switch per year. */
function reviewHtml(s, kind) {
  const r = s.review;
  const years = s.years.length > 1 ? `<div class="stats-years">${s.years.map((y) =>
    `<button type="button" data-year="${y}" class="${y === r.year ? 'selected' : ''}">${y}</button>`).join('')}</div>` : '';
  if (!r.finished) return section('Year in review', `${years}<p class="stats-empty">Nothing finished in ${r.year} yet.</p>`);
  const kinds = CATEGORIES.filter((c) => r.byCategory[c.id]).map((c) =>
    `<span data-category="${c.id}">${icon(c.id)}${r.byCategory[c.id]}</span>`).join('');
  const tiles = timeTiles(r.time);
  const spent = kindsOf(kind).filter((k) => tiles[k.id][0] !== '0' && tiles[k.id][0] !== '0h');
  const time = spent.length ? `
    <div class="review-time"><span class="stats-note">${timeTitle(kind)}</span>
      <div class="stats-summary">${timeNumbers(r.time, spent)}</div>
    </div>` : '';
  const facts = [
    r.genres.length ? ['Top genres', r.genres.map((g) => escapeHtml(g.name)).join(', ')] : null,
    r.busiestMonth != null ? ['Busiest month', LONG_MONTH.format(new Date(r.year, r.busiestMonth, 1))] : null,
  ].filter(Boolean).map(([label, value]) => `<div class="review-fact"><span>${label}</span><strong>${value}</strong></div>`).join('');
  const favourite = r.favourite ? `
    <button type="button" class="stats-oldest" data-item="${r.favourite.id}">
      ${coverHtml(r.favourite)}
      <span><span class="stats-note">Your favourite</span><strong>${escapeHtml(r.favourite.title)}</strong>${starsHtml(r.favourite.rating)}</span>
    </button>` : '';
  return section('Year in review', `${years}
    <div class="review-total"><strong>${number(r.finished)}</strong><span>finished in ${r.year}</span></div>
    ${kind ? '' : `<div class="stats-averages">${kinds}</div>`}
    ${favourite}${facts}${time}`);
}

const CREATOR_TITLES = { movie: 'Directors', series: 'Networks', book: 'Authors' };

/** Whose work you finished most: directors, networks and authors (not games, manga or comics). */
function creatorsHtml(s, kind) {
  const empty = '<p class="stats-empty">Nobody twice yet: they show up once you finish two by the same one.</p>';
  if (s.creators) {
    return section(`Top ${CREATOR_TITLES[kind].toLowerCase()}`, s.creators.length ? `<div data-category="${tintOf(kind)}">${genreRows(s.creators)}</div>` : empty);
  }
  if (!s.creatorsByKind) return '';
  return section('Top creators', groupsHtml(s.creatorsByKind, (k) => CREATOR_TITLES[k.id], genreRows) || empty);
}

/** Comics: how many of each publisher's you finished (Marvel, DC…). */
function publishersHtml(s) {
  if (!s.publishers) return '';
  return section('Publishers', s.publishers.length
    ? `<div data-category="comic">${genreRows(s.publishers)}</div>`
    : '<p class="stats-empty">No publishers yet: they show up for finished comics.</p>');
}

/** How a record reads: "2h 47m", "608 pages", "26 episodes", "140h played". */
const RECORD_TEXT = {
  movie: (v) => formatRuntime(v), book: (v) => formatCount(v, 'page'), series: (v) => formatCount(v, 'episode'), manga: (v) => formatCount(v, 'volume'), game: (v) => `${v}h played`,
};
const RECORD_NAME = { movie: 'Longest movie', book: 'Biggest book', series: 'Longest series', manga: 'Longest manga', game: 'Most played' };

/** The longest movie, biggest book, longest series and manga, most-played game (one kind: its top three). */
function recordsHtml(s, kind) {
  if (kind && !RECORD_NAME[kind]) return '';                           // comics: each one is one book, no length
  if (!s.records.length) return section('Records', '<p class="stats-empty">No records yet: they need finished items with their length.</p>');
  const one = Boolean(kind);                                            // one kind: its top three, numbered
  const rows = s.records.map(({ item, kind: k, value }, i) => `
    <button type="button" class="stats-oldest" data-item="${item.id}">
      ${coverHtml(item)}
      <span><span class="stats-note">${one ? `#${i + 1}` : RECORD_NAME[k]}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="stats-kind" data-category="${item.category}">${kindIcon(k)}${RECORD_TEXT[k](value)}</span></span>
    </button>`).join('');
  return section('Records', `<div class="stats-list">${rows}</div>`);
}

/** Movies, series and books by when they came out: a bar per decade (only for these: a game's year says less, often a
 * port's). */
function decadesHtml(s, kind) {
  if (!['movie', 'series', 'book'].includes(kind) || !s.decades.length) return '';
  const most = Math.max(...s.decades.map((d) => d.total));
  const rows = s.decades.map((d) => {
    const segments = `<i data-category="${tintOf(kind)}" style="width:${(d.total / most) * 100}%"></i>`;
    return `
      <div class="genre-row">
        <span class="genre-name">${d.decade}s</span>
        <span class="genre-bar decade-bar">${segments}</span>
        <span class="genre-count">${d.total}</span>
      </div>`;
  }).join('');
  return section('Release decades', rows);
}

/** Average rating and the 1–5 star spread; for the whole library also each kind's average. */
function ratingsHtml(s, kind, items) {
  const r = s.ratings;
  if (!r.rated) return section('Ratings', '<p class="stats-empty">Nothing rated yet.</p>');
  const most = Math.max(...Object.values(r.stars));
  const rows = [5, 4, 3, 2, 1].map((n) => `
    <div class="genre-row">
      <span class="genre-name rating-stars">${n} ${star()}</span>
      <span class="genre-bar"><i style="width:${(r.stars[n] / most) * 100}%"></i></span>
      <span class="genre-count">${r.stars[n]}</span>
    </div>`).join('');
  const perCategory = kind ? '' : `<div class="stats-averages">${shownKinds.map((k) => {
    const { average } = libraryStats(items, { kind: k.id }).ratings;   // all time: no dates needed
    return average ? `<span data-category="${k.category}" title="${k.plural}">${icon(k.icon)}${average.toFixed(1)}</span>` : '';
  }).join('')}</div>`;
  return section('Ratings', `
    <div class="stats-average"><strong>${r.average.toFixed(1)}</strong>${star()}<span>average of ${r.rated} rated</span></div>
    ${perCategory}
    <div class="stats-rows">${rows}</div>`);
}

/** The oldest thing still pending (the whole library: each category's): maybe time to start it, or let it go. */
function backlogHtml(s) {
  const items = s.oldestPendingByCategory ?? (s.oldestPending ? [s.oldestPending] : []);
  if (!items.length) return section('Backlog', '<p class="stats-empty">Nothing pending. All caught up!</p>');
  // the whole library: a cover per category
  if (s.oldestPendingByCategory) {
    const covers = items.map((item) => `
      <button type="button" class="backlog-cover" data-item="${item.id}" aria-label="${escapeHtml(item.title)}">
        ${coverHtml(item)}
        <span class="stats-kind" data-category="${item.category}">${MONTH_YEAR.format(new Date(item.addedAt))}</span>
      </button>`).join('');
    return section('Backlog', `<p class="stats-note backlog-note">Waiting the longest, since</p><div class="backlog-covers">${covers}</div>`);
  }
  const rows = items.map((item) => `
    <button type="button" class="stats-oldest" data-item="${item.id}">
      ${coverHtml(item)}
      <span><span class="stats-note">Waiting the longest, since ${MONTH_YEAR.format(new Date(item.addedAt))}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="stats-kind" data-category="${item.category}">${icon(item.category)}${kindOf(item)}</span></span>
    </button>`).join('');
  return section('Backlog', `<div class="stats-list">${rows}</div>`);
}

/** @param {{ onBack: () => void, onOpenItem: (id: string) => void }} options */
export function createStatsView({ onBack, onOpenItem }) {
  const view = $('statsView');
  const body = $('statsBody');
  const filter = $('statsFilter');
  let kind = null;                  // a STAT_KINDS id; null: the whole library
  let library = [];                 // the items of the kinds shown
  let since = 0;                    // when the stats started counting (from the server)
  let settingUp = false;            // setting up for the first time: no stats until it's done
  let year = new Date().getFullYear();   // the one in review
  let shown = false;

  $('statsBack').innerHTML = icon('back');
  $('statsBack').addEventListener('click', onBack);
  $('statsTitle').innerHTML = `${icon('chart')}<span>Stats</span>`;
  filter.classList.add('segmented');
  // "All", then each kind as its icon (named for screen readers)
  function renderTabs() {
    filter.innerHTML = `<button type="button" role="tab" data-filter="">All</button>${shownKinds.map((k) =>
      `<button type="button" role="tab" data-filter="${k.id}" aria-label="${k.plural}" title="${k.plural}">${icon(k.icon)}</button>`).join('')}`;
  }
  renderTabs();

  function render() {
    if (!shown) return;
    for (const button of /** @type {HTMLCollectionOf<HTMLElement>} */ (filter.children)) {
      const selected = button.dataset.filter === (kind ?? '');
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    }
    view.dataset.category = tintOf(kind) ?? '';
    let s = libraryStats(library, { kind, since, year });
    // a year picked for another kind may not exist for this one (no switch to get back): its newest instead
    if (!s.years.includes(year)) s = libraryStats(library, { kind, since, year: (year = s.years[0]) });
    body.innerHTML = settingUp
      ? `<div class="empty">${icon('chart')}<h2>Stats start after setup</h2><p>Tap Start stats on the home screen.</p></div>`
      : s.total
      ? summaryHtml(s) + monthsHtml(s, kind) + timeHtml(s, kind) + genresHtml(s, kind)
        + creatorsHtml(s, kind) + publishersHtml(s) + recordsHtml(s, kind) + decadesHtml(s, kind)
        + ratingsHtml(s, kind, library) + backlogHtml(s) + reviewHtml(s, kind)
      : `<div class="empty">${icon('chart')}<h2>No stats yet</h2><p>Add a few things and finish them: they'll show up here.</p></div>`;
  }

  filter.addEventListener('click', (e) => {
    const button = closest(e, '[data-filter]');
    if (!button) return;
    kind = button.dataset.filter || null;
    render();
  });

  body.addEventListener('click', (e) => {
    const yearButton = closest(e, '[data-year]');
    if (yearButton) {
      year = Number(yearButton.dataset.year);
      return render();
    }
    const item = closest(e, '[data-item]');               // the backlog, a favourite or a record
    if (item) onOpenItem(item.dataset.item);
  });

  // like a category: the bar gets a background once the page scrolls under it
  new IntersectionObserver(([entry]) => $('statsHead').classList.toggle('stuck', !entry.isIntersecting))
    .observe($('statsSentinel'));

  return {
    show() {
      shown = true;
      kind = null;                                  // always opens on the whole library, this year
      year = new Date().getFullYear();
      render();
    },
    hide() {
      shown = false;
    },
    /**
     * @param {import('../shared/library.js').Item[]} items  @param {number} statsSince  when the stats started counting
     * @param {string[]} hidden  categories left out (their items too)
     * @param {boolean} setup  setting up for the first time: no stats yet
     */
    update(items, statsSince = 0, hidden = [], setup = false) {
      library = items.filter((item) => !hidden.includes(item.category));
      since = statsSince;
      settingUp = setup;
      const kinds = STAT_KINDS.filter((k) => !hidden.includes(k.category));
      if (kinds.length !== shownKinds.length) {
        shownKinds = kinds;
        renderTabs();
        if (kind && !kinds.some((k) => k.id === kind)) kind = null;   // its tab is gone: the whole library
      }
      render();
    },
  };
}
