// Nintendo games (Switch, 3DS, Wii U, Wii and the classics), no API key needed: the search behind
// Nintendo of Europe's store.
const API = 'https://searching.nintendo-europe.com/en/select';

export const nintendo = {
  id: 'nintendo',
  name: 'Nintendo',
  url: 'https://www.nintendo.com/',
  imageHosts: ['www.nintendo.com'],

  async search(query, http) {
    const data = await http.json(`${API}?q=${encodeURIComponent(query)}&fq=type:GAME&rows=20&wt=json`);
    return (data.response?.docs ?? []).map((game) => ({
      id: game.fs_id,
      title: game.title,
      year: game.dates_released_dts?.[0] ?? game.date_from,
      creator: Array.isArray(game.system_names_txt) ? game.system_names_txt.slice(0, 3).join(', ') : null,
      thumbUrl: game.image_url_sq_s,
      coverUrl: game.image_url ?? game.image_url_sq_s,   // the box art; the square picture when there's none
    }));
  },
};
