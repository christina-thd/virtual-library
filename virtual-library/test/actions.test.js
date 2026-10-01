import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { ActionError, ACTION_TYPES, applyAction } from '../src/library/actions.js';
import { createInitialState } from '../src/library/state.js';

const NOW = 1_700_000_000_000;
const ctx = { now: NOW, allowImage: (url) => url.startsWith('https://images.example/') };

let state;
beforeEach(() => {
  state = createInitialState();
});

const apply = (action, context = ctx) => applyAction(state, action, context);
const add = (overrides = {}) => apply({
  type: 'addItem', category: 'series', title: 'Dark', year: 2017, creator: 'Netflix',
  source: { provider: 'tvmaze', id: '17861' },
  coverUrl: 'https://images.example/dark-large.jpg', thumbUrl: 'https://images.example/dark-small.jpg',
  ...overrides,
}).itemId;
const itemOf = (id) => state.items.find((i) => i.id === id);

function rejects(action, status, message) {
  assert.throws(() => apply(action), (err) => {
    assert.ok(err instanceof ActionError, err.message);
    assert.equal(err.status, status);
    if (message) assert.match(err.message, message);
    return true;
  });
}

describe('addItem', () => {
  test('adds a pending item with its details and images', () => {
    const item = itemOf(add());
    assert.equal(item.status, 'pending');
    assert.equal(item.title, 'Dark');
    assert.equal(item.year, 2017);
    assert.equal(item.addedAt, NOW);
    assert.equal(item.finishedAt, null);
    assert.equal(item.rating, null);
    assert.equal(item.cover, null);
    assert.deepEqual(item.imageUrls, ['https://images.example/dark-large.jpg', 'https://images.example/dark-small.jpg']);
  });

  test('can add straight to done, with an optional rating', () => {
    const rated = itemOf(add({ status: 'done', rating: 4 }));
    assert.deepEqual([rated.status, rated.rating, rated.finishedAt], ['done', 4, NOW]);
    const unrated = itemOf(add({ status: 'done', source: null }));
    assert.equal(unrated.rating, null);
  });

  test('a rating sent with a pending item is ignored', () => {
    assert.equal(itemOf(add({ rating: 5 })).rating, null);
  });

  test('can be added by hand, without a catalog source or image', () => {
    const item = itemOf(add({ source: undefined, coverUrl: undefined, thumbUrl: undefined, title: '  My indie game  ', category: 'game' }));
    assert.equal(item.title, 'My indie game');
    assert.equal(item.source, null);
    assert.deepEqual(item.imageUrls, []);
  });

  test('keeps only images from the catalogs', () => {
    const item = itemOf(add({ coverUrl: 'https://tracker.example/pixel.gif', thumbUrl: 'https://images.example/ok.jpg' }));
    assert.deepEqual(item.imageUrls, ['https://images.example/ok.jpg']);
  });

  test('the same catalog entry is not added twice', () => {
    add();
    rejects({ type: 'addItem', category: 'series', title: 'Dark', source: { provider: 'tvmaze', id: '17861' } }, 409, /already in your library/);
    assert.equal(state.items.length, 1);
  });

  test('rejects bad input', () => {
    rejects({ type: 'addItem', category: 'podcast', title: 'x' }, 400, /category/);
    rejects({ type: 'addItem', category: 'book', title: '   ' }, 400, /title/);
    rejects({ type: 'addItem', category: 'book', title: 'x', status: 'watching' }, 400, /status/);
    rejects({ type: 'addItem', category: 'book', title: 'x', status: 'done', rating: 6 }, 400, /rating/);
    assert.equal(state.items.length, 0);
  });
});

describe('setStatus', () => {
  test('done records when it was finished; back to pending clears it and the rating', () => {
    const id = add();
    apply({ type: 'setStatus', itemId: id, status: 'done' }, { ...ctx, now: NOW + 5 });
    apply({ type: 'rateItem', itemId: id, rating: 3 });
    assert.deepEqual([itemOf(id).status, itemOf(id).finishedAt, itemOf(id).rating], ['done', NOW + 5, 3]);

    apply({ type: 'setStatus', itemId: id, status: 'pending' });
    assert.deepEqual([itemOf(id).status, itemOf(id).finishedAt, itemOf(id).rating], ['pending', null, null]);
  });

  test('setting the same status changes nothing', () => {
    const id = add({ status: 'done', rating: 5 });
    apply({ type: 'setStatus', itemId: id, status: 'done' }, { ...ctx, now: NOW + 99 });
    assert.deepEqual([itemOf(id).finishedAt, itemOf(id).rating], [NOW, 5]);
  });

  test('rejects unknown items and statuses', () => {
    rejects({ type: 'setStatus', itemId: 'ghost', status: 'done' }, 404);
    rejects({ type: 'setStatus', itemId: add(), status: 'todo' }, 400);
  });

  test('a series can wait for a new season: done → waiting clears the finish date and rating, like pending', () => {
    const id = add({ status: 'done', rating: 4 });
    apply({ type: 'setStatus', itemId: id, status: 'waiting' });
    assert.deepEqual([itemOf(id).status, itemOf(id).finishedAt, itemOf(id).rating], ['waiting', null, null]);
    apply({ type: 'setStatus', itemId: id, status: 'done' }, { ...ctx, now: NOW + 7 });
    assert.deepEqual([itemOf(id).status, itemOf(id).finishedAt], ['done', NOW + 7]);
    assert.equal(itemOf(add({ source: null, title: 'Severance', status: 'waiting' })).status, 'waiting');
  });

  test('only series can wait', () => {
    const movie = add({ category: 'movie', source: null, title: 'Dune' });
    rejects({ type: 'setStatus', itemId: movie, status: 'waiting' }, 400, /pending, done/);
    rejects({ type: 'addItem', category: 'book', title: 'Dune', status: 'waiting' }, 400);
  });
});

describe('runtime', () => {
  test('a movie keeps the duration from its search result; others never get one', () => {
    assert.equal(itemOf(add({ category: 'movie', source: null, title: 'Dune', runtime: 155 })).runtime, 155);
    assert.equal(itemOf(add({ category: 'movie', source: null, title: 'Cats' })).runtime, null);
    assert.equal(itemOf(add({ runtime: 50 })).runtime, null);      // a series
  });
});

describe('setDropped', () => {
  test('dropping a pending item makes it done (and new items are not dropped)', () => {
    const id = add();
    assert.equal(itemOf(id).dropped, false);
    apply({ type: 'setDropped', itemId: id, dropped: true }, { ...ctx, now: NOW + 3 });
    assert.deepEqual([itemOf(id).status, itemOf(id).dropped, itemOf(id).finishedAt], ['done', true, NOW + 3]);
    apply({ type: 'rateItem', itemId: id, rating: 1 });               // it can still get a (bad) rating
    assert.equal(itemOf(id).rating, 1);
  });

  test('dropping a done item keeps its finish date and rating; undropping keeps it done', () => {
    const id = add({ status: 'done', rating: 2 });
    apply({ type: 'setDropped', itemId: id, dropped: true }, { ...ctx, now: NOW + 9 });
    assert.deepEqual([itemOf(id).finishedAt, itemOf(id).rating, itemOf(id).dropped], [NOW, 2, true]);
    apply({ type: 'setDropped', itemId: id, dropped: false });
    assert.deepEqual([itemOf(id).status, itemOf(id).dropped, itemOf(id).rating], ['done', false, 2]);
  });

  test('moving it back to pending (or waiting) clears the mark', () => {
    const id = add();
    apply({ type: 'setDropped', itemId: id, dropped: true });
    apply({ type: 'setStatus', itemId: id, status: 'waiting' });
    assert.deepEqual([itemOf(id).status, itemOf(id).dropped], ['waiting', false]);
  });

  test('rejects unknown items and anything but true or false', () => {
    rejects({ type: 'setDropped', itemId: 'ghost', dropped: true }, 404);
    rejects({ type: 'setDropped', itemId: add(), dropped: 'yes' }, 400);
  });
});

describe('rateItem', () => {
  test('rates 1–5 and clears with null', () => {
    const id = add({ status: 'done' });
    apply({ type: 'rateItem', itemId: id, rating: 1 });
    assert.equal(itemOf(id).rating, 1);
    apply({ type: 'rateItem', itemId: id, rating: null });
    assert.equal(itemOf(id).rating, null);
  });

  test('only finished items can be rated, with whole stars', () => {
    rejects({ type: 'rateItem', itemId: add(), rating: 4 }, 400, /finished/);
    const done = add({ status: 'done', source: null });
    for (const rating of [0, 6, 2.5, '4']) rejects({ type: 'rateItem', itemId: done, rating }, 400, /rating/);
  });
});

describe('removeItem', () => {
  test('removes the item', () => {
    const id = add();
    apply({ type: 'removeItem', itemId: id });
    assert.equal(state.items.length, 0);
    rejects({ type: 'removeItem', itemId: id }, 404);
  });
});

describe('applyAction', () => {
  test('rejects anything that is not a known action', () => {
    for (const action of [null, 'addItem', {}, { type: 'dropTable' }, { type: 'toString' }]) {
      assert.throws(() => applyAction(state, action, ctx), ActionError);
    }
  });

  test('without an image check, no images are kept', () => {
    const { itemId } = applyAction(state, { type: 'addItem', category: 'book', title: 'x', coverUrl: 'https://images.example/a.jpg' });
    assert.deepEqual(itemOf(itemId).imageUrls, []);
  });

  test('lists every action', () => {
    assert.deepEqual([...ACTION_TYPES].sort(), ['addItem', 'rateItem', 'removeItem', 'setDropped', 'setStatus']);
  });
});
