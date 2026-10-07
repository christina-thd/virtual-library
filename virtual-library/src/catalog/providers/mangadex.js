// Manga, manhwa and manhua, no API key needed: MangaDex. Fan-made doujinshi are left out.
import { volumesOr } from './mangaupdates.js';

const API = 'https://api.mangadex.org';
const COVERS = 'https://uploads.mangadex.org/covers';
const INCLUDES = 'includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive';

const tagNames = (manga, group) => (manga.attributes.tags ?? [])
  .filter((t) => t.attributes?.group === group).map((t) => t.attributes?.name?.en).filter(Boolean);

function readManga(manga) {
  const a = manga.attributes;
  const related = (type) => (manga.relationships ?? []).find((r) => r.type === type)?.attributes;
  const cover = related('cover_art')?.fileName;
  const finished = a.status === 'completed' ? Number.parseInt(a.lastVolume, 10) : NaN;   // its own count: once it's finished
  return {
    id: manga.id,
    title: a.title?.en ?? a.altTitles?.find((t) => t.en)?.en ?? Object.values(a.title ?? {})[0],
    year: a.year,
    creator: related('author')?.name ?? null,
    thumbUrl: cover ? `${COVERS}/${manga.id}/${cover}.256.jpg` : null,
    coverUrl: cover ? `${COVERS}/${manga.id}/${cover}.512.jpg` : null,
    finishedVolumes: finished > 0 ? finished : null,
    names: [a.title?.en, ...(a.altTitles ?? []).map((t) => t.en), ...Object.values(a.title ?? {})],
    genres: tagNames(manga, 'genre'),
  };
}

const isDoujinshi = (manga) => tagNames(manga, 'format').includes('Doujinshi');

export const mangaDex = {
  id: 'mangadex',
  name: 'MangaDex',
  url: 'https://mangadex.org/',
  imageHosts: ['uploads.mangadex.org'],

  async search(query, http) {
    const data = await http.json(`${API}/manga?title=${encodeURIComponent(query)}&limit=20&order[relevance]=desc&${INCLUDES}`);
    return (data?.data ?? []).filter((m) => m?.attributes && !isDoujinshi(m)).map(readManga);
  },

  /** Volumes out so far (MangaUpdates) and genres. */
  async details(id, http) {
    const data = await http.json(`${API}/manga/${encodeURIComponent(id)}?${INCLUDES}`);
    if (!data?.data?.attributes) return null;
    const { finishedVolumes, names, year, genres } = readManga(data.data);
    return { volumes: await volumesOr(finishedVolumes, names.slice(0, 3), year, http), genres };
  },
};
