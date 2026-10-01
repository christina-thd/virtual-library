import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createInitialState, normalizeState, parseImageUrls, parseMinutes, parseYear, SCHEMA_VERSION, toView } from '../src/library/state.js';

const NOW = 1_700_000_000_000;

const item = (overrides = {}) => ({
  id: 'abc123', category: 'movie', title: 'Dune', year: 2021, creator: 'Denis Villeneuve',
  source: { provider: 'cinemeta', id: 'tt1160419' }, imageUrls: ['https://images.metahub.space/poster/medium/tt1160419/img'],
  cover: null, status: 'done', rating: 5, dropped: false, runtime: 155, seasons: null, episodes: null, pages: null, detailsAt: NOW, addedAt: NOW - 1000, finishedAt: NOW, ...overrides,
});

describe('normalizeState', () => {
  test('nothing saved yet gives an empty library', () => {
    for (const raw of [null, undefined, 'nope', {}, { items: 'x' }]) {
      assert.deepEqual(normalizeState(raw, NOW), createInitialState());
    }
  });

  test('keeps a valid item as it is', () => {
    const state = normalizeState({ schema: SCHEMA_VERSION, items: [item()] }, NOW);
    assert.deepEqual(state.items, [item()]);
  });

  test('drops items without a title or with an unknown category', () => {
    const state = normalizeState({ items: [item({ title: ' ' }), item({ category: 'podcast' }), null, 'x'] }, NOW);
    assert.equal(state.items.length, 0);
  });

  test('repairs bad fields instead of losing the item', () => {
    const [fixed] = normalizeState({
      items: [item({ id: '../../etc', status: 'watching', rating: 9, year: 'soon', cover: '../secret.jpg', imageUrls: ['http://insecure.example/a.jpg'] })],
    }, NOW).items;
    assert.match(fixed.id, /^[a-f0-9]+$/);
    assert.equal(fixed.status, 'pending');
    assert.equal(fixed.rating, null);
    assert.equal(fixed.finishedAt, null);
    assert.equal(fixed.year, null);
    assert.equal(fixed.cover, null);
    assert.deepEqual(fixed.imageUrls, []);
  });

  test('waiting is kept for series only; anything else waiting becomes pending', () => {
    const [series, movie] = normalizeState({ items: [
      item({ id: 'a1', category: 'series', status: 'waiting', rating: 4 }),
      item({ id: 'b2', status: 'waiting' }),
    ] }, NOW).items;
    assert.deepEqual([series.status, series.rating, series.finishedAt], ['waiting', null, null]);
    assert.equal(movie.status, 'pending');
  });

  test('only a done item can be dropped', () => {
    const [done, pending, odd] = normalizeState({ items: [
      item({ id: 'a1', dropped: true }), item({ id: 'b2', status: 'pending', dropped: true }), item({ id: 'c3', dropped: 'yes' }),
    ] }, NOW).items;
    assert.deepEqual([done.dropped, pending.dropped, odd.dropped], [true, false, false]);
  });

  test('a rating only survives on finished items', () => {
    const [pending] = normalizeState({ items: [item({ status: 'pending', rating: 4 })] }, NOW).items;
    assert.equal(pending.rating, null);
  });

  test('duplicate ids keep one item', () => {
    assert.equal(normalizeState({ items: [item(), item({ title: 'Dune again' })] }, NOW).items.length, 1);
  });
});

describe('helpers', () => {
  test('parseMinutes reads durations from numbers and catalog text', () => {
    assert.deepEqual(['155 min', '2h 35min', '1h', 90, ' 45 ', 'soon', 0, -5, 3000, 1.5, null].map(parseMinutes),
      [155, 155, 60, 90, 45, null, null, null, null, null, null]);
  });

  test('only movies keep a duration, only series seasons and episodes', () => {
    const [movie, series] = normalizeState({ items: [
      item({ id: 'a1', runtime: '2h', seasons: 3 }),
      item({ id: 'b2', category: 'series', runtime: 50, seasons: 3, episodes: 26.5, detailsAt: 'x' }),
    ] }, NOW).items;
    assert.deepEqual([movie.runtime, movie.seasons], [120, null]);
    assert.deepEqual([series.runtime, series.seasons, series.episodes, series.detailsAt], [null, 3, null, null]);
  });

  test('parseYear reads years from numbers and dates', () => {
    assert.equal(parseYear(2021), 2021);
    assert.equal(parseYear('2021-10-22'), 2021);
    assert.equal(parseYear('2017-2020'), 2017);
    for (const bad of [null, '', 'soon', 21, '0999']) assert.equal(parseYear(bad), null, String(bad));
  });

  test('parseImageUrls keeps distinct https URLs that pass the check, best first', () => {
    const allowed = (url) => !url.includes('evil');
    assert.deepEqual(
      parseImageUrls(['https://a/1.jpg', null, 'http://a/2.jpg', 'https://evil/3.jpg', 'https://a/1.jpg', 'https://a/4.jpg'], allowed),
      ['https://a/1.jpg', 'https://a/4.jpg'],
    );
  });
});

describe('toView', () => {
  test('shows the saved cover when there is one, else the catalog image', () => {
    const state = { schema: 1, items: [item({ cover: 'abc123.jpg' }), item({ id: 'def456' }), item({ id: 'aaa', imageUrls: [] })] };
    const view = toView(state, '1.2.3');
    assert.equal(view.version, '1.2.3');
    assert.deepEqual(view.items.map((i) => i.image), ['covers/abc123.jpg', item().imageUrls[0], null]);
    assert.ok(!('imageUrls' in view.items[0]) && !('cover' in view.items[0]));
  });
});
