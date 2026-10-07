// Manga (and manhwa, manhua), no API key needed: Kitsu. Light novels are left out: they're books.
import { volumesOr } from './mangaupdates.js';

const API = 'https://kitsu.io/api/edge';
// Kitsu's JSON:API answers only this Accept header
const ACCEPT = 'application/vnd.api+json';
const FIELDS = 'fields%5Bmanga%5D=canonicalTitle,titles,startDate,volumeCount,status,posterImage,subtype,categories,staff'
  + '&fields%5Bcategories%5D=title&fields%5BmediaStaff%5D=role,person&fields%5Bpeople%5D=name';

/** The manga in a Kitsu answer, with its categories and staff (sent alongside, by id) filled in. */
function readManga(data) {
  const included = new Map((data?.included ?? []).map((x) => [`${x.type}/${x.id}`, x]));
  const related = (manga, name) => (manga.relationships?.[name]?.data ?? []).map((r) => included.get(`${r.type}/${r.id}`)).filter(Boolean);
  return [data?.data ?? []].flat()
    .filter((manga) => manga?.attributes && manga.attributes.subtype !== 'novel')
    .map((manga) => {
      const a = manga.attributes;
      // whoever wrote it: "Story & Art" or "Story" first
      const staff = related(manga, 'staff').sort((x, y) => Number(!/story/i.test(x.attributes?.role)) - Number(!/story/i.test(y.attributes?.role)));
      const author = staff.map((s) => included.get(`people/${s.relationships?.person?.data?.id}`)?.attributes?.name).find(Boolean);
      return {
        id: manga.id,
        title: a.titles?.en || a.canonicalTitle,
        year: a.startDate,
        creator: author ?? null,
        thumbUrl: a.posterImage?.small,
        coverUrl: a.posterImage?.large ?? a.posterImage?.small,
        finishedVolumes: a.status === 'finished' ? a.volumeCount || null : null,   // its own count: only a finished one's is right
        names: [a.titles?.en, a.canonicalTitle, a.titles?.en_jp],
        genres: related(manga, 'categories').map((c) => c.attributes?.title),
      };
    });
}

export const kitsu = {
  id: 'kitsu',
  name: 'Kitsu',
  url: 'https://kitsu.app/',
  imageHosts: ['media.kitsu.app', 'media.kitsu.io'],

  /** Volumes are looked up after adding (details): a search only knows a finished one's (not kept). */
  async search(query, http) {
    const url = `${API}/manga?filter%5Btext%5D=${encodeURIComponent(query)}&page%5Blimit%5D=20&include=categories,staff.person&${FIELDS}`;
    return readManga(await http.json(url, { headers: { Accept: ACCEPT } }));
  },

  /** Volumes out so far (MangaUpdates) and genres. */
  async details(id, http) {
    const url = `${API}/manga/${encodeURIComponent(id)}?include=categories,staff.person&${FIELDS}`;
    const [manga] = readManga(await http.json(url, { headers: { Accept: ACCEPT } }));
    if (!manga) return null;
    return { volumes: await volumesOr(manga.finishedVolumes, manga.names, manga.year?.slice(0, 4), http), genres: manga.genres };
  },
};
