import { randomBytes } from 'node:crypto';
import { CATEGORY_IDS, isRating, MAX_CREATOR, MAX_TITLE, sameSource, statusesFor } from '../../public/js/shared/library.js';

/**
 * What's saved to disk (JSON): { schema, statsSince, hiddenCategories, items }.
 *   statsSince        when the stats started counting (what was finished before has no real date)
 *   hiddenCategories  kinds kept off the home screen, stats and search (their items stay)
 * Each item is an Item (public/js/shared/library.js) with, instead of `image`:
 *   imageUrls    the catalog's images, best first (the next is tried if one fails)
 *   cover        file name of the saved copy (covers.js)
 *   detailsAt    when runtime / seasons / pages / volumes / genres were last looked up (catalog/details.js)
 *   caughtUp     series: when they were moved to Waiting, with how many episodes were out (seen) then
 */
export const SCHEMA_VERSION = 1;

/** File names of saved covers: `<item id>.<ext>`. */
export const COVER_FILE = /^[a-f0-9]{1,32}\.(jpg|png|webp)$/;
export const MAX_IMAGE_URLS = 3;

export const newId = () => randomBytes(6).toString('hex');

export function createInitialState(now = Date.now()) {
  return { schema: SCHEMA_VERSION, statsSince: now, hiddenCategories: [], items: [] };
}

export const findItem = (state, itemId) => state.items.find((i) => i.id === itemId);
export const findBySource = (state, source) => state.items.find((i) => sameSource(i.source, source));

const toText = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '');
const toTime = (value, fallback) => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback);

/** A 4-digit year from a number or a date-ish string ("2021", "2021-10-22"), or null. */
export function parseYear(value) {
  const match = /^\s*(\d{4})/.exec(String(value ?? ''));
  const year = match ? Number(match[1]) : NaN;
  return year >= 1000 && year <= 9999 ? year : null;
}

/** A count of seasons, episodes, pages or volumes: a whole number from 1, or null. */
export const parseCount = (value) => (Number.isInteger(value) && value > 0 && value < 100_000 ? value : null);

/** Minutes from a number or catalog text ("155 min", "2h 35min"), or null. */
export function parseMinutes(value) {
  let minutes = NaN;
  if (typeof value === 'number') minutes = value;
  else if (typeof value === 'string') {
    const hours = /(\d+)\s*h/i.exec(value);
    const mins = /(\d+)\s*m/i.exec(value) ?? (!hours && /^\s*(\d+)\s*$/.exec(value));
    if (hours || mins) minutes = Number(hours?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0);
  }
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

/** Hours played, to a tenth of an hour (42.5): from 0.1 up to 100,000, or null. */
export function parseHours(value) {
  const hours = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : NaN;
  return hours >= 0.1 && hours <= 100_000 ? hours : null;
}

// The details each category keeps, read from saved data, a search result or a catalog lookup.
const DETAIL_READERS = {
  movie: (raw) => ({ runtime: parseMinutes(raw.runtime), genres: parseGenres(raw.genres) }),
  series: (raw) => ({ seasons: parseCount(raw.seasons), episodes: parseCount(raw.episodes), genres: parseGenres(raw.genres) }),
  book: (raw) => ({ pages: parseCount(raw.pages), genres: parseGenres(raw.genres) }),
  comic: (raw) => ({ volumes: parseCount(raw.volumes), publisher: toText(raw.publisher, 40) || null, genres: parseGenres(raw.genres) }),
  game: (raw) => ({ genres: parseGenres(raw.genres) }),
};
const NO_DETAILS = Object.freeze({ runtime: null, seasons: null, episodes: null, pages: null, volumes: null, publisher: null, genres: null });

/**
 * A series' catch-ups: [{ at, episodes }]. One already waiting from before they were kept has seen what's out,
 * when isn't known.
 */
export function parseCaughtUp(value, status, episodes) {
  if (!Array.isArray(value)) return status === 'waiting' ? [{ at: null, episodes }] : [];
  return value.filter((c) => c && typeof c === 'object')
    .map((c) => ({ at: Number.isFinite(c.at) && c.at > 0 ? Math.trunc(c.at) : null, episodes: parseCount(c.episodes) }))
    .slice(-50);
}

/** Up to three genre names, or null when they haven't been looked up ([] when the catalog has none). */
export function parseGenres(value) {
  if (!Array.isArray(value)) return null;
  const names = value.filter((g) => typeof g === 'string').map((g) => g.trim()).filter((g) => g && g.length <= 30);
  return [...new Set(names)].slice(0, 3);
}

/** The details a category keeps, e.g. series: ['seasons', 'episodes', 'genres']. */
export const detailFields = (category) => (DETAIL_READERS[category] ? Object.keys(DETAIL_READERS[category]({})) : []);

/** The category's details found in `raw` (unknown ones null); {} for a category that keeps none. */
export const readDetails = (category, raw) => DETAIL_READERS[category]?.(raw ?? {}) ?? {};

/** Every detail field, the category's from `raw` and the rest null, as items store them. */
export const itemDetails = (category, raw) => ({ ...NO_DETAILS, ...readDetails(category, raw) });

/**
 * Distinct https URLs that pass `allowed`, best first.
 * @param {unknown[]} urls
 * @param {(url: string) => boolean} [allowed]
 */
export function parseImageUrls(urls, allowed = () => true) {
  const valid = urls.filter((url) => typeof url === 'string' && url.startsWith('https://') && url.length < 500 && allowed(url));
  return [...new Set(valid)].slice(0, MAX_IMAGE_URLS);
}

/** { provider, id } with short plain strings, or null. */
export function parseSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const provider = toText(raw.provider, 20);
  const id = toText(raw.id, 100);
  return /^[a-z]+$/.test(provider) && id ? { provider, id } : null;
}

function normalizeItem(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const title = toText(raw.title, MAX_TITLE);
  if (!title || !CATEGORY_IDS.includes(raw.category)) return null;   // nothing useful to show
  const status = statusesFor(raw.category).includes(raw.status) ? raw.status : 'pending';
  const addedAt = toTime(raw.addedAt, now);
  return {
    id: /^[a-f0-9]{1,32}$/.test(raw.id) ? raw.id : newId(),
    category: raw.category,
    title,
    year: parseYear(raw.year),
    creator: toText(raw.creator, MAX_CREATOR) || null,
    source: parseSource(raw.source),
    imageUrls: parseImageUrls(Array.isArray(raw.imageUrls) ? raw.imageUrls : []),
    cover: COVER_FILE.test(raw.cover) ? raw.cover : null,
    status,
    rating: status === 'done' && isRating(raw.rating) ? raw.rating : null,
    dropped: status === 'done' && raw.dropped === true,
    hoursPlayed: raw.category === 'game' ? parseHours(raw.hoursPlayed) : null,   // kept if moved back from done
    ...itemDetails(raw.category, raw),
    caughtUp: raw.category === 'series' ? parseCaughtUp(raw.caughtUp, status, parseCount(raw.episodes)) : null,
    detailsAt: Number.isFinite(raw.detailsAt) && raw.detailsAt > 0 ? raw.detailsAt : null,
    addedAt,
    finishedAt: status === 'done' ? toTime(raw.finishedAt, addedAt) : null,
  };
}

/** Hidden kinds: known ones, each once, and never all of them. */
export function parseHidden(value) {
  const hidden = [...new Set(Array.isArray(value) ? value : [])].filter((id) => CATEGORY_IDS.includes(id));
  return hidden.length < CATEGORY_IDS.length ? hidden : [];
}

/** Turns whatever was read from disk into a valid current-schema state (unusable items are dropped). */
export function normalizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return createInitialState(now);
  const items = raw.items.map((i) => normalizeItem(i, now)).filter(Boolean);
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  // a library from before the stats: they count from now on, not from when it was filled in
  const statsSince = Number.isFinite(raw.statsSince) && raw.statsSince > 0 && raw.statsSince <= now ? raw.statsSince : now;
  return { schema: SCHEMA_VERSION, statsSince, hiddenCategories: parseHidden(raw.hiddenCategories), items: unique };
}

/** An item as screens see it: `image` is the saved cover when there is one, else the catalog's. */
function itemView({ cover, imageUrls, ...item }) {
  return { ...item, image: cover ? `covers/${cover}` : imageUrls[0] ?? null };
}

/** What every screen receives. */
export function toView(state, appVersion) {
  return { version: appVersion, statsSince: state.statsSince, hiddenCategories: state.hiddenCategories, items: state.items.map(itemView) };
}
