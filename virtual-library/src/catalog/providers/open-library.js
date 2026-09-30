// Books, no API key needed.
const API = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org/b/id';

export const openLibrary = {
  id: 'openlibrary',
  name: 'Open Library',
  url: 'https://openlibrary.org/',
  imageHosts: ['covers.openlibrary.org'],

  async search(query, http) {
    const fields = 'key,title,author_name,first_publish_year,cover_i';
    const data = await http.json(`${API}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=${fields}`);
    return (data.docs ?? []).map((book) => ({
      id: book.key,                                   // "/works/OL27482W"
      title: book.title,
      year: book.first_publish_year,
      creator: book.author_name?.[0] ?? null,
      thumbUrl: book.cover_i ? `${COVERS}/${book.cover_i}-M.jpg` : null,
      coverUrl: book.cover_i ? `${COVERS}/${book.cover_i}-L.jpg` : null,
    }));
  },
};
