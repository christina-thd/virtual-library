// Games, no API key needed. Only PC games (what's on Steam); set a RAWG key for every platform.
const STORE = 'https://store.steampowered.com/api';
const WEB_API = 'https://api.steampowered.com';
const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets';
// the asset list only improves some covers: when it's slow, the results go out with the classic addresses
const PORTRAITS_TIMEOUT_MS = 2500;

/**
 * Portrait box art for each app. Newer games keep their images under hashed folders, so the
 * address can't be guessed; the store API lists them (one request for all the results).
 * Returns appid → URL; an app it doesn't list gets the classic address (older games have it).
 */
async function portraits(appIds, http) {
  const input = {
    ids: appIds.map((appid) => ({ appid })),
    context: { language: 'english', country_code: 'US' },
    data_request: { include_assets: true },
  };
  const found = new Map();
  try {
    const data = await http.json(`${WEB_API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`, { timeoutMs: PORTRAITS_TIMEOUT_MS });
    for (const item of data.response?.store_items ?? []) {
      const { asset_url_format: format, library_capsule: file } = item.assets ?? {};
      if (format && file) found.set(item.appid, `${ASSETS}/${format.replace('${FILENAME}', file)}`);
    }
  } catch {
    // no asset list: the classic addresses below still work for most games
  }
  return (appid) => found.get(appid) ?? `${ASSETS}/steam/apps/${appid}/library_600x900.jpg`;
}

export const steam = {
  id: 'steam',
  name: 'Steam',
  url: 'https://store.steampowered.com/',
  imageHosts: ['shared.akamai.steamstatic.com'],

  async search(query, http) {
    const data = await http.json(`${STORE}/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=english`);
    const games = (data.items ?? []).filter((game) => game.type === 'app');
    const portraitOf = games.length ? await portraits(games.map((g) => g.id), http) : null;
    return games.map((game) => ({
      id: game.id,
      title: game.name,
      year: null,                                  // not in search results
      creator: null,
      coverUrl: portraitOf(game.id),
    }));
  },
};
