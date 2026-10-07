// How many volumes of a manga are out: MangaUpdates, no API key needed. Kitsu's counts go stale (Chainsaw Man:
// 11, only part 1) and MangaDex only has one once a series ends; MangaUpdates keeps count of ongoing ones too.
const API = 'https://api.mangaupdates.com/v1';
const NOT_MANGA = ['Doujinshi', 'Novel'];

/** "24 Volumes (Complete)\n\nPart 1: 11 Volumes…" → 24: the first count is the whole series. */
export function parseVolumes(status) {
  const match = /(\d+)\s+volumes?\b/i.exec(typeof status === 'string' ? status : '');
  return match ? Number(match[1]) : null;
}

/**
 * The volumes out of the manga with this title (the one from that year, when there are several), or null.
 * @param {string[]} titles  its names, best first: each is searched until one is found
 */
export async function volumesOf(titles, year, http) {
  for (const title of new Set(titles.filter(Boolean))) {
    const found = await http.json(`${API}/series/search`, { body: { search: title, perpage: 5 } });
    const records = (found?.results ?? []).map((r) => r.record).filter((r) => r && !NOT_MANGA.includes(r.type));
    const record = records.find((r) => year && Number(r.year) === Number(year)) ?? records[0];
    if (!record) continue;
    const series = await http.json(`${API}/series/${encodeURIComponent(record.series_id)}`);
    return parseVolumes(series?.status);
  }
  return null;
}

/** Volumes from MangaUpdates; the catalog's own count (`fallback`) when it doesn't answer or doesn't know. */
export async function volumesOr(fallback, titles, year, http) {
  try {
    return (await volumesOf(titles, year, http)) ?? fallback;
  } catch {
    return fallback;
  }
}
