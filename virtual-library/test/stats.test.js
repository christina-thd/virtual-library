// The Stats page's numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryStats } from '../public/js/shared/stats.js';

const NOW = new Date(2026, 9, 15).getTime();                   // 15 October 2026
const on = (year, month, day = 10) => new Date(year, month, day).getTime();
let n = 0;
const item = (overrides) => ({
  id: String(++n), category: 'movie', title: `Item ${n}`, status: 'done', dropped: false, rating: null, genres: [],
  addedAt: on(2025, 0), finishedAt: on(2026, 9), runtime: null, episodes: null, pages: null, hoursPlayed: null, ...overrides,
});

const library = [
  item({ category: 'movie', finishedAt: on(2026, 9), rating: 5, runtime: 155, genres: ['Sci-Fi', 'Drama'] }),
  item({ category: 'movie', finishedAt: on(2026, 9), rating: 4, runtime: 120, genres: ['Drama'] }),
  item({ category: 'movie', finishedAt: on(2026, 2), rating: 3, runtime: 90, genres: ['Comedy'] }),
  item({ category: 'movie', finishedAt: on(2024, 5), rating: 5, runtime: 100 }),              // more than a year ago
  item({ category: 'movie', dropped: true, finishedAt: on(2026, 9), rating: 1, runtime: 95 }), // dropped
  item({ category: 'series', finishedAt: on(2026, 2), episodes: 26, runtime: 50, genres: ['Drama'] }),
  item({ category: 'series', status: 'waiting', finishedAt: null, episodes: 19 }),
  item({ category: 'book', finishedAt: on(2025, 11), pages: 310, rating: 5 }),
  item({ category: 'book', status: 'pending', finishedAt: null, addedAt: on(2024, 2), title: 'Oldest' }),
  item({ category: 'game', finishedAt: on(2026, 8), hoursPlayed: 42.5 }),
  item({ category: 'game', dropped: true, finishedAt: on(2026, 8), hoursPlayed: 3 }),          // played, then dropped
  item({ category: 'game', status: 'pending', finishedAt: null, addedAt: on(2025, 5) }),
];

test('counts: finished (not dropped), this year, dropped, pending, waiting', () => {
  const stats = libraryStats(library, { now: NOW });
  assert.deepEqual([stats.total, stats.finished, stats.finishedThisYear, stats.dropped, stats.pending, stats.waiting], [12, 7, 5, 2, 2, 1]);
});

test('finished per month: the last 12 months, by category; older and dropped ones left out', () => {
  const { months, busiest } = libraryStats(library, { now: NOW });
  assert.equal(months.length, 12);
  assert.deepEqual([months[0].year, months[0].month, months[11].year, months[11].month], [2025, 10, 2026, 9]);
  assert.deepEqual(months.map((m) => m.total), [0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 1, 2]);   // Nov 2025 … Oct 2026
  assert.deepEqual(months[4].byCategory, { movie: 1, series: 1 });                     // March
  assert.deepEqual([busiest.year, busiest.month, busiest.total], [2026, 2, 2]);   // the first of the busiest
});

test('only what was finished since the stats started is dated: per month and this year; totals are all time', () => {
  const since = on(2026, 8, 1);                                  // 1 September 2026
  const stats = libraryStats(library, { now: NOW, since });
  assert.deepEqual(stats.months.map((m) => [m.month, m.total]), [[8, 1], [9, 2]]);   // from September: just two bars
  assert.deepEqual([stats.finishedThisYear, stats.finished, stats.time.movieMinutes], [3, 7, 465]);
  assert.equal(libraryStats(library, { now: NOW, since: NOW }).months.length, 1);       // started today: this month
});

test('seen before (added while setting up): in the totals, but in no month, year or streak', () => {
  const seen = library.map((i) => (i.category === 'movie' ? { ...i, beforeStats: true } : i));
  const stats = libraryStats(seen, { now: NOW });
  assert.deepEqual([stats.finished, stats.finishedThisYear, stats.time.movieMinutes], [7, 2, 465]);
  assert.equal(stats.months[11].total, 0);                                                   // October: two movies, before
});

test('moving an item back to pending (no finish date any more) takes it out of its month', () => {
  const undone = library.map((i) => (i.id === library[0].id ? { ...i, status: 'pending', finishedAt: null } : i));
  assert.equal(libraryStats(undone, { now: NOW }).months[11].total, 1);
});

test('time spent: finished movies, episodes and pages; hours played on every done game, dropped too', () => {
  assert.deepEqual(libraryStats(library, { now: NOW }).time, { movieMinutes: 465, episodes: 26, pages: 310, volumes: 0, comics: 0, hours: 45.5 });
});

test('genres: one category has its top five; the whole library each category\'s top three', () => {
  assert.deepEqual(libraryStats(library, { kind: 'movie', now: NOW }).genres,
    [{ name: 'Drama', count: 2 }, { name: 'Comedy', count: 1 }, { name: 'Sci-Fi', count: 1 }]);
  const all = libraryStats(library, { now: NOW });
  assert.deepEqual(all.genresByKind.series, [{ name: 'Drama', count: 1 }]);
  assert.deepEqual(all.genresByKind.game, []);
});

test('ratings of finished items, and the oldest thing still pending', () => {
  const movies = libraryStats(library, { kind: 'movie', now: NOW });
  assert.deepEqual(movies.ratings, { rated: 4, average: 4.3, stars: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 } });   // the dropped 1★ isn't in
  assert.equal(libraryStats(library, { now: NOW }).oldestPending.title, 'Oldest');
  assert.equal(movies.oldestPending, null);
  // the whole library: each category's oldest pending one (movies have none pending here)
  assert.deepEqual(libraryStats(library, { now: NOW }).oldestPendingByCategory.map((i) => i.category), ['book', 'game']);
  assert.equal(movies.oldestPendingByCategory, null);
});

test('streak: months in a row with something finished; this month still empty doesn\'t break it', () => {
  // finished in Jun 2024, Dec 2025, Mar 2026, Sep and Oct 2026 (dropped ones don't count)
  assert.deepEqual(libraryStats(library, { now: NOW }).streak, { current: 2, best: 2 });
  const inNovember = new Date(2026, 10, 3).getTime();                                   // nothing yet in November
  assert.equal(libraryStats(library, { now: inNovember }).streak.current, 2);
  const inDecember = new Date(2026, 11, 3).getTime();                                   // November ended empty
  assert.equal(libraryStats(library, { now: inDecember }).streak.current, 0);
});

test('year in review: what was finished that year, its genres, busiest month and time', () => {
  const stats = libraryStats(library, { now: NOW });
  assert.deepEqual(stats.years, [2026, 2025, 2024]);
  const r = stats.review;
  assert.deepEqual([r.year, r.finished, r.byCategory], [2026, 5, { movie: 3, series: 1, game: 1 }]);
  assert.deepEqual(r.genres.map((g) => g.name), ['Drama', 'Comedy', 'Sci-Fi']);
  assert.equal(r.busiestMonth, 2);                                                      // March (tied with October: the first)
  assert.deepEqual(r.time, { movieMinutes: 365, episodes: 26, pages: 0, volumes: 0, comics: 0, hours: 42.5 });
  assert.equal(libraryStats(library, { now: NOW, year: 2025 }).review.finished, 1);
});

test('records: the biggest of each kind; one kind has its top three; playtime counts dropped games', () => {
  const all = libraryStats(library, { now: NOW }).records.map((r) => [r.item.category, r.value]);
  assert.deepEqual(all, [['movie', 155], ['series', 26 * 50], ['book', 310], ['game', 42.5]]);   // a series: minutes to watch
  const movies = libraryStats(library, { kind: 'movie', now: NOW }).records.map((r) => r.value);
  assert.deepEqual(movies, [155, 120, 100]);                                            // the dropped 95-minute one isn't a record
  // the longest series to watch, not the one with the most episodes
  const shows = [item({ category: 'series', episodes: 100, runtime: 22 }), item({ category: 'series', episodes: 62, runtime: 55 }), item({ category: 'series', episodes: 300 })];
  assert.deepEqual(libraryStats(shows, { kind: 'series', now: NOW }).records.map((r) => r.item.episodes), [62, 100]);   // no length: not a record
});

test('episodes count when seen: each catch-up on a waiting series, and the rest when finished', () => {
  const shows = [
    item({ category: 'series', status: 'waiting', finishedAt: null, episodes: 30, caughtUp: [{ at: on(2026, 7), episodes: 20 }, { at: on(2026, 9), episodes: 30 }] }),
    item({ category: 'series', finishedAt: on(2026, 8), episodes: 12, caughtUp: [{ at: on(2025, 3), episodes: 8 }] }),
    item({ category: 'series', status: 'waiting', finishedAt: null, episodes: 9, caughtUp: [{ at: null, episodes: 9 }] }),   // when isn't known
    item({ category: 'series', status: 'pending', finishedAt: null, episodes: 40, caughtUp: [] }),
  ];
  const stats = libraryStats(shows, { now: NOW });
  assert.equal(stats.time.episodes, 20 + 10 + 12 + 9);
  assert.equal(stats.review.time.episodes, 20 + 4 + 10);                                        // Aug, Sep, Oct 2026
  assert.equal(libraryStats(shows, { now: NOW, year: 2025 }).review.time.episodes, 8);
});

test('manga and comics are told apart: manga volumes, comics read, each with its own genres, creators and records', () => {
  const manga = { provider: 'kitsu', id: '1' };
  const shelf = [
    ...library,
    item({ category: 'comic', source: manga, volumes: 72, finishedAt: on(2026, 9), genres: ['Action'], creator: 'Kishimoto' }),
    item({ category: 'comic', source: { provider: 'mangadex', id: '2' }, volumes: 30, finishedAt: on(2026, 9), creator: 'Kishimoto' }),
    item({ category: 'comic', source: { provider: 'openlibrary', id: '3' }, volumes: 1, finishedAt: on(2026, 8), genres: ['Superheroes'], publisher: 'DC' }),
    item({ category: 'comic', volumes: 1, finishedAt: on(2026, 8) }),                                 // typed in: a comic
    item({ category: 'comic', status: 'pending', finishedAt: null, addedAt: on(2025, 2) }),
  ];
  const stats = libraryStats(shelf, { now: NOW });
  assert.deepEqual([stats.time.volumes, stats.time.comics], [102, 2]);
  assert.deepEqual(stats.records.filter((r) => r.item.category === 'comic').map((r) => [r.kind, r.value]), [['manga', 72]]);   // comics: no length
  assert.deepEqual([stats.genresByKind.manga, stats.genresByKind.comic], [[{ name: 'Action', count: 1 }], [{ name: 'Superheroes', count: 1 }]]);
  assert.equal(stats.creatorsByKind.manga, undefined);                                   // no creators for manga
  assert.deepEqual(stats.oldestPendingByCategory.map((i) => i.category), ['book', 'comic', 'game']);
  // a tab each: manga only, then comics only (typed in ones too)
  const mangaTab = libraryStats(shelf, { kind: 'manga', now: NOW });
  assert.deepEqual([mangaTab.total, mangaTab.records.map((r) => r.value), mangaTab.creators, mangaTab.publishers], [2, [72, 30], null, null]);
  const comicsTab = libraryStats(shelf, { kind: 'comic', now: NOW });
  assert.deepEqual([comicsTab.total, comicsTab.time.comics, comicsTab.records, comicsTab.genres, comicsTab.creators], [3, 2, [], [{ name: 'Superheroes', count: 1 }], null]);
  assert.deepEqual(comicsTab.publishers, [{ name: 'DC', count: 1 }, { name: 'Other', count: 1 }]);   // another one: Other, last
});

test('release decades and top creators, of what was finished', () => {
  const shelf = [
    item({ year: 1982, creator: 'Ridley Scott' }), item({ year: 1979, creator: 'Ridley Scott' }), item({ year: 2017, creator: 'Denis Villeneuve' }),
    item({ year: 2021, creator: 'Denis Villeneuve' }), item({ year: 2024, creator: 'Denis Villeneuve' }), item({ year: 2010, creator: 'Christopher Nolan' }),
    item({ category: 'book', year: 1937, creator: 'J.R.R. Tolkien' }), item({ year: null, dropped: true, creator: 'Ridley Scott' }),
  ];
  const stats = libraryStats(shelf, { now: NOW });
  assert.deepEqual(stats.decades.map((d) => [d.decade, d.total]), [[1930, 1], [1970, 1], [1980, 1], [2010, 2], [2020, 2]]);
  assert.deepEqual(stats.decades[0].byCategory, { book: 1 });
  // a name seen once says nothing, so it's left out; games have no creators
  assert.deepEqual(stats.creatorsByKind.movie, [{ name: 'Denis Villeneuve', count: 3 }, { name: 'Ridley Scott', count: 2 }]);
  assert.deepEqual(stats.creatorsByKind.book, []);
  assert.equal(libraryStats(shelf, { kind: 'game', now: NOW }).creators, null);
});
