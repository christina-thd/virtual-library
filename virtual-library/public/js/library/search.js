// Search sheet: pick a category (and for games a store), type a title, add a result as pending or done.
// This decides what to search and when, and handles adding; search-results.js draws what it found.
import { searchCatalog, sendAction } from '../shared/api.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { CATEGORIES, CATEGORY_IDS, categoryOf, STATUS_LABELS } from '../shared/library.js';
import { storage } from '../shared/storage.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { createResults } from './search-results.js';

const CATEGORY_KEY = 'searchCategory';
const DEBOUNCE_MS = 250;
const CACHE_SIZE = 50;
const MIN_QUERY = 2;

/**
 * @param {object} options
 * @param {() => import('../shared/library.js').Item[]} options.getItems    the library, to mark what's in it
 * @param {(itemId: string, how: { fromSearch?: boolean }) => void} options.openItem
 */
export function createSearch({ getItems, openItem }) {
  // closing clears the search, once it has slid away (so its results don't change while you watch it go)
  const sheet = createSheet($('searchLayer'), {
    onClose: () => setTimeout(() => {
      if (sheet.isOpen) return;                     // opened again meanwhile
      input.value = '';
      run();
    }, 400),
  });
  const body = $('searchBody');
  const input = /** @type {HTMLInputElement} */ ($('searchInput'));
  const picker = $('searchCategories');
  const sourcePicker = $('searchSources');
  const shown = createResults({ getItems });

  let hidden = [];                  // kinds hidden from home and stats: not offered here either
  const isShown = (id) => CATEGORY_IDS.includes(id) && !hidden.includes(id);
  // the category picked on the home screen's search, remembered on this phone (the first one shown otherwise)
  const homeCategory = () => (isShown(storage.get(CATEGORY_KEY)) ? storage.get(CATEGORY_KEY) : CATEGORY_IDS.find(isShown));
  let category = homeCategory();
  let locked = false;               // opened from a category: only that category can be added
  // category → [{ id, label, credits }], from the server; several make a switch (games: PC / Nintendo)
  let sources = {};
  const sourcesOf = (id) => sources[id] ?? [];
  // category → the source picked on the switch. Not remembered: each time the search opens it's back to the
  // first one (games: PC)
  const picked = new Map();
  /** The source picked for the category, else its first one. */
  function currentSource() {
    const list = sourcesOf(category);
    return list.find((s) => s.id === picked.get(category)) ?? list[0] ?? null;
  }
  /** @type {'idle' | 'loading' | 'results' | 'error'} */
  let phase = 'idle';
  let results = [];
  let error = '';
  let searched = '';
  let controller = null;
  let timer = null;
  // results already fetched since the page loaded (category + query → results): shown again without asking
  const cache = new Map();
  const cacheKey = (query) => [category, currentSource()?.id ?? '', query.toLowerCase().replace(/\s+/g, ' ')].join('\u0000');

  picker.classList.add('segmented');
  picker.innerHTML = CATEGORIES.map((c) => `
    <button type="button" role="radio" data-category="${c.id}" aria-label="${c.label}" title="${c.label}">${icon(c.id)}</button>`).join('');
  $('searchForm').querySelector('.search-icon').innerHTML = icon('search');
  $('searchClear').innerHTML = icon('close');

  // ----- searching -----

  async function run() {
    clearTimeout(timer);
    controller?.abort();
    const query = input.value.trim();
    if (query.length < MIN_QUERY) {
      phase = 'idle';
      return render();
    }
    controller = new AbortController();
    const { signal } = controller;
    if (query !== searched) shown.clearAdded();
    searched = query;
    const key = cacheKey(query);
    if (cache.has(key)) {
      results = cache.get(key);
      phase = 'results';
      return render();
    }
    phase = 'loading';
    render();
    try {
      const source = sourcesOf(category).length > 1 ? currentSource().id : null;   // only sent when there's a choice
      results = await searchCatalog(category, query, signal, source);
      cache.set(key, results);
      if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
      phase = 'results';
    } catch (err) {
      if (signal.aborted) return;                  // replaced by a newer search
      error = err.message;
      phase = 'error';
    }
    render();
  }

  function setCategory(id) {
    category = id;
    if (!locked) storage.set(CATEGORY_KEY, id);
    input.placeholder = `Search ${categoryOf(id).plural.toLowerCase()}`;
    for (const button of /** @type {HTMLCollectionOf<HTMLElement>} */ (picker.children)) {
      const selected = button.dataset.category === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    showSources();
    run();
  }

  /** The PC / Nintendo switch, for a category that has more than one source. */
  function showSources() {
    const list = sourcesOf(category);
    sourcePicker.hidden = list.length < 2;
    if (sourcePicker.hidden) return;
    const current = currentSource();
    // an icon when there is one (the label is then its name), else the label
    sourcePicker.innerHTML = list.map((s) => `
      <button type="button" role="radio" data-source="${escapeHtml(s.id)}" class="${s === current ? 'selected' : ''}"
        aria-checked="${s === current}" ${s.icon ? `aria-label="${escapeHtml(s.label)}" title="${escapeHtml(s.label)}"` : ''}>
        ${s.icon ? icon(s.icon) : escapeHtml(s.label)}</button>`).join('');
  }

  function setSource(id) {
    picked.set(category, id);
    showSources();
    run();
  }

  /** The catalog that found the results shown, or every catalog asked for this source, in order. */
  function showCredits() {
    const list = currentSource()?.credits ?? [];
    const answered = phase === 'results' && list.find((c) => c.id === results[0]?.source?.provider);
    const link = (c) => `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a>`;
    $('searchCredits').innerHTML = list.length ? `Search by ${(answered ? [answered] : list).map(link).join(', then ')}` : '';
  }

  // ----- showing -----

  function render() {
    $('searchClear').hidden = !input.value;
    showCredits();
    body.innerHTML = shown.html({ phase, results, error, searched, category });
  }

  // ----- adding -----

  /** @param {HTMLElement} button  Pending or Done; data-add: the result's index, or -1 for the typed title */
  async function add(button) {
    const index = Number(button.dataset.add);
    const status = button.dataset.status;
    const entry = index >= 0 ? results[index] : { category, title: searched };
    const buttons = /** @type {HTMLCollectionOf<HTMLButtonElement>} */ (button.parentElement.children);
    for (const b of buttons) b.disabled = true;
    try {
      const { itemId } = await sendAction({ type: 'addItem', ...entry, status });
      shown.markAdded(entry, { itemId, status });
      render();
      toast(`“${entry.title}” added to ${STATUS_LABELS[status]}`, { icon: 'check' });
      if (status === 'done') openItem(itemId, { fromSearch: true });   // to rate it, if you like
    } catch (err) {
      toast(err.message, { error: true });
      for (const b of buttons) b.disabled = false;
    }
  }

  // ----- events -----

  picker.addEventListener('click', (e) => {
    const button = closest(e, '[data-category]');
    if (button && button.dataset.category !== category) setCategory(button.dataset.category);
  });

  sourcePicker.addEventListener('click', (e) => {
    const button = closest(e, '[data-source]');
    if (button && button.dataset.source !== currentSource()?.id) setSource(button.dataset.source);
  });

  input.addEventListener('input', () => {
    $('searchClear').hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  });

  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    input.blur();                                  // hides the keyboard to show the results
    run();
  });

  $('searchClear').addEventListener('click', () => {
    input.value = '';
    run();
    input.focus({ preventScroll: true });
  });

  body.addEventListener('click', (e) => {
    const addButton = closest(e, '[data-add]');
    if (addButton) return add(addButton);
    const owned = closest(e, '[data-open]');
    if (owned) openItem(owned.dataset.open, { fromSearch: true });
  });

  // the keyboard covers half the screen: hide it when scrolling through results
  body.addEventListener('touchstart', () => input.blur(), { passive: true });

  setCategory(category);

  /** From a category: only that one ("Add a game"). From home: any, with the category buttons. */
  function lockTo(id) {
    locked = Boolean(id);
    picker.hidden = locked;
    $('searchTitle').textContent = locked ? `Add a ${categoryOf(id).label.toLowerCase()}` : 'Add to your hoard';
    const wanted = locked ? id : homeCategory();
    if (wanted !== category) setCategory(wanted);
  }

  return {
    /**
     * Opens the search (empty: closing it clears what was typed).
     * @param {string|null} onlyCategory  the category shown on screen (only it can be added), or null on home
     */
    open(onlyCategory) {
      const switched = picked.size > 0;
      picked.clear();                                // games: back to PC
      lockTo(CATEGORY_IDS.includes(onlyCategory) ? onlyCategory : null);
      if (switched) {
        showSources();
        run();                                       // the kept search text, on PC again
      }
      sheet.open();
      // in the tap's handler, so phones show the keyboard; without scrolling, because the sheet is still
      // below the screen (sliding in) and the phone would pan the whole page down to "show" the field
      input.focus({ preventScroll: true });
      input.select();
    },

    /** What each category searches (from /api/info): credits, and the platform switch for games. */
    setSources(value) {
      sources = value ?? {};
      showSources();
      if (sourcesOf(category).length > 1) run();       // a search made before this went to the default source
      else showCredits();
    },

    /** @param {string[]} value  kinds hidden from home and stats: their buttons go too */
    setHidden(value) {
      hidden = value;
      for (const button of /** @type {HTMLCollectionOf<HTMLElement>} */ (picker.children)) button.hidden = !isShown(button.dataset.category);
      if (!locked && !isShown(category)) setCategory(homeCategory());
    },

    /** The library changed: update the "In your library" marks. */
    refresh() {
      if (sheet.isOpen && phase === 'results') render();
    },
  };
}
