import { detailFields } from '../library/state.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Keeps items' details (runtime, seasons and episodes, pages, genres) filled in from the catalog each was found
 * in: in the background, one at a time, also for items from before a detail was kept. A series not finished yet
 * is looked up again weekly, as episodes come out. Items typed in by hand have no catalog entry.
 * @param {{ state: any, catalog: any, onChange: () => void, now?: () => number, logger?: Pick<Console, 'warn'> }} options
 */
export function createDetailsSync({ state, catalog, onChange, now = Date.now, logger = console }) {
  const tried = new Set();          // once per run of the add-on: a catalog that fails or doesn't know won't soon
  let running = null;

  function needsLookUp(item) {
    if (!item.source || !detailFields(item.category).length || tried.has(item.id)) return false;
    if (item.detailsAt == null || item.genres == null) return true;     // genres: looked up before they were kept
    return item.category === 'series' && item.status !== 'done' && now() - item.detailsAt > WEEK;
  }

  async function lookUpMissing() {
    for (let item = state.items.find(needsLookUp); item; item = state.items.find(needsLookUp)) {
      tried.add(item.id);
      let details;
      try {
        details = await catalog.detailsOf(item.category, item.source);
      } catch (err) {
        logger.warn(`Details of "${item.title}" not found: ${err.message}`);
        continue;                                      // tried again when the add-on restarts
      }
      if (!state.items.includes(item)) continue;       // removed meanwhile
      for (const field of detailFields(item.category)) item[field] = details?.[field] ?? item[field] ?? null;
      item.genres ??= [];                              // looked up: none known (not "not looked up yet")
      item.detailsAt = now();
      onChange();
    }
  }

  function sync() {
    running ??= lookUpMissing().finally(() => { running = null; });
    return running;
  }

  return { sync };
}
