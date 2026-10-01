// Movies and series, no API key needed. Cinemeta is the public catalog behind Stremio (IMDb data).
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
      }));
    },
  };
  if (type === 'movie') {
    /** How long the movie is, e.g. "155 min" (the full entry always has it). */
    provider.runtime = async (id, http) => (await http.json(`${API}/meta/movie/${encodeURIComponent(id)}.json`)).meta?.runtime ?? null;
  }
  return provider;
}
