import { CATEGORY_IDS, isRating, MAX_CREATOR, MAX_TITLE, STATUSES } from '../../public/js/shared/library.js';
import { findBySource, findItem, newId, parseImageUrls, parseSource, parseYear } from './state.js';

/** A rejected action. `status` is the HTTP status the API answers with. */
export class ActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ActionError';
    this.status = status;
  }
}

// ----- input helpers -----

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new ActionError(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

/** 1–5 stars, or null for no rating. */
function rating(value) {
  if (value == null) return null;
  if (!isRating(value)) throw new ActionError('rating must be a whole number from 1 to 5, or null');
  return value;
}

function getItem(state, itemId) {
  const item = findItem(state, itemId);
  if (!item) throw new ActionError(`No item ${itemId} in the library`, 404);
  return item;
}

// ----- actions -----
// Each handler changes `state` in place and may return a result for the caller.
// `ctx` is { now, allowImage(url) } — only images from the search catalog are kept.

const handlers = {
  /** Adds a search result (or a title typed by hand) as pending or done. */
  addItem(state, action, ctx) {
    const category = oneOf(action.category, CATEGORY_IDS, 'category');
    const title = text(action.title, MAX_TITLE);
    if (!title) throw new ActionError('title is required');
    const status = oneOf(action.status ?? 'pending', STATUSES, 'status');
    const source = parseSource(action.source);
    const existing = source && findBySource(state, source);
    if (existing) throw new ActionError(`"${existing.title}" is already in your library`, 409);

    const item = {
      id: newId(),
      category,
      title,
      year: parseYear(action.year),
      creator: text(action.creator, MAX_CREATOR) || null,
      source,
      imageUrls: parseImageUrls([action.coverUrl, action.thumbUrl], ctx.allowImage),
      cover: null,
      status,
      rating: status === 'done' ? rating(action.rating) : null,
      addedAt: ctx.now,
      finishedAt: status === 'done' ? ctx.now : null,
    };
    state.items.push(item);
    return { itemId: item.id };
  },

  /** Moving back to pending clears the rating: ratings belong to finished things. */
  setStatus(state, { itemId, status }, ctx) {
    const item = getItem(state, itemId);
    oneOf(status, STATUSES, 'status');
    if (item.status === status) return;
    item.status = status;
    item.finishedAt = status === 'done' ? ctx.now : null;
    item.rating = null;
  },

  rateItem(state, { itemId, rating: stars }) {
    const item = getItem(state, itemId);
    if (item.status !== 'done') throw new ActionError('Only finished items can be rated');
    item.rating = rating(stars);
  },

  removeItem(state, { itemId }) {
    getItem(state, itemId);
    state.items = state.items.filter((i) => i.id !== itemId);
  },
};

export const ACTION_TYPES = Object.freeze(Object.keys(handlers));

/**
 * Applies one action to the state (mutating it) and returns the handler's result.
 * Throws ActionError for anything invalid; the state is left unchanged in that case.
 */
export function applyAction(state, action, { now = Date.now(), allowImage = () => false } = {}) {
  if (!action || typeof action !== 'object') throw new ActionError('Action must be a JSON object');
  if (!Object.hasOwn(handlers, action.type)) throw new ActionError(`Unknown action: ${action.type}`);
  return handlers[action.type](state, action, { now, allowImage }) ?? { ok: true };
}
