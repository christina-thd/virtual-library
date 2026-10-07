// Library rules shared by the server and the browser.

/**
 * An item as the screens get it (src/library/state.js has the saved form, and why each field is there).
 * @typedef {object} Item
 * @property {string} id
 * @property {string} category                       'movie' | 'series' | 'book' | 'game'
 * @property {string} title
 * @property {number | null} year
 * @property {string | null} creator
 * @property {{ provider: string, id: string } | null} source   null: typed in by hand
 * @property {string | null} image
 * @property {'pending' | 'waiting' | 'done'} status
 * @property {number | null} rating                  1–5, finished items only
 * @property {boolean} dropped                       done, but given up on
 * @property {number | null} hoursPlayed             games
 * @property {number | null} runtime                 movies, minutes
 * @property {number | null} seasons                 series
 * @property {number | null} episodes                series
 * @property {{ at: number | null, episodes: number | null }[] | null} caughtUp   series: each move to Waiting, with the episodes out then
 * @property {number | null} pages                   books
 * @property {string[] | null} genres                null: not looked up yet
 * @property {number} addedAt                        ms
 * @property {number | null} finishedAt              ms
 */

export const CATEGORIES = Object.freeze([
  { id: 'movie', label: 'Movie', plural: 'Movies' },
  { id: 'series', label: 'Series', plural: 'Series' },
  { id: 'book', label: 'Book', plural: 'Books' },
  { id: 'game', label: 'Game', plural: 'Games' },
]);
export const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));

/**
 * Pending: not seen / not finished yet. Done: seen, read or played.
 * Waiting (series only): seen everything that's out, waiting for a new season.
 */
export const STATUSES = Object.freeze(['pending', 'waiting', 'done']);
export const STATUS_LABELS = Object.freeze({ pending: 'Pending', waiting: 'Waiting', done: 'Done' });

const SERIES_STATUSES = STATUSES;
const OTHER_STATUSES = Object.freeze(['pending', 'done']);
/** The statuses a category uses, in tab order. */
export const statusesFor = (category) => (category === 'series' ? SERIES_STATUSES : OTHER_STATUSES);

export const MAX_RATING = 5;
export const MAX_TITLE = 150;
export const MAX_CREATOR = 100;
export const MAX_QUERY = 100;

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id);

/** A rating is a whole number of stars, 1–5. No rating is `null`. */
export const isRating = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_RATING;

/** Same catalog entry (e.g. TVmaze show 17861), so it isn't added twice. */
export const sameSource = (a, b) => Boolean(a && b && a.provider === b.provider && a.id === b.id);
