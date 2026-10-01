import { CATEGORY_IDS, MAX_CREATOR, MAX_QUERY, MAX_TITLE } from '../../public/js/shared/library.js';
import { parseYear } from '../library/state.js';
import { cinemeta } from './providers/cinemeta.js';
import { openLibrary } from './providers/open-library.js';
import { createRawg } from './providers/rawg.js';
import { steam } from './providers/steam.js';
import { createTmdb } from './providers/tmdb.js';
import { tvmaze } from './providers/tvmaze.js';

const MAX_RESULTS = 20;
// Recent searches are answered from memory: typing back, switching categories and reopening the search are instant.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_SIZE = 200;

/** A search that can't be run (bad category or query). Answered as 400. */
export class SearchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchError';
    this.status = 400;
  }
}

/** Which catalog searches each category: the keyless ones by default, better ones when a key is set. */
export function chooseProviders({ tmdbApiKey = null, rawgApiKey = null } = {}) {
  return {
    movie: tmdbApiKey ? createTmdb('movie', tmdbApiKey) : cinemeta,
    series: tmdbApiKey ? createTmdb('series', tmdbApiKey) : tvmaze,
    book: openLibrary,
    game: rawgApiKey ? createRawg(rawgApiKey) : steam,
  };
}

const clean = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '');

/**
 * Search across the catalogs. Every provider has the same shape:
 *   { id, name, url, imageHosts: [hostname], search(query, http) → [{ id, title, year, creator, coverUrl, thumbUrl? }] }
 * and this turns its results into what screens show and send back with `addItem`.
 */
export function createCatalog({ http, providers = chooseProviders(), now = Date.now }) {
  const imageHosts = new Set(Object.values(providers).flatMap((p) => p.imageHosts));

  /** Only https images from the catalogs' own image servers are shown and downloaded. */
  function isAllowedImage(url) {
    try {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' && imageHosts.has(hostname);
    } catch {
      return false;
    }
  }
  const image = (url) => (typeof url === 'string' && isAllowedImage(url) ? url : null);

  // key → { at, results: Promise }. Holds searches still running too, so the same search asked twice
  // at once goes out once. Failures are dropped, to be tried again.
  const cache = new Map();

  function search(category, rawQuery) {
    if (!CATEGORY_IDS.includes(category)) return Promise.reject(new SearchError(`category must be one of: ${CATEGORY_IDS.join(', ')}`));
    const query = clean(rawQuery, MAX_QUERY);
    if (!query) return Promise.reject(new SearchError('Type something to search for'));

    const key = `${category}\0${query.toLowerCase().replace(/\s+/g, ' ')}`;
    const hit = cache.get(key);
    cache.delete(key);                             // re-added below: most recently used last
    if (hit && now() - hit.at < CACHE_TTL_MS) {
      cache.set(key, hit);
      return hit.results;
    }
    const results = ask(category, query);
    cache.set(key, { at: now(), results });
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    results.catch(() => {
      if (cache.get(key)?.results === results) cache.delete(key);
    });
    return results;
  }

  async function ask(category, query) {
    const provider = providers[category];
    const found = await provider.search(query, http);
    return found
      .map((r) => ({
        category,
        title: clean(r.title, MAX_TITLE),
        year: parseYear(r.year),
        creator: clean(r.creator, MAX_CREATOR) || null,
        source: { provider: provider.id, id: clean(r.id, 100) },
        coverUrl: image(r.coverUrl),
        thumbUrl: image(r.thumbUrl) ?? image(r.coverUrl),
      }))
      .filter((r) => r.title && r.source.id)
      .slice(0, MAX_RESULTS);
  }

  /** Credits per category, shown under the search results. */
  const credits = Object.fromEntries(Object.entries(providers).map(([category, p]) => [category, { name: p.name, url: p.url }]));

  return { search, isAllowedImage, credits };
}
