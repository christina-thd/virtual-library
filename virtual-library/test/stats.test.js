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
  item({ category: 'series', finishedAt: on(2026, 2), episodes: 26, genres: ['Drama'] }),
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

test('moving an item back to pending (no finish date any more) takes it out of its month', () => {
  const undone = library.map((i) => (i.id === library[0].id ? { ...i, status: 'pending', finishedAt: null } : i));
  assert.equal(libraryStats(undone, { now: NOW }).months[11].total, 1);
});

test('time spent: finished movies, episodes and pages; hours played on every done game, dropped too', () => {
  assert.deepEqual(libraryStats(library, { now: NOW }).time, { movieMinutes: 465, episodes: 26, pages: 310, hours: 45.5 });
});

test('genres: one category has its top five; the whole library each category\'s top three', () => {
  assert.deepEqual(libraryStats(library, { category: 'movie', now: NOW }).genres,
    [{ name: 'Drama', count: 2 }, { name: 'Comedy', count: 1 }, { name: 'Sci-Fi', count: 1 }]);
  const all = libraryStats(library, { now: NOW });
  assert.deepEqual(all.genresByCategory.series, [{ name: 'Drama', count: 1 }]);
  assert.deepEqual(all.genresByCategory.game, []);
});

test('ratings of finished items, and the oldest thing still pending', () => {
  const movies = libraryStats(library, { category: 'movie', now: NOW });
  assert.deepEqual(movies.ratings, { rated: 4, average: 4.3, stars: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 } });   // the dropped 1★ isn't in
  assert.equal(libraryStats(library, { now: NOW }).oldestPending.title, 'Oldest');
  assert.equal(movies.oldestPending, null);
});
