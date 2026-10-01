// Looking up details in the background: movie durations, series seasons and episodes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDetailsSync } from '../src/catalog/details.js';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const movie = (id, overrides = {}) => ({
  id, category: 'movie', title: id, status: 'pending', source: { provider: 'cinemeta', id: `tt${id}` }, runtime: null, detailsAt: null, ...overrides,
});
const series = (id, overrides = {}) => ({ ...movie(id), category: 'series', seasons: null, episodes: null, ...overrides });
const quiet = { warn() {} };
const syncWith = (state, catalog, changes = { count: 0 }) =>
  createDetailsSync({ state, catalog, onChange: () => changes.count++, now: () => NOW, logger: quiet });

test('fills in items not looked up yet, one at a time, and tells screens', async () => {
  const state = { items: [movie('a'), movie('b', { runtime: 90, detailsAt: NOW - DAY }), movie('c', { source: null }),
    { ...movie('d'), category: 'game' }, series('e')] };
  const asked = [];
  const catalog = {
    async detailsOf(category, source) {
      asked.push(source.id);
      return category === 'movie' ? { runtime: 120 } : { seasons: 3, episodes: 26 };
    },
  };
  const changes = { count: 0 };
  await syncWith(state, catalog, changes).sync();
  assert.deepEqual(asked, ['tta', 'tte']);          // not: already looked up, typed by hand, a game
  assert.deepEqual([state.items[0].runtime, state.items[0].detailsAt], [120, NOW]);
  assert.deepEqual([state.items[4].seasons, state.items[4].episodes], [3, 26]);
  assert.equal(changes.count, 2);
});

test('a series you are still watching (or waiting for) is looked up again after a week; a finished one is not', async () => {
  const old = NOW - 8 * DAY;
  const state = { items: [
    series('a', { seasons: 2, episodes: 18, detailsAt: old }),
    series('b', { status: 'waiting', seasons: 2, episodes: 18, detailsAt: old }),
    series('c', { status: 'done', seasons: 2, episodes: 18, detailsAt: old }),
    series('d', { seasons: 2, episodes: 18, detailsAt: NOW - DAY }),
    movie('e', { runtime: 100, detailsAt: old }),
  ] };
  const asked = [];
  await syncWith(state, { async detailsOf(c, source) { asked.push(source.id); return { seasons: 3, episodes: 27 }; } }).sync();
  assert.deepEqual(asked, ['tta', 'ttb']);
  assert.deepEqual([state.items[1].seasons, state.items[1].episodes], [3, 27]);
});

test('looked up but unknown: not asked again; a catalog that fails: tried again when the add-on restarts', async () => {
  const state = { items: [movie('a'), movie('b')] };
  let calls = 0;
  const catalog = { async detailsOf(c, source) { calls++; if (source.id === 'ttb') throw new Error('down'); return null; } };
  const sync = syncWith(state, catalog);
  await sync.sync();
  await sync.sync();
  assert.equal(calls, 2);
  assert.deepEqual(state.items.map((i) => [i.runtime, i.detailsAt]), [[null, NOW], [null, null]]);
});

test('an item removed while it was being looked up stays removed', async () => {
  const state = { items: [movie('a')] };
  const removed = state.items[0];
  const changes = { count: 0 };
  await syncWith(state, { async detailsOf() { state.items = []; return { runtime: 100 }; } }, changes).sync();
  assert.equal(changes.count, 0);
  assert.equal(removed.runtime, null);
});
