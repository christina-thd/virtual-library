import { CATEGORY_IDS, MAX_CREATOR, MAX_QUERY, MAX_TITLE } from '../../public/js/shared/library.js';
import { parseYear, readDetails } from '../library/state.js';
import { cleanGenres } from './genres.js';
import { appleBooks } from './providers/apple-books.js';
import { createCinemeta } from './providers/cinemeta.js';
import { gog } from './providers/gog.js';
import { kitsu } from './providers/kitsu.js';
import { mangaDex } from './providers/mangadex.js';
import { nintendo } from './providers/nintendo.js';
import { openLibrary, openLibraryComics } from './providers/open-library.js';
import { createRawg } from './providers/rawg.js';
import { steam } from './providers/steam.js';
import { createTmdb } from './providers/tmdb.js';
import { tvmaze } from './providers/tvmaze.js';

const MAX_RESULTS = 20;
// recent searches are answered from memory
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

/**
 * Which catalogs search each category, best first: the next is asked only when the one before finds nothing
 * or doesn't answer. A catalog with an API key goes first when the key is set.
 * Games are split by platform (a switch on the search screen): each store answers every search with its own
 * look-alikes ("metroid" on Steam is "Metroidvania Maker"), so one can't fall back to the other. Comics are split
 * into manga and western comics the same way.
 */
export function chooseProviders({ tmdbApiKey = null, rawgApiKey = null } = {}) {
  const withKey = (key, create) => (key ? [create(key)] : []);
  return {
    movie: [...withKey(tmdbApiKey, (k) => createTmdb('movie', k)), createCinemeta('movie')],
    series: [...withKey(tmdbApiKey, (k) => createTmdb('series', k)), tvmaze, createCinemeta('series')],
    book: [openLibrary, appleBooks],
    game: [
      // icon: on the switch (ui/icons.js); label: its name, for screen readers
      { id: 'pc', label: rawgApiKey ? 'All platforms' : 'PC & Steam Deck', icon: rawgApiKey ? 'game' : 'steam', providers: [...withKey(rawgApiKey, createRawg), steam, gog] },
      { id: 'nintendo', label: 'Nintendo', icon: 'nintendo', providers: [nintendo] },
    ],
    comic: [
      { id: 'manga', label: 'Manga', providers: [kitsu, mangaDex, openLibraryComics] },
      { id: 'comics', label: 'Comics', providers: [openLibraryComics] },
    ],
  };
}

/** Details as a catalog gave them, its genres named the way every catalog's are (genres.js). */
const catalogDetails = (category, raw) =>
  readDetails(category, raw && { ...raw, genres: raw.genres == null ? undefined : cleanGenres(category, raw.genres) });

const clean = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '');

/**
 * Search across the catalogs, turning their results into what screens show and send back with `addItem`.
 * Every provider has the same shape:
 *   { id, name, url, imageHosts, search(query, http) → [{ id, title, year, creator, coverUrl, thumbUrl?, ...details }],
 *     details?(id, http) → { runtime | seasons, episodes, runtime | pages | volumes, publisher, genres } }
 * `providers`: per category, a list of them (best first) or a list of sources to pick from ({ id, label, providers }).
 * @param {{ http: any, providers?: Record<string, any>, now?: () => number }} options
 */
export function createCatalog({ http, providers = chooseProviders(), now = Date.now }) {
  const toSources = (value) => {
    const list = [value].flat();
    return list[0]?.providers ? list : [{ id: 'all', label: null, providers: list }];
  };
  const sourcesOf = Object.fromEntries(Object.entries(providers).map(([category, value]) => [category, toSources(value)]));
  const imageHosts = new Set(Object.values(sourcesOf).flat().flatMap((s) => s.providers).flatMap((p) => p.imageHosts));

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

  /** `sourceId` picks one of the category's sources (games: "pc" or "nintendo"); the first by default. */
  function search(category, rawQuery, sourceId = null) {
    if (!CATEGORY_IDS.includes(category)) return Promise.reject(new SearchError(`category must be one of: ${CATEGORY_IDS.join(', ')}`));
    const query = clean(rawQuery, MAX_QUERY);
    if (!query) return Promise.reject(new SearchError('Type something to search for'));
    const sources = sourcesOf[category];
    const source = sourceId ? sources.find((s) => s.id === sourceId) : sources[0];
    if (!source) return Promise.reject(new SearchError(`source must be one of: ${sources.map((s) => s.id).join(', ')}`));

    const key = `${category}\0${source.id}\0${query.toLowerCase().replace(/\s+/g, ' ')}`;
    const hit = cache.get(key);
    cache.delete(key);                             // re-added below: most recently used last
    if (hit && now() - hit.at < CACHE_TTL_MS) {
      cache.set(key, hit);
      return hit.results;
    }
    const results = ask(category, source.providers, query);
    cache.set(key, { at: now(), results });
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    results.catch(() => {
      if (cache.get(key)?.results === results) cache.delete(key);
    });
    return results;
  }

  /** The first catalog that finds something. Fails only if none of them answered. */
  async function ask(category, providerList, query) {
    let answered = false;
    let failure = null;
    for (const provider of providerList) {
      let found;
      try {
        found = await provider.search(query, http);
      } catch (err) {
        failure ??= err;
        continue;
      }
      answered = true;
      const results = tidy(category, provider, found);
      if (results.length) return results;
    }
    if (answered) return [];
    throw failure;
  }

  function tidy(category, provider, found) {
    return found
      .map((r) => ({
        category,
        title: clean(r.title, MAX_TITLE),
        year: parseYear(r.year),
        creator: clean(r.creator, MAX_CREATOR) || null,
        source: { provider: provider.id, id: clean(r.id, 100) },
        coverUrl: image(r.coverUrl),
        thumbUrl: image(r.thumbUrl) ?? image(r.coverUrl),
        ...Object.fromEntries(Object.entries(catalogDetails(category, r)).filter(([, value]) => value != null)),
      }))
      .filter((r) => r.title && r.source.id)
      .slice(0, MAX_RESULTS);
  }

  /** Per category, what the search screen offers: [{ id, label, credits: [{ id, name, url }] }]; several are a switch. */
  const sources = Object.fromEntries(Object.entries(sourcesOf).map(([category, list]) =>
    [category, list.map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? null, credits: s.providers.map((p) => ({ id: p.id, name: p.name, url: p.url })) }))]));

  /** An item's details from the catalog it was found in (unknown fields null), or null when it has none to give. */
  async function detailsOf(category, source) {
    const provider = (sourcesOf[category] ?? []).flatMap((s) => s.providers).find((p) => p.id === source?.provider);
    if (!provider?.details) return null;
    return catalogDetails(category, await provider.details(source.id, http));
  }

  return { search, isAllowedImage, sources, detailsOf };
}
