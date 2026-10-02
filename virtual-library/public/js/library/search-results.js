// What the search sheet shows below the field: the results (each with Pending / Done, or a mark when it's
// already in the library), adding a title by hand, and the idle, loading and error messages.
// search.js decides what to search and when; this draws the outcome.
import { escapeHtml } from '../shared/dom.js';
import { metaLine } from '../shared/format.js';
import { categoryOf, sameSource, STATUS_LABELS } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';

/** A search result, or a title typed by hand (no source). */
const keyOf = (entry) => (entry.source ? `${entry.source.provider}:${entry.source.id}` : `typed:${entry.category}:${entry.title}`);

function addButtons(index) {
  return `<div class="result-actions">
    <button type="button" class="pill" data-add="${index}" data-status="pending">${icon('clock')}Pending</button>
    <button type="button" class="pill primary" data-add="${index}" data-status="done">${icon('check')}Done</button>
  </div>`;
}

/** "✓ Added to Done" when added from this search, "✓ In your library · Done" otherwise. Tap to open it. */
function ownedHtml({ itemId, status, recent, fresh }) {
  const label = status === 'dropped' ? 'Dropped' : STATUS_LABELS[status];
  const text = recent ? `Added to ${label}` : `In your library · ${label}`;
  return `<button type="button" class="in-library ${recent ? 'just-added' : ''} ${fresh ? 'pop' : ''}" data-open="${itemId}">
    <span class="in-library-check">${icon('check')}</span><span>${text}</span><span class="in-library-open">Open</span></button>`;
}

const messageHtml = (iconName, html) => `<div class="search-message">${icon(iconName)}${html}</div>`;

const SKELETON_ROW = '<li class="result skeleton"><div class="cover"></div><div><div class="bar"></div><div class="bar short"></div></div></li>';

/**
 * @typedef {object} SearchView        what the search is showing
 * @property {'idle' | 'loading' | 'results' | 'error'} phase
 * @property {object[]} results          the catalog's results (phase 'results')
 * @property {string} error              why the search failed (phase 'error')
 * @property {string} searched           the text that was searched
 * @property {string} category           the category searched
 */

/** @param {{ getItems: () => import('../shared/library.js').Item[] }} options  the library, to mark what's in it */
export function createResults({ getItems }) {
  // added from this search (key → { itemId, status, fresh, seen }): says "Added to …" even before the library
  // update arrives; `fresh` plays the badge's pop once
  const added = new Map();

  /** The item this entry became, if it's in the library: { itemId, status, recent, fresh }. */
  function ownedBy(entry) {
    const key = keyOf(entry);
    const mine = added.get(key);
    const item = entry.source
      ? getItems().find((i) => sameSource(i.source, entry.source))
      : mine && getItems().find((i) => i.id === mine.itemId);
    const fresh = Boolean(mine?.fresh);
    if (mine) mine.fresh = false;
    if (item) {
      if (mine) mine.seen = true;
      return { itemId: item.id, status: item.dropped ? 'dropped' : item.status, recent: Boolean(mine), fresh };
    }
    if (mine && !mine.seen) return { ...mine, recent: true, fresh };  // just added: the library update is on its way
    if (mine) added.delete(key);                        // removed from the library since
    return null;
  }

  function resultHtml(result, index) {
    const owned = ownedBy(result);
    return `
      <li class="result">
        ${coverHtml({ image: result.thumbUrl, title: result.title, category: result.category })}
        <div class="result-info">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-meta">${escapeHtml(metaLine(result) || categoryOf(result.category).label)}</div>
          ${owned ? ownedHtml(owned) : addButtons(index)}
        </div>
      </li>`;
  }

  /**
   * Adding by hand, for things the catalog doesn't know (or doesn't list the way you want).
   * Index -1 means "the typed title". `ask` is the question before it: "Add “Dune” anyway?"
   */
  function manualHtml(category, query, ask = (title) => `Add ${title} anyway?`) {
    const owned = ownedBy({ category, title: query });
    const title = `<strong>“${escapeHtml(query)}”</strong>`;
    return `<div class="manual">
      <p>${owned ? title : ask(title)}</p>
      ${owned ? ownedHtml(owned) : addButtons(-1)}
    </div>`;
  }

  return {
    /** @param {SearchView} view */
    html({ phase, results, error, searched, category }) {
      if (phase === 'idle') return messageHtml('search', `<p>Find a ${categoryOf(category).label.toLowerCase()} by its title.</p>`);
      if (phase === 'loading') return `<ul class="results">${SKELETON_ROW.repeat(5)}</ul>`;
      if (phase === 'error') return messageHtml('alert', `<p>${escapeHtml(error)}</p>${manualHtml(category, searched)}`);
      if (!results.length) {
        return messageHtml('search', `<p>Nothing found for <strong>“${escapeHtml(searched)}”</strong>.</p>${manualHtml(category, searched)}`);
      }
      // after the results, so a title the catalogs list differently (or not at all) can still be added as typed
      return `<ul class="results">${results.map(resultHtml).join('')}</ul>
        <div class="manual-end">${manualHtml(category, searched, (title) => `Not in the list? Add ${title} as you typed it`)}</div>`;
    },

    /** Something was just added from this search: its row says "Added to …" right away. */
    markAdded(entry, { itemId, status }) {
      added.set(keyOf(entry), { itemId, status, fresh: true });
    },

    /** A new search: the "Added to …" marks are for the previous one. */
    clearAdded() {
      added.clear();
    },
  };
}
