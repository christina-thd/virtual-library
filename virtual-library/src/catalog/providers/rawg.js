// Games on every platform, when a RAWG API key is set.
const API = 'https://api.rawg.io/api';

/** RAWG images are wide screenshots; its image server crops them, here to a portrait 2:3. */
function portrait(url) {
  if (typeof url !== 'string' || !url.startsWith('https://media.rawg.io/media/')) return null;
  return url.replace('/media/games/', '/media/crop/600/900/games/');
}

export function createRawg(apiKey) {
  return {
    id: 'rawg',
    name: 'RAWG',
    url: 'https://rawg.io/',
    imageHosts: ['media.rawg.io'],

    async search(query, http) {
      const url = `${API}/games?search=${encodeURIComponent(query)}&page_size=20&key=${encodeURIComponent(apiKey)}`;
      const data = await http.json(url);
      return (data.results ?? []).map((game) => ({
        id: game.id,
        title: game.name,
        year: game.released,
        creator: game.platforms?.map((p) => p.platform?.name).filter(Boolean).slice(0, 3).join(', ') || null,
        coverUrl: portrait(game.background_image),
      }));
    },
  };
}
