// Movies and series, no API key needed. Cinemeta is the public catalog behind Stremio (IMDb data).
import { airedCounts } from './aired.js';

const API = 'https://v3-cinemeta.strem.io';

/** Posters come small; both image hosts serve bigger versions from a predictable URL. */
function largerPoster(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;
  return url
    .replace('/poster/small/', '/poster/medium/')
    .replace(/\._V1_[^/]*\.jpg$/, '._V1_SX600.jpg');
}

/** @param {'movie' | 'series'} type */
export function createCinemeta(type) {
  const provider = {
    id: 'cinemeta',
    name: 'Cinemeta',
    url: 'https://www.stremio.com/',
    imageHosts: ['images.metahub.space', 'm.media-amazon.com'],

    async search(query, http) {
      const data = await http.json(`${API}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`);
      return (data.metas ?? []).map((m) => ({
        id: m.imdb_id ?? m.id,
        title: m.name,
        year: m.releaseInfo ?? m.year,
        creator: Array.isArray(m.director) ? m.director[0] : null,
        thumbUrl: m.poster,
        coverUrl: largerPoster(m.poster),
        runtime: m.runtime,                          // "155 min", only sometimes in search results
        genres: m.genres ?? m.genre,                 // the same: only sometimes
      }));
    },
  };
  /** From the full entry: how long a movie is ("155 min"); how many seasons and episodes of a series are out. */
  provider.details = async (id, http) => {
    const { meta } = await http.json(`${API}/meta/${type}/${encodeURIComponent(id)}.json`);
    const genres = meta?.genres ?? meta?.genre ?? [];
    return type === 'movie'
      ? { runtime: meta?.runtime, genres }
      : { ...airedCounts((meta?.videos ?? []).map((v) => ({ season: v.season, date: v.released ?? v.firstAired }))), genres };
  };
  return provider;
}
