/**
 * Keeps every movie's duration filled in: looks it up in the catalog it was found in (one at a time, in the
 * background), for movies added without it, including ones added before durations were kept.
 * Movies typed in by hand have no catalog entry, so they stay without one.
 */
export function createRuntimeSync({ state, catalog, onChange, logger = console }) {
  const tried = new Set();          // once per run of the add-on: a catalog that doesn't know it won't later
  let running = null;

  const nextMissing = () => state.items.find((i) => i.category === 'movie' && i.source && i.runtime == null && !tried.has(i.id));

  async function lookUpMissing() {
    for (let item = nextMissing(); item; item = nextMissing()) {
      tried.add(item.id);
      let minutes = null;
      try {
        minutes = await catalog.runtimeOf(item.category, item.source);
      } catch (err) {
        logger.warn(`Duration of "${item.title}" not found: ${err.message}`);
      }
      if (minutes && state.items.includes(item)) {    // not removed meanwhile
        item.runtime = minutes;
        onChange();
      }
    }
  }

  function sync() {
    running ??= lookUpMissing().finally(() => { running = null; });
    return running;
  }

  return { sync };
}
