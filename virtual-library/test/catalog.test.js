// Search catalogs, with canned answers in the shape each API really sends (no network).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chooseProviders, createCatalog, SearchError } from '../src/catalog/index.js';
import { parseVolumes } from '../src/catalog/providers/mangaupdates.js';
import { pickPublisher } from '../src/catalog/providers/open-library.js';

/** An http client that answers from `routes` (URL prefix → body) and records what was asked. */
function fakeHttp(routes) {
  const calls = [];
  return {
    calls,
    async json(url, options = {}) {
      calls.push({ url, headers: options.headers ?? {}, body: options.body });
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

  test('comics: manga from Kitsu, with its genres and author sent alongside; light novels left out', async () => {
    const { results, calls } = await search(providers, {
      'https://kitsu.io/api/edge/manga': {
        data: [
          { id: '11', type: 'manga', attributes: { canonicalTitle: 'NARUTO', titles: { en: 'Naruto', en_jp: 'NARUTO' }, startDate: '1999-09-21', volumeCount: 72, subtype: 'manga',
            posterImage: { small: 'https://media.kitsu.app/manga/11/small.jpg', large: 'https://media.kitsu.app/manga/11/large.jpg' } },
          relationships: { categories: { data: [{ type: 'categories', id: '1' }, { type: 'categories', id: '2' }] }, staff: { data: [{ type: 'mediaStaff', id: '7' }] } } },
          { id: '12', type: 'manga', attributes: { canonicalTitle: 'One Piece', titles: {}, startDate: '1997-07-22', volumeCount: 0, subtype: 'manga', posterImage: null }, relationships: {} },
          { id: '13', type: 'manga', attributes: { canonicalTitle: 'Naruto Ninden', titles: {}, subtype: 'novel' }, relationships: {} },
        ],
        included: [
          { type: 'categories', id: '1', attributes: { title: 'Shounen' } }, { type: 'categories', id: '2', attributes: { title: 'Action' } },
          { type: 'mediaStaff', id: '7', attributes: { role: 'Story & Art' }, relationships: { person: { data: { type: 'people', id: '9' } } } },
          { type: 'people', id: '9', attributes: { name: 'Masashi Kishimoto' } },
        ],
      },
    }, 'comic', 'naruto');
    assert.equal(calls[0].headers.Accept, 'application/vnd.api+json');
    assert.deepEqual(results[0], {
      category: 'comic', title: 'Naruto', year: 1999, creator: 'Masashi Kishimoto', source: { provider: 'kitsu', id: '11' },
      coverUrl: 'https://media.kitsu.app/manga/11/large.jpg', thumbUrl: 'https://media.kitsu.app/manga/11/small.jpg',
      genres: ['Action'],
    });
    assert.deepEqual(results.map((r) => r.title), ['Naruto', 'One Piece']);
  });

  test('comics: MangaDex when Kitsu finds nothing, without doujinshi', async () => {
    const tag = (group, en) => ({ attributes: { group, name: { en } } });
    const { results } = await search(providers, {
      'https://kitsu.io/api/edge/manga': { data: [] },
      'https://api.mangadex.org/manga': {
        data: [
          { id: 'a1', attributes: { title: { 'ja-ro': 'Naruto' }, altTitles: [{ en: 'Naruto' }], year: 1999, status: 'completed', lastVolume: '72', tags: [tag('genre', 'Action'), tag('theme', 'Ninja')] },
            relationships: [{ type: 'author', attributes: { name: 'Kishimoto Masashi' } }, { type: 'cover_art', attributes: { fileName: 'c.jpg' } }] },
          { id: 'b2', attributes: { title: { en: 'One Piece' }, year: 1997, status: 'ongoing', lastVolume: '', tags: [] }, relationships: [] },
          { id: 'c3', attributes: { title: { en: 'Naruto - Rocket' }, tags: [tag('format', 'Doujinshi')] }, relationships: [] },
        ],
      },
    }, 'comic', 'naruto');
    assert.deepEqual(results[0], {
      category: 'comic', title: 'Naruto', year: 1999, creator: 'Kishimoto Masashi', source: { provider: 'mangadex', id: 'a1' },
      coverUrl: 'https://uploads.mangadex.org/covers/a1/c.jpg.512.jpg', thumbUrl: 'https://uploads.mangadex.org/covers/a1/c.jpg.256.jpg',
      genres: ['Action'],
    });
    assert.deepEqual(results.map((r) => r.title), ['Naruto', 'One Piece']);
  });

  test('manga volumes come from MangaUpdates: the one from the same year, ongoing ones too', async () => {
    const kitsuManga = { data: { id: '38', type: 'manga', attributes: { canonicalTitle: 'One Piece', titles: { en: 'One Piece' }, startDate: '1997-07-22', volumeCount: 0, status: 'current', subtype: 'manga' }, relationships: {} } };
    const http = fakeHttp({
      'https://kitsu.io/api/edge/manga/38': kitsuManga,
      'https://api.mangaupdates.com/v1/series/search': { results: [
        { record: { series_id: 1, title: 'One Piece dj', type: 'Doujinshi', year: '1997' } },
        { record: { series_id: 2, title: 'One Piece Party', type: 'Manga', year: '2014' } },
        { record: { series_id: 3, title: 'One Piece', type: 'Manga', year: '1997' } },
      ] },
      'https://api.mangaupdates.com/v1/series/3': { status: '115 Volumes (Ongoing)  \n' },
    });
    const catalog = createCatalog({ http, providers: chooseProviders() });
    assert.deepEqual(await catalog.detailsOf('comic', { provider: 'kitsu', id: '38' }), { volumes: 115, publisher: null, genres: [] });
    assert.deepEqual(http.calls[1].body, { search: 'One Piece', perpage: 5 });
    // MangaUpdates down: a finished manga keeps its catalog's own count, an ongoing one has none
    const down = fakeHttp({ 'https://kitsu.io/api/edge/manga/38': kitsuManga });
    assert.deepEqual(await createCatalog({ http: down, providers: chooseProviders() }).detailsOf('comic', { provider: 'kitsu', id: '38' }), { volumes: null, publisher: null, genres: [] });
  });

  test('the publisher of a comic: the known one its editions name most; others are none', () => {
    assert.equal(pickPublisher(['Panini Verlags GmbH', 'DC', 'DC Comics Inc.', 'IDW Publishing', 'dc']), 'DC');
    assert.equal(pickPublisher(['Titan Publishing Company', 'DC Comics', 'Vertigo', 'Brand: Vertigo / DC Comics']), 'DC');
    assert.equal(pickPublisher(['Marvel Enterprises', 'PANINI', 'Marvel']), 'Marvel');
    assert.equal(pickPublisher(['Image Comics']), 'Image');
    assert.equal(pickPublisher(['Pantheon books', 'Random House']), null);
    assert.equal(pickPublisher([]), null);
  });

  test('a volume count is the first one MangaUpdates gives: the whole series, not one of its parts', () => {
    assert.equal(parseVolumes('24 Volumes (Complete)\n\nPart 1: 11 Volumes (Complete)'), 24);
    assert.equal(parseVolumes('200 Chapters + Prologue (Complete)\n15 Volumes (Complete)'), 15);
    assert.equal(parseVolumes('1 Volume (Complete)'), 1);
    assert.equal(parseVolumes('52 Chapters (Ongoing)'), null);
    assert.equal(parseVolumes(null), null);
  });

  test('comics: western comics from Open Library, only those filed as comics, one volume each', async () => {
    const http = fakeHttp({ 'https://openlibrary.org/search.json': { docs: [{ key: '/works/OL2897798W', title: 'Watchmen', author_name: ['Alan Moore', 'DC Comics'], first_publish_year: 1986, cover_i: 7774899, publisher: ['Panini', 'DC', 'IDW Publishing'] }] } });
    const results = await createCatalog({ http, providers }).search('comic', 'watchmen', 'comics');
    assert.match(decodeURIComponent(http.calls[0].url), /q=watchmen subject:\(comics OR "graphic novels"/);
    assert.deepEqual([results[0].title, results[0].creator, results[0].volumes, results[0].publisher], ['Watchmen', 'Alan Moore', 1, 'DC']);
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

describe('details: movie durations, series seasons and episodes, book pages', () => {
  test('books: pages come with Open Library search results, and can be looked up by work; Apple Books has none', async () => {
    const { results, calls } = await search(chooseProviders(), {
      'https://openlibrary.org/search.json': { docs: [{ key: '/works/OL27482W', title: 'The Hobbit', number_of_pages_median: 310 }, { key: '/works/OL1W', title: 'Thin' }] },
    }, 'book', 'hobbit');
    assert.match(calls[0].url, /fields=[^&]*number_of_pages_median/);
    assert.deepEqual(results.map((r) => r.pages), [310, undefined]);

    const http = fakeHttp({ 'https://openlibrary.org/search.json?q=key%3A%22%2Fworks%2FOL27482W%22': { docs: [{
      number_of_pages_median: 310, subject: ['Fantasy', 'Arkenstone', 'hobbits', 'Juvenile fiction', 'Fantasy fiction', 'Classics'],
    }] } });
    const catalog = createCatalog({ http, providers: chooseProviders() });
    assert.deepEqual(await catalog.detailsOf('book', { provider: 'openlibrary', id: '/works/OL27482W' }), { pages: 310, genres: ['Fantasy', "Children's", 'Classics'] });
    assert.equal(await catalog.detailsOf('book', { provider: 'applebooks', id: '1' }), null);
  });

  test('a duration is kept from search results when the catalog includes it (Cinemeta only sometimes does)', async () => {
    const { results } = await search(chooseProviders(), {
      'https://v3-cinemeta.strem.io/catalog/movie/top/search=': { metas: [{ imdb_id: 'tt1', name: 'Dune', runtime: '155 min' }, { imdb_id: 'tt2', name: 'Dune 2' }] },
    }, 'movie', 'dune');
    assert.deepEqual(results.map((r) => r.runtime), [155, undefined]);
  });

  test('movies: from the full entry on Cinemeta, or TMDB with a key', async () => {
    const http = fakeHttp({
      'https://v3-cinemeta.strem.io/meta/movie/tt15239678.json': { meta: { runtime: '167 min', genres: ['Action', 'Science Fiction'] } },
      'https://api.themoviedb.org/3/movie/693134': { runtime: 166, genres: [{ id: 878, name: 'Science Fiction' }] },
    });
    const keyless = createCatalog({ http, providers: chooseProviders() });
    assert.deepEqual(await keyless.detailsOf('movie', { provider: 'cinemeta', id: 'tt15239678' }), { runtime: 167, genres: ['Action', 'Sci-Fi'] });
    const tmdb = createCatalog({ http, providers: chooseProviders({ tmdbApiKey: 'k' }) });
    assert.deepEqual(await tmdb.detailsOf('movie', { provider: 'tmdb', id: '693134' }), { runtime: 166, genres: ['Sci-Fi'] });
    assert.match(http.calls.at(-1).url, /\/movie\/693134\?language=en-US&api_key=k$/);
  });

  test('series: seasons and episodes out so far (not announced ones, not specials) and an episode\'s length, on TVmaze, Cinemeta or TMDB', async () => {
    const http = fakeHttp({
      'https://api.tvmaze.com/shows/44933?embed=episodes': { genres: ['Drama', 'Science-Fiction', 'Thriller'], _embedded: { episodes: [
        { season: 1, airstamp: '2022-02-18T02:00:00+00:00', runtime: 57 }, { season: 1, airstamp: '2022-02-25T02:00:00+00:00', runtime: 55 },
        { season: 2, airdate: '2025-01-17', runtime: null }, { season: 3, airdate: '2999-01-01', runtime: 90 }, { season: 3, airdate: null },
      ] } },
      'https://v3-cinemeta.strem.io/meta/series/tt5753856.json': { meta: { runtime: '60 min', videos: [
        { season: 0, released: '2017-01-01T00:00:00Z' }, { season: 1, released: '2017-12-01T12:00:00Z' },
        { season: 2, firstAired: '2019-06-21T12:00:00Z' },
      ] } },
      'https://api.themoviedb.org/3/tv/70523': { number_of_seasons: 3, number_of_episodes: 26, episode_run_time: [], last_episode_to_air: { runtime: 53 }, genres: [{ name: 'Sci-Fi & Fantasy' }, { name: 'Drama' }] },
    });
    const keyless = createCatalog({ http, providers: chooseProviders() });
    assert.deepEqual(await keyless.detailsOf('series', { provider: 'tvmaze', id: '44933' }), { seasons: 2, episodes: 3, runtime: 56, genres: ['Drama', 'Sci-Fi', 'Thriller'] });   // aired ones' average
    assert.deepEqual(await keyless.detailsOf('series', { provider: 'cinemeta', id: 'tt5753856' }), { seasons: 2, episodes: 2, runtime: 60, genres: [] });
    const tmdb = createCatalog({ http, providers: chooseProviders({ tmdbApiKey: 'k' }) });
    assert.deepEqual(await tmdb.detailsOf('series', { provider: 'tmdb', id: '70523' }), { seasons: 3, episodes: 26, runtime: 53, genres: ['Sci-Fi', 'Fantasy', 'Drama'] });
  });

  test('nothing for catalogs that do not know, or items typed by hand', async () => {
    const catalog = createCatalog({ http: fakeHttp({}), providers: chooseProviders() });
    assert.equal(await catalog.detailsOf('book', { provider: 'applebooks', id: '1' }), null);
    assert.equal(await catalog.detailsOf('movie', null), null);
  });
});

describe('fallback catalogs (asked when the one before finds nothing)', () => {
  const providers = chooseProviders();

  test('series: Cinemeta when TVmaze finds nothing', async () => {
    const { results, calls } = await search(providers, {
      'https://api.tvmaze.com/search/shows': [],
      'https://v3-cinemeta.strem.io/catalog/series/top/search=': {
        metas: [{ imdb_id: 'tt19231492', name: 'Dark Matter', releaseInfo: '2024-', poster: 'https://m.media-amazon.com/images/M/MV5BN2U._V1_SX250.jpg' }],
      },
    }, 'series', 'dark matter');
    assert.equal(calls.length, 2);
    assert.deepEqual(results[0], {
      category: 'series', title: 'Dark Matter', year: 2024, creator: null,
      source: { provider: 'cinemeta', id: 'tt19231492' },
      coverUrl: 'https://m.media-amazon.com/images/M/MV5BN2U._V1_SX600.jpg',
      thumbUrl: 'https://m.media-amazon.com/images/M/MV5BN2U._V1_SX250.jpg',
    });
  });

  test('books: Apple Books when Open Library finds nothing, covers in portrait sizes', async () => {
    const { results, calls } = await search(providers, {
      'https://openlibrary.org/search.json': { docs: [] },
      'https://itunes.apple.com/search': {
        results: [{ trackId: 1602694961, trackName: 'The Hobbit', artistName: 'J. R. R. Tolkien', releaseDate: '2012-02-15T08:00:00Z',
          genres: ['Fantasy', 'Books', 'Sci-Fi & Fantasy', 'Classics'],
          artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Publication122/v4/8a/9780547951973.jpg/100x100bb.jpg' }],
      },
    }, 'book', 'hobbit');
    assert.match(calls[1].url, /term=hobbit&media=ebook/);
    assert.deepEqual(results[0], {
      category: 'book', title: 'The Hobbit', year: 2012, creator: 'J. R. R. Tolkien',
      source: { provider: 'applebooks', id: '1602694961' },
      coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Publication122/v4/8a/9780547951973.jpg/600x900bb.jpg',
      thumbUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Publication122/v4/8a/9780547951973.jpg/200x300bb.jpg',
      genres: ['Fantasy', 'Sci-Fi', 'Classics'],
    });
  });

  test('games: GOG when Steam is down', async () => {
    const { results, calls } = await search(providers, {
      'https://catalog.gog.com/v1/catalog': {
        products: [{ id: '1207664663', title: 'The Witcher 3: Wild Hunt', releaseDate: '2015.05.18', developers: ['CD PROJEKT RED'],
          coverVertical: 'https://images.gog-statics.com/abc.jpg' }],
      },
    }, 'game', 'witcher 3');
    assert.match(calls.at(-1).url, /query=like:witcher%203&/);
    assert.deepEqual(results[0], {
      category: 'game', title: 'The Witcher 3: Wild Hunt', year: 2015, creator: 'CD PROJEKT RED',
      source: { provider: 'gog', id: '1207664663' },
      coverUrl: 'https://images.gog-statics.com/abc.jpg',
      thumbUrl: 'https://images.gog-statics.com/abc.jpg',
    });
  });

  test('the first catalog with results wins: later ones are not asked', async () => {
    const { calls } = await search(providers, { 'https://openlibrary.org/search.json': { docs: [{ key: '/works/OL1W', title: 'Dune' }] } }, 'book', 'dune');
    assert.equal(calls.length, 1);
  });

  test('nothing anywhere is an empty answer; an error only when no catalog answered', async () => {
    const fake = (id, answer) => ({ id, name: id, url: 'https://x.example/', imageHosts: [], search: answer });
    const down = (message) => async () => { throw new Error(message); };
    const empty = async () => [];
    const run = (...list) => createCatalog({ http: fakeHttp({}), providers: { movie: list } }).search('movie', 'x');
    assert.deepEqual(await run(fake('a', down('a is down')), fake('b', empty)), []);
    assert.deepEqual(await run(fake('a', empty), fake('b', down('b is down'))), []);
    await assert.rejects(run(fake('a', down('a is down')), fake('b', down('b is down'))), /a is down/);
  });

  test('credits list every catalog of a category, in the order they are asked', () => {
    const { sources } = createCatalog({ http: fakeHttp({}), providers });
    assert.deepEqual(sources.book, [{ id: 'all', label: null, icon: null, credits: [
      { id: 'openlibrary', name: 'Open Library', url: 'https://openlibrary.org/' },
      { id: 'applebooks', name: 'Apple Books', url: 'https://www.apple.com/apple-books/' },
    ] }]);
    assert.deepEqual(sources.game[0].credits[1], { id: 'gog', name: 'GOG', url: 'https://www.gog.com/' });
  });
});

describe('games: PC or Nintendo, picked on the search screen', () => {
  const providers = chooseProviders();
  const nintendoAnswer = {
    response: { docs: [{
      fs_id: '1173281', title: 'Mario Kart 8 Deluxe', dates_released_dts: ['2017-04-28T00:00:00Z'], system_names_txt: ['Nintendo Switch'],
      image_url: 'https://www.nintendo.com/eu/media/images/05_packshots/PS_NSwitch_MarioKart8Deluxe_image500w.jpg',
      image_url_sq_s: 'https://www.nintendo.com/eu/media/images/11_square_images/SQ_NSwitch_MarioKart8Deluxe_image500w.jpg',
      pretty_game_categories_txt: ['Racing'],
    }] },
  };

  test('the two switch choices, PC first', () => {
    const { sources } = createCatalog({ http: fakeHttp({}), providers });
    assert.deepEqual(sources.game.map((s) => [s.id, s.label]), [['pc', 'PC & Steam Deck'], ['nintendo', 'Nintendo']]);
    const rawg = createCatalog({ http: fakeHttp({}), providers: chooseProviders({ rawgApiKey: 'k' }) });
    assert.equal(rawg.sources.game[0].label, 'All platforms');   // RAWG knows consoles too
  });

  test('Nintendo: the store search, box art as the cover, consoles as the line under the title', async () => {
    const http = fakeHttp({ 'https://searching.nintendo-europe.com/en/select': nintendoAnswer });
    const results = await createCatalog({ http, providers }).search('game', 'mario kart 8', 'nintendo');
    assert.match(http.calls[0].url, /\?q=mario%20kart%208&fq=type:GAME&/);
    assert.equal(http.calls.length, 1);                // Steam isn't asked
    assert.deepEqual(results[0], {
      category: 'game', title: 'Mario Kart 8 Deluxe', year: 2017, creator: 'Nintendo Switch',
      source: { provider: 'nintendo', id: '1173281' },
      coverUrl: 'https://www.nintendo.com/eu/media/images/05_packshots/PS_NSwitch_MarioKart8Deluxe_image500w.jpg',
      thumbUrl: 'https://www.nintendo.com/eu/media/images/11_square_images/SQ_NSwitch_MarioKart8Deluxe_image500w.jpg',
      genres: ['Racing'],
    });
  });

  test('PC is the default, and each choice is remembered separately', async () => {
    const http = fakeHttp({
      'https://store.steampowered.com/api/storesearch/': { items: [{ type: 'app', id: 1145360, name: 'Hades' }] },
      'https://searching.nintendo-europe.com/en/select': { response: { docs: [{ fs_id: '1', title: 'Hades' }] } },
    });
    const catalog = createCatalog({ http, providers });
    assert.equal((await catalog.search('game', 'hades'))[0].source.provider, 'steam');
    assert.equal((await catalog.search('game', 'hades', 'nintendo'))[0].source.provider, 'nintendo');
    assert.equal((await catalog.search('game', 'hades', 'pc'))[0].source.provider, 'steam');   // from memory
  });

  test('an unknown choice is refused', async () => {
    const catalog = createCatalog({ http: fakeHttp({}), providers });
    await assert.rejects(catalog.search('game', 'x', 'xbox'), (err) => err instanceof SearchError && /pc, nintendo/.test(err.message));
    await assert.rejects(catalog.search('movie', 'x', 'nintendo'), SearchError);
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

  test('a key puts its catalog first; the keyless ones stay as fallbacks', () => {
    // category → source → catalogs asked, in order
    const ids = (providers) => Object.fromEntries(Object.entries(createCatalog({ http: fakeHttp({}), providers }).sources)
      .map(([c, list]) => [c, Object.fromEntries(list.map((s) => [s.id, s.credits.map((p) => p.id)]))]));
    assert.deepEqual(ids(chooseProviders()), {
      movie: { all: ['cinemeta'] }, series: { all: ['tvmaze', 'cinemeta'] }, book: { all: ['openlibrary', 'applebooks'] },
      comic: { manga: ['kitsu', 'mangadex', 'openlibrary'], comics: ['openlibrary'] }, game: { pc: ['steam', 'gog'], nintendo: ['nintendo'] },
    });
    assert.deepEqual(ids(chooseProviders({ tmdbApiKey: 'a', rawgApiKey: 'b' })), {
      movie: { all: ['tmdb', 'cinemeta'] }, series: { all: ['tmdb', 'tvmaze', 'cinemeta'] }, book: { all: ['openlibrary', 'applebooks'] },
      comic: { manga: ['kitsu', 'mangadex', 'openlibrary'], comics: ['openlibrary'] }, game: { pc: ['rawg', 'steam', 'gog'], nintendo: ['nintendo'] },
    });
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

  describe('remembers recent searches', () => {
    function counting({ fail = false } = {}) {
      const provider = {
        id: 'fake', name: 'Fake', url: 'https://fake.example/', imageHosts: [], calls: 0,
        search: async (query) => {
          provider.calls += 1;
          if (fail && provider.calls === 1) throw new Error('down');
          return [{ id: 1, title: query }];
        },
      };
      return provider;
    }

    test('the same search (any case or spacing) asks the catalog once, even when asked at the same time', async () => {
      const provider = counting();
      const catalog = createCatalog({ http: fakeHttp({}), providers: { movie: provider, book: provider } });
      const [a, b] = await Promise.all([catalog.search('movie', 'Dune'), catalog.search('movie', 'dune')]);
      assert.deepEqual(a, b);
      await catalog.search('movie', '  DUNE ');
      assert.equal(provider.calls, 1);
      await catalog.search('book', 'dune');           // another category is another search
      assert.equal(provider.calls, 2);
    });

    test('asks again once the answer is old, or after a failure', async () => {
      let time = 0;
      const provider = counting({ fail: true });
      const catalog = createCatalog({ http: fakeHttp({}), providers: { movie: provider }, now: () => time });
      await assert.rejects(catalog.search('movie', 'dune'));
      await catalog.search('movie', 'dune');
      assert.equal(provider.calls, 2);
      time += 11 * 60 * 1000;
      await catalog.search('movie', 'dune');
      assert.equal(provider.calls, 3);
    });
  });

  test('lists who searches each category, for the credits line', () => {
    assert.deepEqual(Object.keys(catalog.sources).sort(), ['book', 'comic', 'game', 'movie', 'series']);
    assert.equal(catalog.sources.series[0].credits[0].name, 'TVmaze');
  });
});
