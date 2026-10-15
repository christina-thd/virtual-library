import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { ActionError, applyAction } from '../src/library/actions.js';
import { activityView, MAX_ACTIVITY } from '../src/library/activity.js';
import { createInitialState, normalizeState } from '../src/library/state.js';

const NOW = 1_700_000_000_000;

let state;
beforeEach(() => {
  state = { ...createInitialState(NOW), setupStep: null, setupSince: null };
});

const ctx = { now: NOW, allowImage: (url) => url.startsWith('https://images.example/') };
const apply = (action, now = NOW) => applyAction(state, action, { ...ctx, now });
const add = (overrides = {}) => apply({ type: 'addItem', category: 'movie', title: 'Dune', source: null, ...overrides }).itemId;
const itemOf = (id) => state.items.find((i) => i.id === id);
const view = () => activityView(state);
const undo = (index) => apply({ type: 'undo', entryId: state.activity[index].id });

describe('recent activity', () => {
  test('keeps changes to items, newest first, in a few words; not settings, and not what changed nothing', () => {
    const id = add();
    apply({ type: 'setStatus', itemId: id, status: 'done' }, NOW + 1);
    apply({ type: 'rateItem', itemId: id, rating: 4 }, NOW + 2);
    apply({ type: 'rateItem', itemId: id, rating: 4 }, NOW + 3);             // the same again: nothing changed
    apply({ type: 'setCategoryHidden', category: 'game', hidden: true });
    assert.deepEqual(view().map((e) => [e.title, e.text, e.at]), [['Dune', 'Rated 4★', NOW + 2], ['Dune', 'Moved to Done', NOW + 1], ['Dune', 'Added to Pending', NOW]]);
  });

  test('undo puts the item back as it was; an item\'s changes undo newest first', () => {
    const id = add();
    apply({ type: 'setStatus', itemId: id, status: 'done' });
    apply({ type: 'rateItem', itemId: id, rating: 2 });
    assert.deepEqual(view().map((e) => e.canUndo), [true, false, false]);
    assert.throws(() => undo(1), (/** @type {any} */ err) => err instanceof ActionError && /newer changes to "Dune"/.test(err.message));
    undo(0);
    assert.deepEqual([itemOf(id).status, itemOf(id).rating], ['done', null]);
    assert.deepEqual(view().map((e) => [e.undone, e.canUndo]), [[true, false], [false, true], [false, false]]);
    undo(1);
    assert.deepEqual([itemOf(id).status, itemOf(id).finishedAt], ['pending', null]);
    assert.throws(() => undo(1), /undone already/);
  });

  test('a removed item comes back (its cover is fetched again); undoing an add removes it', () => {
    const id = add({ coverUrl: 'https://images.example/dune.jpg' });
    itemOf(id).cover = `${id}.jpg`;
    apply({ type: 'removeItem', itemId: id });
    assert.equal(itemOf(id), undefined);
    undo(0);
    assert.deepEqual([itemOf(id).title, itemOf(id).cover, itemOf(id).imageUrls], ['Dune', null, ['https://images.example/dune.jpg']]);
    undo(1);
    assert.equal(itemOf(id), undefined);
  });

  test(`keeps the latest ${MAX_ACTIVITY}`, () => {
    const id = add();
    for (let i = 0; i < MAX_ACTIVITY + 5; i++) apply({ type: 'setStatus', itemId: id, status: i % 2 ? 'pending' : 'done' });
    assert.equal(state.activity.length, MAX_ACTIVITY);
  });

  test('is saved with the library; entries that could not be undone safely are dropped', () => {
    const id = add();
    apply({ type: 'setStatus', itemId: id, status: 'done' });
    const saved = JSON.parse(JSON.stringify(state));
    saved.activity.push({ ...saved.activity[0], id: 'bad1', before: { title: 'No category' } }, { ...saved.activity[0], id: 'bad2', type: 'dropTable' });
    const loaded = normalizeState(saved, NOW);
    assert.deepEqual(loaded.activity.map((e) => e.text), ['Moved to Done', 'Added to Pending']);
    assert.deepEqual(normalizeState({ items: [] }, NOW).activity, []);
  });
});
