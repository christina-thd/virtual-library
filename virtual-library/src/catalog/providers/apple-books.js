// Books, no API key needed: the Apple Books store (iTunes Search API). Finds books Open Library doesn't.
const API = 'https://itunes.apple.com/search';

/** Artwork URLs end in the size they're served at ("…/100x100bb.jpg"); any size can be asked for. */
const sized = (url, size) => (typeof url === 'string' ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}bb.$1`) : null);

export const appleBooks = {
  id: 'applebooks',
  name: 'Apple Books',
  url: 'https://www.apple.com/apple-books/',
  imageHosts: ['is1-ssl.mzstatic.com', 'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com', 'is4-ssl.mzstatic.com', 'is5-ssl.mzstatic.com'],

  async search(query, http) {
    const data = await http.json(`${API}?term=${encodeURIComponent(query)}&media=ebook&entity=ebook&country=US&limit=20`);
    return (data.results ?? []).map((book) => ({
      id: book.trackId,
      title: book.trackName,
      year: book.releaseDate,
      creator: book.artistName,
      thumbUrl: sized(book.artworkUrl100, '200x300'),
      coverUrl: sized(book.artworkUrl100, '600x900'),
      genres: book.genres ?? [],                     // store sections ("Fantasy", "Books"…): sorted out in genres.js
    }));
  },
};
