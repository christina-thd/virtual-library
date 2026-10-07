// Statistics for the Stats page, worked out from the library itself (nothing is stored for them).
// Finished means done and not dropped: dropped items are counted on their own. Moving something back to pending
// clears when it was finished, so an undone item no longer counts in the month it was finished.
// What was finished before `since` (when the stats started: a library filled in on day one marks everything
// finished that day) has no real date, so the per-month and this-year counts leave it out.
// Episodes count when seen: a series moved to Waiting has seen what's out, and finishing it adds the rest.

import { CATEGORIES, isManga } from './library.js';

/**
 * What the stats tell apart, each with its own tab: the categories, with manga and western comics apart (a manga
 * counts volumes, a comic is one book). `category` is the one each belongs to (its color).
 */
export const STAT_KINDS = Object.freeze(CATEGORIES.flatMap((c) => (c.id === 'comic'
  ? [{ id: 'manga', category: 'comic', icon: 'manga', plural: 'Manga' }, { id: 'comic', category: 'comic', icon: 'comic', plural: 'Comics' }]
  : [{ id: c.id, category: c.id, icon: c.id, plural: c.plural }])));

/** The stats kind of an item: its category, or "manga" for a manga. */
export const kindOfItem = (item) => (isManga(item) ? 'manga' : item.category);

const MONTHS = 12;
const TOP_GENRES = 5;

const isFinished = (item) => item.status === 'done' && !item.dropped && item.finishedAt != null;
const sum = (items, valueOf) => items.reduce((total, item) => total + (valueOf(item) ?? 0), 0);
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Up to the last 12 months, oldest first, from the month the stats started: how many items of each category
 * were finished in each.
 */
function finishedPerMonth(finished, now, since) {
  const monthsSince = (now.getFullYear() - since.getFullYear()) * 12 + now.getMonth() - since.getMonth() + 1;
  const count = Math.min(MONTHS, Math.max(1, monthsSince));
  const months = Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: monthKey(date), year: date.getFullYear(), month: date.getMonth(), total: 0, byCategory: {} };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const item of finished) {
    const month = byKey.get(monthKey(new Date(item.finishedAt)));
    if (!month) continue;                                      // older than a year
    month.total += 1;
    month.byCategory[item.category] = (month.byCategory[item.category] ?? 0) + 1;
  }
  return months;
}

/** Most common genres among finished items, most first: [{ name, count }]. */
function topGenres(finished, limit = TOP_GENRES) {
  const counts = new Map();
  for (const item of finished) for (const genre of item.genres ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Hours of movies, episodes, pages, manga volumes, comics and playtime of the given done items. */
function timeSpent(done) {
  const of = (kind) => done.filter((item) => kindOfItem(item) === kind);
  return {
    movieMinutes: sum(of('movie'), (i) => i.runtime),
    episodes: sum(of('series'), (i) => i.episodes),
    pages: sum(of('book'), (i) => i.pages),
    volumes: sum(of('manga'), (i) => i.volumes),
    comics: of('comic').length,                                  // each is one book
    hours: Math.round(sum(of('game'), (i) => i.hoursPlayed) * 10) / 10,
  };
}

/** Series episodes as seen: [{ at, episodes }], what's new at each catch-up and, once finished, the rest. */
function episodesSeen(series) {
  const seen = [];
  for (const item of series) {
    let before = 0;
    for (const c of item.caughtUp ?? []) {
      if (c.episodes > before) seen.push({ at: c.at, episodes: c.episodes - before });
      before = Math.max(before, c.episodes ?? 0);
    }
    if (isFinished(item) && item.episodes > before) seen.push({ at: item.finishedAt, episodes: item.episodes - before });
  }
  return seen;
}

/** Months in a row with something finished: the run still going (it lasts until a month ends empty) and the best. */
function streaks(dated, now, since) {
  const busy = new Set(dated.map((item) => monthKey(new Date(item.finishedAt))));
  let best = 0;
  let run = 0;
  const runs = [];
  for (let date = new Date(since.getFullYear(), since.getMonth(), 1); date <= now; date.setMonth(date.getMonth() + 1)) {
    run = busy.has(monthKey(date)) ? run + 1 : 0;
    best = Math.max(best, run);
    runs.push(run);
  }
  // this month isn't over: an empty one doesn't break the streak yet
  const current = runs.at(-1) || runs.at(-2) || 0;
  return { current, best };
}

/** One year: how much was finished, of what, the favourite, top genres, busiest month and time spent. */
function yearReview(dated, seen, year) {
  const items = dated.filter((item) => new Date(item.finishedAt).getFullYear() === year);
  const episodes = sum(seen.filter((s) => new Date(s.at).getFullYear() === year), (s) => s.episodes);
  const byCategory = {};
  const perMonth = new Array(12).fill(0);
  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    perMonth[new Date(item.finishedAt).getMonth()] += 1;
  }
  const most = Math.max(...perMonth);
  const favourite = items.filter((item) => item.rating)
    .sort((a, b) => b.rating - a.rating || b.finishedAt - a.finishedAt)[0] ?? null;
  return {
    year,
    finished: items.length,
    byCategory,
    favourite,
    genres: topGenres(items, 3),
    busiestMonth: most > 1 ? perMonth.indexOf(most) : null,      // only when one stands out
    time: { ...timeSpent(items), episodes },
  };
}

/** Finished items by the decade they came out, oldest first: [{ decade, total, byCategory }]. */
function decades(finished) {
  const byDecade = new Map();
  for (const item of finished) {
    if (!item.year) continue;
    const decade = Math.floor(item.year / 10) * 10;
    const entry = byDecade.get(decade) ?? { decade, total: 0, byCategory: {} };
    entry.total += 1;
    entry.byCategory[item.category] = (entry.byCategory[item.category] ?? 0) + 1;
    byDecade.set(decade, entry);
  }
  return [...byDecade.values()].sort((a, b) => a.decade - b.decade);
}

/** What makes a record, per kind: the longest movie, biggest book, longest series and manga, most-played game. */
const RECORDS = { movie: (i) => i.runtime, book: (i) => i.pages, series: (i) => i.episodes, manga: (i) => i.volumes, game: (i) => i.hoursPlayed };

/** The biggest of each kind (or one kind's top three): [{ item, kind, value }]. Playtime counts dropped games too. */
function records(done, kind) {
  const best = (k, count) => (RECORDS[k] ? done : [])
    .filter((i) => kindOfItem(i) === k && RECORDS[k](i) && (k === 'game' || !i.dropped))
    .sort((a, b) => RECORDS[k](b) - RECORDS[k](a))
    .slice(0, count)
    .map((item) => ({ item, kind: k, value: RECORDS[k](item) }));
  return kind ? best(kind, 3) : STAT_KINDS.flatMap((k) => best(k.id, 1));
}

/**
 * Whose work you finished most: directors, networks, authors. Not for games (their "creator" is a platform or
 * developer), manga or comics.
 */
const CREATOR_KINDS = ['movie', 'series', 'book'];

function topCreators(finished, limit) {
  const counts = new Map();
  for (const item of finished) if (item.creator) counts.set(item.creator, (counts.get(item.creator) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .filter((c) => c.count > 1)                                 // one each says nothing
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Comics finished per publisher, most first, the ones not among the known publishers last as "Other". */
function publishers(comics) {
  const counts = new Map();
  for (const comic of comics) counts.set(comic.publisher ?? 'Other', (counts.get(comic.publisher ?? 'Other') ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => Number(a.name === 'Other') - Number(b.name === 'Other') || b.count - a.count || a.name.localeCompare(b.name));
}

/** The one added longest ago, or null. */
const oldest = (items) => items.reduce((first, item) => (!first || item.addedAt < first.addedAt ? item : first), null);

/** Average rating (one decimal) and how many got each number of stars, of the rated finished items. */
function ratings(finished) {
  const rated = finished.filter((item) => item.rating);
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of rated) stars[item.rating] += 1;
  const average = rated.length ? Math.round((sum(rated, (i) => i.rating) / rated.length) * 10) / 10 : null;
  return { rated: rated.length, average, stars };
}

/**
 * Everything the Stats page shows, for one kind (a STAT_KINDS id) or (null) the whole library.
 * @param {import('./library.js').Item[]} items  the library
 * @param {{ kind?: string|null, now?: number, since?: number, year?: number }} [options]
 *   since: when the stats started; year: the one to review (this year by default)
 */
export function libraryStats(items, { kind = null, now = Date.now(), since = 0, year = new Date(now).getFullYear() } = {}) {
  const today = new Date(now);
  const mine = kind ? items.filter((item) => kindOfItem(item) === kind) : items;
  const finished = mine.filter(isFinished);
  const dated = finished.filter((item) => item.finishedAt >= since);   // finished since the stats started
  const pending = mine.filter((item) => item.status === 'pending');
  const seen = episodesSeen(mine.filter((item) => item.category === 'series'));
  const seenDated = seen.filter((s) => s.at != null && s.at >= since);
  const months = finishedPerMonth(dated, today, new Date(Math.min(since, now)));
  const busiest = months.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);
  const of = (k) => finished.filter((item) => kindOfItem(item) === k);
  // the whole library: each kind's top three
  const perKind = (top, kinds) => Object.fromEntries(kinds.map((k) => [k, top(of(k), 3)]));
  const done = mine.filter((item) => item.status === 'done');
  const years = [...new Set([today.getFullYear(), ...dated.map((item) => new Date(item.finishedAt).getFullYear())])]
    .sort((a, b) => b - a);

  return {
    total: mine.length,
    finished: finished.length,
    finishedThisYear: dated.filter((item) => new Date(item.finishedAt).getFullYear() === today.getFullYear()).length,
    since,
    dropped: mine.filter((item) => item.status === 'done' && item.dropped).length,
    pending: pending.length,
    waiting: mine.filter((item) => item.status === 'waiting').length,
    months,
    busiest,                                                    // the month with the most finished, or null
    // seen is seen: dropped games' playtime and the episodes of series not finished count too
    time: { ...timeSpent(finished), episodes: sum(seen, (s) => s.episodes), hours: timeSpent(done).hours },
    streak: streaks(dated, today, new Date(Math.min(since, now))),
    years,                                                      // years to review, newest first
    review: yearReview(dated, seenDated, year),
    decades: decades(finished),
    records: records(done, kind),
    creators: kind && CREATOR_KINDS.includes(kind) ? topCreators(finished, 5) : null,   // one kind: its top five
    creatorsByKind: kind ? null : perKind(topCreators, CREATOR_KINDS),
    genres: kind ? topGenres(finished) : null,
    publishers: kind === 'comic' ? publishers(finished) : null,     // Marvel, DC…
    genresByKind: kind ? null : perKind(topGenres, STAT_KINDS.map((k) => k.id)),
    ratings: ratings(finished),
    oldestPending: oldest(pending),
    // the whole library: each category's oldest pending one
    oldestPendingByCategory: kind ? null
      : CATEGORIES.map(({ id: kind }) => oldest(pending.filter((i) => i.category === kind))).filter(Boolean),
  };
}
