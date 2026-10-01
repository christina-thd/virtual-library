// Series, no API key needed.
import { airedCounts } from './aired.js';

const API = 'https://api.tvmaze.com';
// TVmaze's own posters are either small or very large (over 1 MB), so the cover comes from
// metahub (IMDb posters, ~600 px) when the show has an IMDb id, and TVmaze's small one otherwise.
const POSTERS = 'https://images.metahub.space/poster/medium';

export const tvmaze = {
  id: 'tvmaze',
  name: 'TVmaze',
  url: 'https://www.tvmaze.com/',
  imageHosts: ['static.tvmaze.com', 'images.metahub.space'],

  async search(query, http) {
    const data = await http.json(`${API}/search/shows?q=${encodeURIComponent(query)}`);
    return (Array.isArray(data) ? data : []).map(({ show }) => ({
      id: show.id,
      title: show.name,
      year: show.premiered,
      creator: show.network?.name ?? show.webChannel?.name ?? null,
      thumbUrl: show.image?.medium,
      coverUrl: show.externals?.imdb ? `${POSTERS}/${show.externals.imdb}/img` : show.image?.medium,
    }));
  },

  /** How many seasons and episodes are out, from the show's episode list (its season list also has announced ones). */
  async details(id, http) {
    const episodes = await http.json(`${API}/shows/${encodeURIComponent(id)}/episodes`);
    return airedCounts((Array.isArray(episodes) ? episodes : []).map((e) => ({ season: e.season, date: e.airstamp ?? e.airdate })));
  },
};
