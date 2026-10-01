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
 * @param {object[]} items  the library
 * @param {{ category?: string|null, now?: number, since?: number }} [options]  since: when the stats started
 */
export function libraryStats(items, { category = null, now = Date.now(), since = 0 } = {}) {
  const today = new Date(now);
  const mine = category ? items.filter((item) => item.category === category) : items;
  const finished = mine.filter(isFinished);
  const dated = finished.filter((item) => item.finishedAt >= since);   // finished since the stats started
  const pending = mine.filter((item) => item.status === 'pending');
  const months = finishedPerMonth(dated, today, new Date(Math.min(since, now)));
  const busiest = months.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);
  const of = (kind) => finished.filter((item) => item.category === kind);

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
    time: {
      movieMinutes: sum(of('movie'), (i) => i.runtime),
      episodes: sum(of('series'), (i) => i.episodes),
      pages: sum(of('book'), (i) => i.pages),
      // time played is time played: dropped games count too
      hours: Math.round(sum(mine.filter((i) => i.category === 'game' && i.status === 'done'), (i) => i.hoursPlayed) * 10) / 10,
    },
    genres: category ? topGenres(finished) : null,              // one category: its top genres
    genresByCategory: category ? null                           // the whole library: each category's top three
      : Object.fromEntries(['movie', 'series', 'book', 'game'].map((kind) => [kind, topGenres(of(kind), 3)])),
    ratings: ratings(finished),
    oldestPending: pending.reduce((oldest, item) => (!oldest || item.addedAt < oldest.addedAt ? item : oldest), null),
  };
}
