// Games, no API key needed. Only PC games (what's on Steam); set a RAWG key for every platform.
const API = 'https://store.steampowered.com/api';
const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

export const steam = {
  id: 'steam',
  name: 'Steam',
  url: 'https://store.steampowered.com/',
  imageHosts: ['shared.akamai.steamstatic.com'],

  async search(query, http) {
    const data = await http.json(`${API}/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=english`);
    return (data.items ?? [])
      .filter((game) => game.type === 'app')
      .map((game) => ({
        id: game.id,
        title: game.name,
        year: null,                                  // not in search results
        creator: null,
        coverUrl: `${ASSETS}/${game.id}/library_600x900.jpg`,   // portrait box art
      }));
  },
};
