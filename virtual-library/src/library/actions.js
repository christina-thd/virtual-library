import { CATEGORY_IDS, isRating, LEFT_OFF, leftOffUnit, MAX_CREATOR, MAX_TITLE, statusesFor } from '../../public/js/shared/library.js';
import { ITEM_ACTIONS, latestOf, logChange } from './activity.js';
import { detailFields, findBySource, findItem, itemDetails, newId, parseCount, parseHours, parseImageUrls, parseNote, parseSource, parseYear, SETUP_STEPS } from './state.js';

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
function trackCatchUp(item, status, now, settingUp) {
  const last = item.caughtUp.at(-1);
  if (status === 'waiting') {
    const nothingNew = last && last.episodes != null && item.episodes != null && item.episodes <= last.episodes;
    if (!nothingNew) item.caughtUp.push({ at: settingUp ? null : now, episodes: item.episodes });
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
      note: null,
      leftOff: null,
      seenUpTo: null,
      ...details,                                  // what the search result had; the rest is looked up after adding
      caughtUp: category !== 'series' ? null : status === 'waiting' ? [{ at: ctx.now, episodes: details.episodes }] : [],
      detailsAt: detailFields(category).every((field) => details[field] != null) ? ctx.now : null,
      addedAt: ctx.now,
      finishedAt: status === 'done' ? ctx.now : null,
      beforeStats: status === 'done' && state.setupStep !== null,   // added while setting up: seen before
    };
    state.items.push(item);
    return { itemId: item.id };
  },

  /** Moving away from done clears the rating (ratings belong to finished things) and the dropped mark. */
  setStatus(state, { itemId, status }, ctx) {
    const item = getItem(state, itemId);
    oneOf(status, statusesFor(item.category), 'status');
    if (item.status === status) return;
    if (item.category === 'series') trackCatchUp(item, status, ctx.now, state.setupStep !== null);
    item.status = status;
    item.finishedAt = status === 'done' ? ctx.now : null;
    item.beforeStats = status === 'done' && state.setupStep !== null;
    item.rating = null;
    item.dropped = false;
    item.leftOff = null;
    if (status === 'done') item.seenUpTo = null;
  },

  /** Given up on: counts as done (can still be rated), with a mark on its cover. Undropping keeps it done. */
  setDropped(state, { itemId, dropped }, ctx) {
    const item = getItem(state, itemId);
    if (typeof dropped !== 'boolean') throw new ActionError('dropped must be true or false');
    if (dropped && item.status !== 'done') {
      item.status = 'done';
      item.finishedAt = ctx.now;
      item.beforeStats = state.setupStep !== null;
      item.rating = null;
      item.leftOff = null;
      item.seenUpTo = null;
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

  /**
   * Moves setup along: 'categories', 'library', or 'done'. What's finished while setting up was seen before
   * (beforeStats): it counts in the totals but in no month or year. Setting up again (an existing library: e.g. a
   * new category's already seen) leaves everything else as it was.
   */
  setSetup(state, { step }, ctx) {
    oneOf(step, [...SETUP_STEPS, 'done'], 'step');
    if (state.setupStep === null && step !== 'done') state.setupSince = ctx.now;
    state.setupStep = step === 'done' ? null : step;
    if (step === 'done') state.setupSince = null;
  },

  /** A note on a game you finished (what you thought of it); empty or null removes it. */
  setNote(state, { itemId, note }) {
    const item = getItem(state, itemId);
    if (item.category !== 'game') throw new ActionError('Only games have notes');
    if (item.status !== 'done') throw new ActionError('Notes are for finished games');
    if (note != null && typeof note !== 'string') throw new ActionError('note must be text, or null');
    item.note = parseNote(note);
  },

  /** Where you left off a pending book (a page) or comic (a volume); null clears it. Finishing it clears it too. */
  setLeftOff(state, { itemId, at }) {
    const item = getItem(state, itemId);
    if (!LEFT_OFF[item.category]) throw new ActionError('Only books and manga/comics keep where you left off');
    if (item.status !== 'pending') throw new ActionError('Where you left off is for pending ones');
    if (at != null && parseCount(at) == null) throw new ActionError('at must be a whole number from 1 to 99999, or null');
    // no further than it goes, when that's known
    const unit = leftOffUnit(item);
    const most = unit === 'page' ? item.pages : item.volumes;
    if (most && at > most) throw new ActionError(`"${item.title}" has ${most} ${unit}${most > 1 ? 's' : ''}`);
    item.leftOff = parseCount(at);
  },

  /** The last episode you saw of a series you haven't finished: a season and (optionally) an episode; null clears it. */
  setSeenUpTo(state, { itemId, season, episode }) {
    const item = getItem(state, itemId);
    if (item.category !== 'series') throw new ActionError('Only series keep the last episode you saw');
    if (item.status === 'done') throw new ActionError('The last episode you saw is for series not done yet');
    if (season == null) {
      item.seenUpTo = null;
      return;
    }
    if (parseCount(season) == null) throw new ActionError('season must be a whole number from 1 to 99999, or null');
    if (episode != null && parseCount(episode) == null) throw new ActionError('episode must be a whole number from 1 to 99999, or null');
    // no more than what's out: the season's episodes, or (when a catalog doesn't say) all of them
    if (item.seasons && season > item.seasons) throw new ActionError(`"${item.title}" has ${item.seasons} season${item.seasons > 1 ? 's' : ''}`);
    const most = item.seasonEpisodes?.[season - 1] ?? item.episodes;
    if (most && episode > most) {
      const which = item.seasonEpisodes?.[season - 1] ? `Season ${season} of "${item.title}"` : `"${item.title}"`;
      throw new ActionError(`${which} has ${most} episode${most > 1 ? 's' : ''}`);
    }
    item.seenUpTo = { season, episode: episode ?? null };
  },

  removeItem(state, { itemId }) {
    getItem(state, itemId);
    state.items = state.items.filter((i) => i.id !== itemId);
  },

  /**
   * Undoes a change from the recent activity: the item goes back to how it was (a removed one comes back, an added
   * one goes). An item's changes undo newest first.
   */
  undo(state, { entryId }) {
    const entry = state.activity.find((e) => e.id === entryId);
    if (!entry) throw new ActionError('That change is no longer in the recent activity', 404);
    if (entry.undone) throw new ActionError('That change is undone already');
    if (latestOf(state, entry.itemId) !== entry) throw new ActionError(`Undo the newer changes to "${entry.title}" first`);
    const current = findItem(state, entry.itemId);
    state.items = state.items.filter((i) => i.id !== entry.itemId);
    // its saved cover is kept while it's in the library; a removed one's comes again
    if (entry.before) state.items.push({ ...structuredClone(entry.before), cover: current?.cover ?? null });
    entry.undone = true;
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
  if (!ITEM_ACTIONS.has(action.type)) return handlers[action.type](state, action, { now, allowImage }) ?? { ok: true };
  // a change to an item: kept in the recent activity, with the item as it was
  const before = findItem(state, action.itemId);
  const snapshot = before ? structuredClone(before) : null;
  const result = handlers[action.type](state, action, { now, allowImage }) ?? { ok: true };
  const after = findItem(state, result.itemId ?? action.itemId);
  const activityId = logChange(state, action.type, snapshot, after ? structuredClone(after) : null, now);
  return activityId ? { ...result, activityId } : result;     // for an Undo on the screen's message
}
