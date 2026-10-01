// Looking up movie durations in the background.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRuntimeSync } from '../src/catalog/runtimes.js';

const movie = (id, overrides = {}) => ({ id, category: 'movie', title: id, source: { provider: 'cinemeta', id: `tt${id}` }, runtime: null, ...overrides });
const quiet = { warn() {} };

test('fills in movies without a duration, one at a time, and tells screens', async () => {
  const state = { items: [movie('a'), movie('b', { runtime: 90 }), movie('c', { source: null }), { ...movie('d'), category: 'series' }, movie('e')] };
  const asked = [];
  const catalog = { async runtimeOf(category, source) { asked.push(source.id); return source.id === 'tte' ? null : 120; } };
  let changes = 0;
  await createRuntimeSync({ state, catalog, onChange: () => changes++, logger: quiet }).sync();
  assert.deepEqual(asked, ['tta', 'tte']);          // not: already known, typed by hand, a series
  assert.deepEqual(state.items.map((i) => i.runtime), [120, 90, null, null, null]);
  assert.equal(changes, 1);
});

test('a catalog that fails is not asked again for that movie until the add-on restarts', async () => {
  const state = { items: [movie('a')] };
  let calls = 0;
  const sync = createRuntimeSync({ state, catalog: { async runtimeOf() { calls++; throw new Error('down'); } }, onChange() {}, logger: quiet });
  await sync.sync();
  await sync.sync();
  assert.equal(calls, 1);
  assert.equal(state.items[0].runtime, null);
});

test('a movie removed while it was being looked up stays removed', async () => {
  const state = { items: [movie('a')] };
  const removed = state.items[0];
  const catalog = { async runtimeOf() { state.items = []; return 100; } };
  let changes = 0;
  await createRuntimeSync({ state, catalog, onChange: () => changes++, logger: quiet }).sync();
  assert.equal(changes, 0);
  assert.equal(removed.runtime, null);
});
