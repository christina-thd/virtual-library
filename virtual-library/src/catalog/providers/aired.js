/**
 * How many seasons and episodes of a series are out already, from a catalog's episode list
 * ([{ season, date }]): announced episodes and seasons don't count yet, and neither do specials (season 0).
 */
export function airedCounts(list, now = Date.now()) {
  const aired = (Array.isArray(list) ? list : []).filter((e) => e.season > 0 && e.date && Date.parse(e.date) <= now);
  return { seasons: new Set(aired.map((e) => e.season)).size, episodes: aired.length };
}
