// Recent activity: the latest changes to items, newest first, each with the item as it was before, so a mistake
// (a wrong status, a removed item) can be undone. Each item's changes undo newest first.
import { leftOffUnit, STATUS_LABELS } from '../../public/js/shared/library.js';
import { newId } from './state.js';

export const MAX_ACTIVITY = 50;

/** The actions that change one item, and so are kept (settings and setup aren't). */
export const ITEM_ACTIONS = new Set(['addItem', 'setStatus', 'setDropped', 'rateItem', 'setHours', 'setNote', 'setLeftOff', 'setSeenUpTo', 'removeItem']);

/** What changed, in a few words: "Moved to Done", "Rated 4★". */
function describe(type, before, after) {
  switch (type) {
    case 'addItem': return `Added to ${STATUS_LABELS[after.status]}`;
    case 'removeItem': return 'Removed';
    case 'setStatus': return `Moved to ${STATUS_LABELS[after.status]}`;
    case 'setDropped': return after.dropped ? 'Dropped' : 'No longer dropped';
    case 'rateItem': return after.rating ? `Rated ${after.rating}★` : 'Rating cleared';
    case 'setHours': return after.hoursPlayed ? `Playtime ${after.hoursPlayed}h` : 'Playtime cleared';
    case 'setNote': return !after.note ? 'Note removed' : before.note ? 'Note changed' : 'Note added';
    case 'setLeftOff': return after.leftOff ? `Left off at ${leftOffUnit(after)} ${after.leftOff}` : 'Left off cleared';
    case 'setSeenUpTo': {
      const seen = after.seenUpTo;
      if (!seen) return 'Left off cleared';
      return `Left off at ${seen.episode ? `S${seen.season} · E${seen.episode}` : `season ${seen.season}`}`;
    }
    default: return 'Changed';
  }
}

/** Keeps a change to one item (before: null when it was added; after: null when it was removed). Nothing changed: nothing kept. */
export function logChange(state, type, before, after, now) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const item = after ?? before;
  state.activity.unshift({
    id: newId(), at: now, type, itemId: item.id, title: item.title, category: item.category,
    text: describe(type, before, after), before, undone: false,
  });
  state.activity.length = Math.min(state.activity.length, MAX_ACTIVITY);
}

/** The newest change to that item not undone yet: the only one of its changes that can be undone now. */
export const latestOf = (state, itemId) => state.activity.find((e) => e.itemId === itemId && !e.undone);

/** What the screens get: no snapshots, but whether each can be undone. */
export const activityView = (state) => state.activity.map(({ id, at, title, category, text, undone, itemId }, index) => ({
  id, at, title, category, text, undone, canUndo: !undone && latestOf(state, itemId) === state.activity[index],
}));
