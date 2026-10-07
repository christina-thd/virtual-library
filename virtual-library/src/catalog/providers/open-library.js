// Books, and comics and graphic novels, no API key needed.
const API = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org/b/id';

export const openLibrary = {
  id: 'openlibrary',
  name: 'Open Library',
  url: 'https://openlibrary.org/',
  imageHosts: ['covers.openlibrary.org'],

  async search(query, http) {
    const fields = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median';
    const data = await http.json(`${API}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=${fields}`);
    return (data.docs ?? []).map((book) => ({
      id: book.key,                                   // "/works/OL27482W"
      title: book.title,
      year: book.first_publish_year,
      creator: book.author_name?.[0] ?? null,
      thumbUrl: book.cover_i ? `${COVERS}/${book.cover_i}-M.jpg` : null,
      coverUrl: book.cover_i ? `${COVERS}/${book.cover_i}-L.jpg` : null,
      pages: book.number_of_pages_median,             // the typical length across its editions
    }));
  },

  /** Pages (for books added before they were kept) and subjects, which the genres are picked out of. */
  async details(id, http) {
    const data = await http.json(`${API}/search.json?q=${encodeURIComponent(`key:"${id}"`)}&fields=key,number_of_pages_median,subject`);
    const book = data.docs?.[0];
    return { pages: book?.number_of_pages_median, genres: book?.subject ?? [] };
  },
};

/** Comics: only works filed under comics or graphic novels. Each is one book, so one volume. */
const COMICS = 'subject:(comics OR "graphic novels" OR "comic books, strips, etc")';

/**
 * Comics publishers, by the names their editions (and sometimes "authors") go by. Others count as "Other".
 * @type {Array<[string, RegExp]>}
 */
const PUBLISHERS = [
  ['Marvel', /marvel/i],
  ['DC', /\bd\.?c\.?\b|vertigo|wildstorm/i],
  ['Image', /image comics/i],
  ['Dark Horse', /dark horse/i],
  ['IDW', /\bidw\b/i],
  ['BOOM! Studios', /boom!? (studios|entertainment)/i],
  ['Dynamite', /dynamite/i],
  ['Valiant', /valiant/i],
  ['Archie', /archie comic/i],
  ['Oni Press', /oni press/i],
  ['Fantagraphics', /fantagraphics/i],
  ['Drawn & Quarterly', /drawn (&|and) quarterly/i],
  ['Top Shelf', /top shelf/i],
  ['Dargaud', /dargaud/i],
  ['Casterman', /casterman/i],
  ['Dupuis', /dupuis/i],
];

/**
 * Its publisher: the known one its editions name most (Watchmen has Panini, Titan and IDW editions, but mostly DC),
 * or null.
 * @param {unknown[]} names  the editions' publishers, and its authors (where "DC Comics" sometimes shows up)
 */
export function pickPublisher(names) {
  const counts = PUBLISHERS.map(([name, test]) => [name, names.filter((n) => typeof n === 'string' && test.test(n)).length]);
  const [name, count] = counts.reduce((best, entry) => (entry[1] > best[1] ? entry : best), [null, 0]);
  return count ? name : null;
}

const publisherOf = (comic) => pickPublisher([...(comic?.publisher ?? []), ...(comic?.author_name ?? [])]);

export const openLibraryComics = {
  ...openLibrary,
  async search(query, http) {
    const fields = 'key,title,author_name,first_publish_year,cover_i,publisher';
    const data = await http.json(`${API}/search.json?q=${encodeURIComponent(`${query} ${COMICS}`)}&limit=20&fields=${fields}`);
    return (data.docs ?? []).map((comic) => ({
      id: comic.key,
      title: comic.title,
      year: comic.first_publish_year,
      creator: comic.author_name?.[0] ?? null,
      thumbUrl: comic.cover_i ? `${COVERS}/${comic.cover_i}-M.jpg` : null,
      coverUrl: comic.cover_i ? `${COVERS}/${comic.cover_i}-L.jpg` : null,
      volumes: 1,
      publisher: publisherOf(comic),
    }));
  },

  /** Subjects (for the genres) and the publisher. */
  async details(id, http) {
    const data = await http.json(`${API}/search.json?q=${encodeURIComponent(`key:"${id}"`)}&fields=key,subject,publisher,author_name`);
    const comic = data.docs?.[0];
    return { volumes: 1, genres: comic?.subject ?? [], publisher: publisherOf(comic) };
  },
};
