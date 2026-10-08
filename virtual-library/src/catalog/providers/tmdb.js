// Movies or series from TMDB, when a TMDB API key is set. Better search and posters than the keyless catalogs.
const API = 'https://api.themoviedb.org/3';
const IMAGES = 'https://image.tmdb.org/t/p';

/** TMDB's genre ids (search results only have the ids; the list is fixed): movies and TV share some. */
const GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

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
  const provider = {
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
        genres: Array.isArray(r.genre_ids) ? r.genre_ids.map((id) => GENRES[id]).filter(Boolean) : undefined,
      }));
    },
  };
  /** From the movie's or show's own page (search results don't have these): minutes; seasons, episodes and an episode's minutes. */
  provider.details = async (id, http) => {
    const path = category === 'movie' ? 'movie' : 'tv';
    const data = await http.json(`${API}/${path}/${encodeURIComponent(id)}?language=en-US${auth.query}`, { headers: auth.headers });
    const genres = data.genres ?? [];
    return category === 'movie'
      ? { runtime: data.runtime, genres }
      : {
        seasons: data.number_of_seasons,
        episodes: data.number_of_episodes,
        runtime: data.episode_run_time?.[0] ?? data.last_episode_to_air?.runtime ?? null,
        genres,
      };
  };
  return provider;
}
