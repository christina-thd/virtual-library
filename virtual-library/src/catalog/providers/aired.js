/**
 * How many seasons and episodes of a series are out already, from a catalog's episode list
 * ([{ season, date, runtime? }]): announced episodes and seasons don't count yet, and neither do specials (season 0).
 * `runtime`: how long an episode is, in minutes, on average (of those whose length is known), or null.
 */
export function airedCounts(list, now = Date.now()) {
  const aired = (Array.isArray(list) ? list : []).filter((e) => e.season > 0 && e.date && Date.parse(e.date) <= now);
  const lengths = aired.map((e) => e.runtime).filter((m) => Number.isFinite(m) && m > 0);
  return {
    seasons: new Set(aired.map((e) => e.season)).size,
    episodes: aired.length,
    runtime: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : null,
  };
}
