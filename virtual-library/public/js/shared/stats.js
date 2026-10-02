// Statistics for the Stats page, worked out from the library itself (nothing is stored for them).
// Finished means done and not dropped: dropped items are counted on their own. Moving something back to pending
// clears when it was finished, so an undone item no longer counts in the month it was finished.
// What was finished before `since` (when the stats started: a library filled in on day one marks everything
// finished that day) has no real date, so the per-month and this-year counts leave it out.

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

/** Hours of movies, episodes, pages and playtime of the given done items. */
function timeSpent(done) {
  const of = (kind) => done.filter((item) => item.category === kind);
  return {
    movieMinutes: sum(of('movie'), (i) => i.runtime),
    episodes: sum(of('series'), (i) => i.episodes),
    pages: sum(of('book'), (i) => i.pages),
    hours: Math.round(sum(of('game'), (i) => i.hoursPlayed) * 10) / 10,
  };
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
function yearReview(dated, year) {
  const items = dated.filter((item) => new Date(item.finishedAt).getFullYear() === year);
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
    time: timeSpent(items),
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

/** What makes a record, per kind: the longest movie, biggest book, longest series, most-played game. */
const RECORDS = { movie: (i) => i.runtime, book: (i) => i.pages, series: (i) => i.episodes, game: (i) => i.hoursPlayed };

/** The biggest of each kind (or one kind's top three): [{ item, value }]. Playtime counts dropped games too. */
function records(done, category) {
  const best = (kind, count) => done.filter((i) => i.category === kind && RECORDS[kind](i) && (kind === 'game' || !i.dropped))
    .sort((a, b) => RECORDS[kind](b) - RECORDS[kind](a))
    .slice(0, count)
    .map((item) => ({ item, value: RECORDS[kind](item) }));
  return category ? best(category, 3) : ['movie', 'series', 'book', 'game'].flatMap((kind) => best(kind, 1));
}

/** Whose work you finished most: directors, networks, authors. Games' "creator" is a platform or developer, so none. */
const CREATOR_KINDS = ['movie', 'series', 'book'];

function topCreators(finished, limit) {
  const counts = new Map();
  for (const item of finished) if (item.creator) counts.set(item.creator, (counts.get(item.creator) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .filter((c) => c.count > 1)                                 // one each says nothing
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
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
 * Everything the Stats page shows, for one category or (null) the whole library.
 * @param {import('./library.js').Item[]} items  the library
 * @param {{ category?: string|null, now?: number, since?: number, year?: number }} [options]
 *   since: when the stats started; year: the one to review (this year by default)
 */
export function libraryStats(items, { category = null, now = Date.now(), since = 0, year = new Date(now).getFullYear() } = {}) {
  const today = new Date(now);
  const mine = category ? items.filter((item) => item.category === category) : items;
  const finished = mine.filter(isFinished);
  const dated = finished.filter((item) => item.finishedAt >= since);   // finished since the stats started
  const pending = mine.filter((item) => item.status === 'pending');
  const months = finishedPerMonth(dated, today, new Date(Math.min(since, now)));
  const busiest = months.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);
  const of = (kind) => finished.filter((item) => item.category === kind);
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
    // time played is time played: dropped games count too
    time: { ...timeSpent(finished), hours: timeSpent(done).hours },
    streak: streaks(dated, today, new Date(Math.min(since, now))),
    years,                                                      // years to review, newest first
    review: yearReview(dated, year),
    decades: decades(finished),
    records: records(done, category),
    creators: category ? (CREATOR_KINDS.includes(category) ? topCreators(finished, 5) : null) : null,
    creatorsByCategory: category ? null
      : Object.fromEntries(CREATOR_KINDS.map((kind) => [kind, topCreators(of(kind), 3)])),
    genres: category ? topGenres(finished) : null,              // one category: its top genres
    genresByCategory: category ? null                           // the whole library: each category's top three
      : Object.fromEntries(['movie', 'series', 'book', 'game'].map((kind) => [kind, topGenres(of(kind), 3)])),
    ratings: ratings(finished),
    oldestPending: oldest(pending),
    // the whole library: each category's oldest pending one
    oldestPendingByCategory: category ? null
      : ['movie', 'series', 'book', 'game'].map((kind) => oldest(pending.filter((i) => i.category === kind))).filter(Boolean),
  };
}
