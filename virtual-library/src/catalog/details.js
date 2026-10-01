const WEEK = 7 * 24 * 60 * 60 * 1000;

/** What's looked up per category: how long a movie is; how many seasons and episodes a series has (so far). */
export const DETAIL_FIELDS = Object.freeze({ movie: ['runtime'], series: ['seasons', 'episodes'] });

/**
 * Keeps items' details filled in: looks them up in the catalog each item was found in (one at a time, in the
 * background), for items added without them, including ones added before details were kept. A series you
 * haven't finished is looked up again once a week, as new episodes come out. Items typed in by hand have no
 * catalog entry, so they stay without.
 */
export function createDetailsSync({ state, catalog, onChange, now = Date.now, logger = console }) {
  const tried = new Set();          // once per run of the add-on: a catalog that fails or doesn't know won't soon
  let running = null;

  function needsLookUp(item) {
    if (!item.source || !DETAIL_FIELDS[item.category] || tried.has(item.id)) return false;
    if (item.detailsAt == null) return true;
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
      for (const field of DETAIL_FIELDS[item.category]) item[field] = details?.[field] ?? item[field] ?? null;
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
