import { CATEGORY_IDS, isRating, MAX_CREATOR, MAX_TITLE, statusesFor } from '../../public/js/shared/library.js';
import { detailFields, findBySource, findItem, itemDetails, newId, parseHours, parseImageUrls, parseSource, parseYear } from './state.js';

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

const UNDO = 24 * 60 * 60 * 1000;

/**
 * A series moved to Waiting has seen every episode out: that's kept, dated, for the stats. Moved back to pending
 * within a day, it was a mistake and is forgotten; later, it's a new season and the catch-up stays.
 */
function trackCatchUp(item, status, now) {
  const last = item.caughtUp.at(-1);
  if (status === 'waiting') {
    const nothingNew = last && last.episodes != null && item.episodes != null && item.episodes <= last.episodes;
    if (!nothingNew) item.caughtUp.push({ at: now, episodes: item.episodes });
  } else if (status === 'pending' && item.status === 'waiting' && last?.at != null && now - last.at < UNDO) {
    item.caughtUp.pop();
  }
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
  /** Adds a search result (or a title typed by hand) as pending, done, or (series) waiting. */
  addItem(state, action, ctx) {
    const category = oneOf(action.category, CATEGORY_IDS, 'category');
    const title = text(action.title, MAX_TITLE);
    if (!title) throw new ActionError('title is required');
    const status = oneOf(action.status ?? 'pending', statusesFor(category), 'status');
    const source = parseSource(action.source);
    const existing = source && findBySource(state, source);
    if (existing) throw new ActionError(`"${existing.title}" is already in your library`, 409);
    const details = itemDetails(category, action);

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
      dropped: false,
      hoursPlayed: null,
      ...details,                                  // what the search result had; the rest is looked up after adding
      caughtUp: category !== 'series' ? null : status === 'waiting' ? [{ at: ctx.now, episodes: details.episodes }] : [],
      detailsAt: detailFields(category).every((field) => details[field] != null) ? ctx.now : null,
      addedAt: ctx.now,
      finishedAt: status === 'done' ? ctx.now : null,
    };
    state.items.push(item);
    return { itemId: item.id };
  },

  /** Moving away from done clears the rating (ratings belong to finished things) and the dropped mark. */
  setStatus(state, { itemId, status }, ctx) {
    const item = getItem(state, itemId);
    oneOf(status, statusesFor(item.category), 'status');
    if (item.status === status) return;
    if (item.category === 'series') trackCatchUp(item, status, ctx.now);
    item.status = status;
    item.finishedAt = status === 'done' ? ctx.now : null;
    item.rating = null;
    item.dropped = false;
  },

  /** Given up on: counts as done (can still be rated), with a mark on its cover. Undropping keeps it done. */
  setDropped(state, { itemId, dropped }, ctx) {
    const item = getItem(state, itemId);
    if (typeof dropped !== 'boolean') throw new ActionError('dropped must be true or false');
    if (dropped && item.status !== 'done') {
      item.status = 'done';
      item.finishedAt = ctx.now;
      item.rating = null;
    }
    item.dropped = dropped;
  },

  rateItem(state, { itemId, rating: stars }) {
    const item = getItem(state, itemId);
    if (item.status !== 'done') throw new ActionError('Only finished items can be rated');
    item.rating = rating(stars);
  },

  /** How long you played a game you finished, in hours (half hours are fine); null clears it. */
  setHours(state, { itemId, hours }) {
    const item = getItem(state, itemId);
    if (item.category !== 'game') throw new ActionError('Only games have hours played');
    if (item.status !== 'done') throw new ActionError('Hours played are for finished games');
    if (hours != null && parseHours(hours) == null) throw new ActionError('hours must be a number from 0.1 to 100000, or null');
    item.hoursPlayed = parseHours(hours);
  },

  /** Hides a kind from the home screen, stats and search, or shows it again. Its items are kept. One stays shown. */
  setCategoryHidden(state, { category, hidden }) {
    oneOf(category, CATEGORY_IDS, 'category');
    if (typeof hidden !== 'boolean') throw new ActionError('hidden must be true or false');
    const others = state.hiddenCategories.filter((id) => id !== category);
    if (hidden && others.length === CATEGORY_IDS.length - 1) throw new ActionError('Keep at least one category shown');
    state.hiddenCategories = hidden ? [...others, category] : others;
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
