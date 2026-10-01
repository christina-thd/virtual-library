// Games, no API key needed: the GOG store. PC games too, but it has classics and DRM-free games Steam doesn't.
const API = 'https://catalog.gog.com/v1/catalog';

export const gog = {
  id: 'gog',
  name: 'GOG',
  url: 'https://www.gog.com/',
  imageHosts: ['images.gog-statics.com'],

  async search(query, http) {
    const data = await http.json(`${API}?query=like:${encodeURIComponent(query)}&order=desc:score&productType=in:game&limit=20`);
    return (data.products ?? []).map((game) => ({
      id: game.id,
      title: game.title,
      year: game.releaseDate,                        // "2015.05.18"
      creator: Array.isArray(game.developers) ? game.developers[0] : null,
      coverUrl: game.coverVertical,
    }));
  },
};
