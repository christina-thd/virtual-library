// Search catalogs, with canned answers in the shape each API really sends (no network).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chooseProviders, createCatalog, SearchError } from '../src/catalog/index.js';

/** An http client that answers from `routes` (URL prefix → body) and records what was asked. */
function fakeHttp(routes) {
  const calls = [];
  return {
    calls,
    async json(url, options = {}) {
      calls.push({ url, headers: options.headers ?? {} });
      const prefix = Object.keys(routes).find((p) => url.startsWith(p));
      if (!prefix) throw new Error(`unexpected request ${url}`);
      return routes[prefix];
    },
  };
}

const search = (providers, routes, category, query) => {
  const http = fakeHttp(routes);
  return createCatalog({ http, providers }).search(category, query).then((results) => ({ results, calls: http.calls }));
};

describe('keyless catalogs', () => {
  const providers = chooseProviders();

  test('movies: Cinemeta, with bigger posters', async () => {
    const { results, calls } = await search(providers, {
      'https://v3-cinemeta.strem.io/catalog/movie/top/search=': {
        metas: [
          { imdb_id: 'tt1160419', name: 'Dune: Part One', releaseInfo: '2021', director: ['Denis Villeneuve'], poster: 'https://images.metahub.space/poster/small/tt1160419/img' },
          { id: 'tt0087182', name: 'Dune', releaseInfo: '1984', poster: 'https://m.media-amazon.com/images/M/MV5BMGJl._V1_SX250.jpg' },
        ],
      },
    }, 'movie', 'dune & co');
    assert.match(calls[0].url, /search=dune%20%26%20co\.json$/);
    assert.deepEqual(results[0], {
      category: 'movie', title: 'Dune: Part One', year: 2021, creator: 'Denis Villeneuve',
      source: { provider: 'cinemeta', id: 'tt1160419' },
      coverUrl: 'https://images.metahub.space/poster/medium/tt1160419/img',
      thumbUrl: 'https://images.metahub.space/poster/small/tt1160419/img',
    });
    assert.equal(results[1].coverUrl, 'https://m.media-amazon.com/images/M/MV5BMGJl._V1_SX600.jpg');
    assert.equal(results[1].creator, null);
  });

  test('series: TVmaze, cover from the IMDb poster when there is one', async () => {
    const { results } = await search(providers, {
      'https://api.tvmaze.com/search/shows': [
        { show: { id: 17861, name: 'Dark', premiered: '2017-12-01', network: null, webChannel: { name: 'Netflix' },
          externals: { imdb: 'tt5753856' }, image: { medium: 'https://static.tvmaze.com/m/1.jpg', original: 'https://static.tvmaze.com/o/1.jpg' } } },
        { show: { id: 2, name: 'Obscure', premiered: null, network: { name: 'BBC One' }, externals: { imdb: null }, image: { medium: 'https://static.tvmaze.com/m/2.jpg' } } },
        { show: { id: 3, name: 'No image', externals: {}, image: null } },
      ],
    }, 'series', 'dark');
    assert.deepEqual(results.map((r) => [r.title, r.year, r.creator, r.coverUrl, r.thumbUrl]), [
      ['Dark', 2017, 'Netflix', 'https://images.metahub.space/poster/medium/tt5753856/img', 'https://static.tvmaze.com/m/1.jpg'],
      ['Obscure', null, 'BBC One', 'https://static.tvmaze.com/m/2.jpg', 'https://static.tvmaze.com/m/2.jpg'],
      ['No image', null, null, null, null],
    ]);
    assert.deepEqual(results[0].source, { provider: 'tvmaze', id: '17861' });
  });

  test('books: Open Library, cover by id', async () => {
    const { results } = await search(providers, {
      'https://openlibrary.org/search.json': {
        docs: [
          { key: '/works/OL27482W', title: 'The Hobbit', author_name: ['J.R.R. Tolkien'], first_publish_year: 1937, cover_i: 14627509 },
          { key: '/works/OL1W', title: 'No cover' },
        ],
      },
    }, 'book', 'hobbit');
    assert.deepEqual(results[0], {
      category: 'book', title: 'The Hobbit', year: 1937, creator: 'J.R.R. Tolkien',
      source: { provider: 'openlibrary', id: '/works/OL27482W' },
      coverUrl: 'https://covers.openlibrary.org/b/id/14627509-L.jpg',
      thumbUrl: 'https://covers.openlibrary.org/b/id/14627509-M.jpg',
    });
    assert.equal(results[1].coverUrl, null);
  });

  const steamSearch = { items: [{ type: 'app', id: 3357650, name: 'PRAGMATA' }, { type: 'app', id: 1145360, name: 'Hades' }, { type: 'sub', id: 9, name: 'Bundle' }] };

  test('games: Steam, portrait box art from the store asset list (newer games keep it in hashed folders), apps only', async () => {
    const { results, calls } = await search(providers, {
      'https://store.steampowered.com/api/storesearch/': steamSearch,
      'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/': {
        response: { store_items: [{ appid: 3357650, assets: { asset_url_format: 'steam/apps/3357650/${FILENAME}?t=1', library_capsule: '2c65f3/library_capsule.jpg' } }] },
      },
    }, 'game', 'pragmata');
    assert.equal(results.length, 2);
    assert.equal(calls.length, 2);                   // one asset request for all results
    assert.match(decodeURIComponent(calls[1].url), /"appid":3357650.*"appid":1145360/);
    assert.equal(results[0].coverUrl, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3357650/2c65f3/library_capsule.jpg?t=1');
    // not in the asset list: the classic address
    assert.equal(results[1].coverUrl, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg');
    assert.deepEqual(results[0].source, { provider: 'steam', id: '3357650' });
  });

  test('games: Steam search still works when the asset list is down', async () => {
    const { results } = await search(providers, { 'https://store.steampowered.com/api/storesearch/': steamSearch }, 'game', 'pragmata');
    assert.equal(results[0].coverUrl, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3357650/library_600x900.jpg');
  });
});

describe('catalogs with an API key', () => {
  test('a TMDB key switches movies and series to TMDB', async () => {
    const providers = chooseProviders({ tmdbApiKey: 'short-v3-key' });
    const answer = { results: [{ id: 438631, title: 'Dune', name: 'Dune', release_date: '2021-09-15', first_air_date: '2021-01-01', poster_path: '/d5N.jpg' }] };
    const movie = await search(providers, { 'https://api.themoviedb.org/3/search/movie': answer }, 'movie', 'dune');
    assert.match(movie.calls[0].url, /&api_key=short-v3-key$/);
    assert.deepEqual([movie.results[0].title, movie.results[0].year, movie.results[0].coverUrl, movie.results[0].thumbUrl],
      ['Dune', 2021, 'https://image.tmdb.org/t/p/w500/d5N.jpg', 'https://image.tmdb.org/t/p/w185/d5N.jpg']);

    const series = await search(providers, { 'https://api.themoviedb.org/3/search/tv': answer }, 'series', 'dune');
    assert.equal(series.results[0].source.provider, 'tmdb');
  });

  test('a long TMDB read access token is sent as a Bearer header, not in the URL', async () => {
    const token = 'x'.repeat(200);
    const { calls } = await search(chooseProviders({ tmdbApiKey: token }), { 'https://api.themoviedb.org/3/': { results: [] } }, 'movie', 'dune');
    assert.equal(calls[0].headers.Authorization, `Bearer ${token}`);
    assert.doesNotMatch(calls[0].url, /api_key/);
  });

  test('a RAWG key switches games to RAWG, with covers cropped to portrait', async () => {
    const { results } = await search(chooseProviders({ rawgApiKey: 'k' }), {
      'https://api.rawg.io/api/games': {
        results: [{ id: 3498, name: 'Grand Theft Auto V', released: '2013-09-17',
          background_image: 'https://media.rawg.io/media/games/456/abc.jpg',
          platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation 5' } }] }],
      },
    }, 'game', 'gta');
    assert.equal(results[0].coverUrl, 'https://media.rawg.io/media/crop/600/900/games/456/abc.jpg');
    assert.equal(results[0].creator, 'PC, PlayStation 5');
    assert.equal(results[0].year, 2013);
  });

  test('books stay on Open Library', () => {
    assert.equal(chooseProviders({ tmdbApiKey: 'a', rawgApiKey: 'b' }).book.id, 'openlibrary');
  });
});

describe('createCatalog', () => {
  const catalog = createCatalog({ http: fakeHttp({}) });

  test('rejects an unknown category or an empty query before asking anyone', async () => {
    await assert.rejects(catalog.search('podcast', 'x'), SearchError);
    await assert.rejects(catalog.search('movie', '   '), SearchError);
    await assert.rejects(catalog.search('movie', null), SearchError);
  });

  test('only allows https images from the catalogs in use', () => {
    assert.ok(catalog.isAllowedImage('https://covers.openlibrary.org/b/id/1-L.jpg'));
    assert.ok(catalog.isAllowedImage('https://images.metahub.space/poster/medium/tt1/img'));
    for (const url of ['http://covers.openlibrary.org/b/id/1-L.jpg', 'https://evil.example/a.jpg', 'https://image.tmdb.org/t/p/w500/a.jpg', 'nope', null]) {
      assert.equal(catalog.isAllowedImage(url), false, String(url));
    }
  });

  test('drops images from other hosts and results without a title', async () => {
    const provider = {
      id: 'fake', name: 'Fake', url: 'https://fake.example/', imageHosts: ['img.fake.example'],
      search: async () => [
        { id: 1, title: 'Good', coverUrl: 'https://img.fake.example/1.jpg' },
        { id: 2, title: 'Sneaky', coverUrl: 'https://tracker.example/1.gif' },
        { id: 3, title: '' },
        { id: null, title: 'No id' },
      ],
    };
    const results = await createCatalog({ http: fakeHttp({}), providers: { movie: provider } }).search('movie', 'x');
    assert.deepEqual(results.map((r) => [r.title, r.coverUrl, r.thumbUrl]), [
      ['Good', 'https://img.fake.example/1.jpg', 'https://img.fake.example/1.jpg'],
      ['Sneaky', null, null],
    ]);
  });

  test('lists who searches each category, for the credits line', () => {
    assert.deepEqual(Object.keys(catalog.credits).sort(), ['book', 'game', 'movie', 'series']);
    assert.equal(catalog.credits.series.name, 'TVmaze');
  });
});
