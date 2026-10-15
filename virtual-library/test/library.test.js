// Library rules shared by the server and the screens.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { platformOf } from '../public/js/shared/library.js';

test("a game's platform: PC for Steam and GOG, the store's for Nintendo and RAWG (the first); none typed by hand", () => {
  const game = (provider, creator = null) => ({ category: 'game', source: provider ? { provider, id: '1' } : null, creator });
  assert.equal(platformOf(game('steam')), 'PC');
  assert.equal(platformOf(game('gog', 'CD PROJEKT RED')), 'PC');                // GOG's creator is the developer
  assert.equal(platformOf(game('nintendo', 'Nintendo Switch, Nintendo Switch 2')), 'Nintendo Switch');
  assert.equal(platformOf(game('rawg', 'PlayStation 5, PC')), 'PlayStation 5');
  assert.equal(platformOf(game(null, 'Whatever')), null);
  assert.equal(platformOf({ category: 'movie', source: { provider: 'steam', id: '1' }, creator: null }), null);
});
