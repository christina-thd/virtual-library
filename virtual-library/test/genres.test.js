// Making the catalogs' genres comparable.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanGenres } from '../src/catalog/genres.js';

test('the same genre gets the same name, whichever catalog it came from', () => {
  assert.deepEqual(cleanGenres('series', ['Drama', 'Science-Fiction', 'Supernatural']), ['Drama', 'Sci-Fi', 'Supernatural']);
  assert.deepEqual(cleanGenres('movie', ['Science Fiction', 'action']), ['Sci-Fi', 'Action']);
  assert.deepEqual(cleanGenres('game', [{ name: 'Role-playing' }, { description: 'RPG' }, { name: 'Indie' }]), ['RPG', 'Indie']);
});

test('some names are two genres; at most three are kept', () => {
  assert.deepEqual(cleanGenres('series', ['Sci-Fi & Fantasy', 'Action & Adventure']), ['Sci-Fi', 'Fantasy', 'Action']);
});

test('books: genres picked out of subjects, the earlier ones first; subjects that are not genres are left out', () => {
  assert.deepEqual(cleanGenres('book', ['hobbits', 'Fantasy fiction', 'Juvenile fiction', 'dragons', 'Classics', 'Fantasy']),
    ['Fantasy', "Children's", 'Classics']);
  assert.deepEqual(cleanGenres('book', ['Fiction & Literature', 'Books', 'General']), []);
});

test('nothing usable is an empty list', () => {
  for (const value of [null, undefined, 'Drama', [], [null, 3, '  ']]) assert.deepEqual(cleanGenres('movie', value), []);
});
