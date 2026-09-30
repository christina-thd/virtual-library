// Movies or series from TMDB, when a TMDB API key is set. Better search and posters than the keyless catalogs.
const API = 'https://api.themoviedb.org/3';
const IMAGES = 'https://image.tmdb.org/t/p';

const KINDS = {
  movie: { path: 'search/movie', title: 'title', date: 'release_date' },
  series: { path: 'search/tv', title: 'name', date: 'first_air_date' },
};

/**
 * TMDB gives out two kinds of keys: a short "API key" (v3, sent as a query parameter)
 * and a long "read access token" (sent as a Bearer header). Either works.
 */
function authenticate(apiKey) {
  return apiKey.length > 40
    ? { query: '', headers: { Authorization: `Bearer ${apiKey}` } }
    : { query: `&api_key=${encodeURIComponent(apiKey)}`, headers: {} };
}

/** @param {'movie' | 'series'} category */
export function createTmdb(category, apiKey) {
  const kind = KINDS[category];
  const auth = authenticate(apiKey);
  return {
    id: 'tmdb',
    name: 'TMDB',
    url: 'https://www.themoviedb.org/',
    imageHosts: ['image.tmdb.org'],

    async search(query, http) {
      const url = `${API}/${kind.path}?query=${encodeURIComponent(query)}&include_adult=false${auth.query}`;
      const data = await http.json(url, { headers: auth.headers });
      return (data.results ?? []).map((r) => ({
        id: r.id,
        title: r[kind.title],
        year: r[kind.date],
        creator: null,                               // not in search results
        thumbUrl: r.poster_path ? `${IMAGES}/w185${r.poster_path}` : null,
        coverUrl: r.poster_path ? `${IMAGES}/w500${r.poster_path}` : null,
      }));
    },
  };
}
