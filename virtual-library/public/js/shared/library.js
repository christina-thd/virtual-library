// Library rules shared by the server and the browser.

export const CATEGORIES = Object.freeze([
  { id: 'movie', label: 'Movie', plural: 'Movies' },
  { id: 'series', label: 'Series', plural: 'Series' },
  { id: 'book', label: 'Book', plural: 'Books' },
  { id: 'game', label: 'Game', plural: 'Games' },
]);
export const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));

/** Pending: not seen / not finished yet. Done: seen, read or played. */
export const STATUSES = Object.freeze(['pending', 'done']);

export const MAX_RATING = 5;
export const MAX_TITLE = 150;
export const MAX_CREATOR = 100;
export const MAX_QUERY = 100;

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id);

/** A rating is a whole number of stars, 1–5. No rating is `null`. */
export const isRating = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_RATING;

/** Same catalog entry (e.g. TVmaze show 17861), so it isn't added twice. */
export const sameSource = (a, b) => Boolean(a && b && a.provider === b.provider && a.id === b.id);
