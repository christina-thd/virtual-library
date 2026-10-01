import { randomBytes } from 'node:crypto';
import { CATEGORY_IDS, isRating, MAX_CREATOR, MAX_TITLE, sameSource, statusesFor } from '../../public/js/shared/library.js';

/**
 * State shape (saved to disk as JSON):
 *
 *   {
 *     schema: 1,
 *     items: [{
 *       id, category ('movie' | 'series' | 'book' | 'game'), title, year | null, creator | null,
 *       source: { provider, id } | null,   where it was found (null: added by hand)
 *       imageUrls: [string],               the catalog's images, best first (the next is tried if one fails)
 *       cover: string | null,              file name of the saved copy (see covers.js)
 *       status ('pending' | 'waiting' (series only) | 'done'), rating (1–5) | null,
 *       addedAt, finishedAt | null,        ms timestamps
 *     }],
 *   }
 */
export const SCHEMA_VERSION = 1;

/** File names of saved covers: `<item id>.<ext>`. */
export const COVER_FILE = /^[a-f0-9]{1,32}\.(jpg|png|webp)$/;
export const MAX_IMAGE_URLS = 3;

export const newId = () => randomBytes(6).toString('hex');

export function createInitialState() {
  return { schema: SCHEMA_VERSION, items: [] };
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

/** Distinct https URLs that pass `allowed`, best first. */
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
    addedAt,
    finishedAt: status === 'done' ? toTime(raw.finishedAt, addedAt) : null,
  };
}

/** Turns whatever was read from disk into a valid current-schema state (unusable items are dropped). */
export function normalizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return createInitialState();
  const items = raw.items.map((i) => normalizeItem(i, now)).filter(Boolean);
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  return { schema: SCHEMA_VERSION, items: unique };
}

/** An item as screens see it: `image` is the saved cover when there is one, else the catalog's. */
function itemView({ cover, imageUrls, ...item }) {
  return { ...item, image: cover ? `covers/${cover}` : imageUrls[0] ?? null };
}

/** What every screen receives. */
export function toView(state, appVersion) {
  return { version: appVersion, items: state.items.map(itemView) };
}
