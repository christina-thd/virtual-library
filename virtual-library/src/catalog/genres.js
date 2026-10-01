// Genres from the catalogs, made comparable: each catalog names them its own way ("Science-Fiction", "Sci-Fi",
// "Science Fiction"), and book catalogs mix them with subjects ("hobbits", "Media Tie-In"). Used for the stats.

const MAX_GENRES = 3;

/** Same genre, different names: lower-case name → the one used. Some names are two genres. */
const ALIASES = {
  'science-fiction': ['Sci-Fi'], 'science fiction': ['Sci-Fi'], 'sci-fi': ['Sci-Fi'], 'scifi': ['Sci-Fi'],
  'sci-fi & fantasy': ['Sci-Fi', 'Fantasy'], 'action & adventure': ['Action', 'Adventure'], 'war & politics': ['War', 'Politics'],
  'role-playing': ['RPG'], 'role-playing games (rpg)': ['RPG'], 'role playing': ['RPG'], 'rpg': ['RPG'],
  'massively multiplayer': ['MMO'], 'strategy': ['Strategy'], 'simulation': ['Simulation'], 'shooter': ['Shooter'],
  'fighting': ['Fighting'], 'platformer': ['Platformer'], 'platform': ['Platformer'], 'puzzle': ['Puzzle'],
  'racing': ['Racing'], 'sports': ['Sports'], 'sport': ['Sports'], 'arcade': ['Arcade'], 'casual': ['Casual'],
  'indie': ['Indie'], 'music': ['Music'], 'party': ['Party'], 'family': ['Family'], 'kids': ['Kids'],
  'animation': ['Animation'], 'anime': ['Anime'], 'documentary': ['Documentary'], 'reality': ['Reality'],
  'talk show': ['Talk Show'], 'talk': ['Talk Show'], 'news': ['News'], 'soap': ['Soap'], 'tv movie': ['TV Movie'],
  'game-show': ['Game Show'], 'game show': ['Game Show'], 'film-noir': ['Film Noir'], 'musical': ['Musical'],
};

/**
 * Books: the genres picked out of a catalog's subjects, by what the subject says. Earlier subjects matter more.
 * @type {Array<[string, RegExp]>}
 */
const BOOK_GENRES = [
  ['Sci-Fi', /science fiction|sci-fi/i],
  ['Fantasy', /fantasy/i],
  ['Mystery', /mystery|detective|crime/i],
  ['Thriller', /thriller|suspense/i],
  ['Horror', /horror/i],
  ['Romance', /romance|love stories/i],
  ['Historical Fiction', /historical fiction/i],
  ['Young Adult', /young adult/i],
  ["Children's", /children|juvenile|for kids/i],
  ['Classics', /^classics?$|classic literature/i],
  ['Biography', /biography|memoir|autobiograph/i],
  ['History', /^history$|^world history|^history,/i],
  ['Science', /^science$|popular science|physics|astronomy/i],
  ['Self-Help', /self-help|self help|personal growth|self-improvement/i],
  ['Philosophy', /philosophy/i],
  ['Poetry', /poetry/i],
  ['Comics', /comic|graphic novel|manga/i],
  ['Humor', /humou?r/i],
  ['Business', /business|economics/i],
];

const titleCase = (name) => name.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

/** Up to three genres, named the same way whichever catalog they came from; [] when it has none. */
export function cleanGenres(category, list) {
  const names = (Array.isArray(list) ? list : [])
    .map((g) => (typeof g === 'string' ? g : g?.name ?? g?.description))
    .filter((g) => typeof g === 'string' && g.trim())
    .map((g) => g.trim());
  const found = category === 'book'
    ? names.flatMap((subject) => BOOK_GENRES.filter(([, test]) => test.test(subject)).map(([genre]) => genre))
    : names.flatMap((name) => ALIASES[name.toLowerCase()] ?? [titleCase(name.toLowerCase())]);
  return [...new Set(found)].filter((g) => g.length <= 30).slice(0, MAX_GENRES);
}
