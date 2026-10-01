// Search sheet: pick a category, type a title, add a result as pending or done.
import { searchCatalog, sendAction } from '../shared/api.js';
import { $, escapeHtml } from '../shared/dom.js';
import { metaLine } from '../shared/format.js';
import { CATEGORIES, CATEGORY_IDS, categoryOf, sameSource } from '../shared/library.js';
import { storage } from '../shared/storage.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const CATEGORY_KEY = 'searchCategory';
const DEBOUNCE_MS = 250;
const CACHE_SIZE = 50;
const MIN_QUERY = 2;

const STATUS_LABEL = { pending: 'Pending', done: 'Done' };

/**
 * @param {object} options
 * @param {() => object[]} options.getItems    the library, to mark results that are already in it
 * @param {(itemId: string, how: { fromSearch?: boolean, justAdded?: boolean }) => void} options.openItem
 */
export function createSearch({ getItems, openItem }) {
  const sheet = createSheet($('searchLayer'));
  const body = $('searchBody');
  const input = $('searchInput');
  const picker = $('searchCategories');

  // the category picked on the home screen's search, remembered on this phone
  const homeCategory = () => (CATEGORY_IDS.includes(storage.get(CATEGORY_KEY)) ? storage.get(CATEGORY_KEY) : 'movie');
  let category = homeCategory();
  let locked = false;               // opened from a category: only that category can be added
  let credits = {};
  // idle | loading | results | error
  let phase = 'idle';
  let results = [];
  let error = '';
  let searched = '';
  let controller = null;
  let timer = null;
  // results already fetched since the page loaded (category + query → results): shown again without asking
  const cache = new Map();
  const cacheKey = (query) => `${category}\0${query.toLowerCase().replace(/\s+/g, ' ')}`;
  // what was added from this search (key → { itemId, status, fresh, seen }): its row says "Added to …" until
  // the next search, even before the library update arrives; `fresh` plays the badge's pop once
  const added = new Map();

  picker.classList.add('segmented');
  picker.innerHTML = CATEGORIES.map((c) => `
    <button type="button" role="radio" data-category="${c.id}">${icon(c.id)}${c.label}</button>`).join('');
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
    if (query !== searched) added.clear();
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
      results = await searchCatalog(category, query, signal);
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
    for (const button of picker.children) {
      const selected = button.dataset.category === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', selected);
    }
    run();
  }

  /** The catalog that found the results shown, or every catalog asked for this category, in order. */
  function showCredits() {
    const list = credits[category] ?? [];
    const answered = phase === 'results' && list.find((c) => c.id === results[0]?.source?.provider);
    const link = (c) => `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a>`;
    $('searchCredits').innerHTML = list.length ? `Search by ${(answered ? [answered] : list).map(link).join(', then ')}` : '';
  }

  // ----- rendering -----

  const libraryMatch = (result) => getItems().find((item) => sameSource(item.source, result.source));
  const keyOf = (entry) => (entry.source ? `${entry.source.provider}:${entry.source.id}` : `typed:${entry.category}:${entry.title}`);

  /** The item this entry became, if it's in the library: { itemId, status, recent, fresh }. */
  function ownedBy(entry) {
    const key = keyOf(entry);
    const mine = added.get(key);
    const item = entry.source ? libraryMatch(entry) : mine && getItems().find((i) => i.id === mine.itemId);
    const fresh = Boolean(mine?.fresh);
    if (mine) mine.fresh = false;
    if (item) {
      if (mine) mine.seen = true;
      return { itemId: item.id, status: item.status, recent: Boolean(mine), fresh };
    }
    if (mine && !mine.seen) return { ...mine, recent: true, fresh };  // just added: the library update is on its way
    if (mine) added.delete(key);                        // removed from the library since
    return null;
  }

  /** "✓ Added to Done" when added from this search, "✓ In your library · Done" otherwise. Tap to open it. */
  function ownedHtml({ itemId, status, recent, fresh }) {
    const text = recent ? `Added to ${STATUS_LABEL[status]}` : `In your library · ${STATUS_LABEL[status]}`;
    return `<button type="button" class="in-library ${recent ? 'just-added' : ''} ${fresh ? 'pop' : ''}" data-open="${itemId}">
      <span class="in-library-check">${icon('check')}</span><span>${text}</span><span class="in-library-open">Open</span></button>`;
  }

  function addButtons(index) {
    return `<div class="result-actions">
      <button type="button" class="pill" data-add="${index}" data-status="pending">${icon('clock')}Pending</button>
      <button type="button" class="pill primary" data-add="${index}" data-status="done">${icon('check')}Done</button>
    </div>`;
  }

  function resultHtml(result, index) {
    const owned = ownedBy(result);
    const action = owned ? ownedHtml(owned) : addButtons(index);
    return `
      <li class="result">
        ${coverHtml({ image: result.thumbUrl, title: result.title, category: result.category })}
        <div class="result-info">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-meta">${escapeHtml(metaLine(result) || categoryOf(result.category).label)}</div>
          ${action}
        </div>
      </li>`;
  }

  /** Adding by hand, for things the catalog doesn't know. Index -1 means "the typed title". */
  function manualHtml(query) {
    const owned = ownedBy({ category, title: query });
    return `<div class="manual">
      <p>${owned ? `<strong>“${escapeHtml(query)}”</strong>` : `Add <strong>“${escapeHtml(query)}”</strong> anyway?`}</p>
      ${owned ? ownedHtml(owned) : addButtons(-1)}
    </div>`;
  }

  function messageHtml(iconName, html) {
    return `<div class="search-message">${icon(iconName)}${html}</div>`;
  }

  function render() {
    $('searchClear').hidden = !input.value;
    showCredits();
    if (phase === 'idle') {
      body.innerHTML = messageHtml('search', `<p>Find a ${categoryOf(category).label.toLowerCase()} by its title.</p>`);
    } else if (phase === 'loading') {
      const row = '<li class="result skeleton"><div class="cover"></div><div><div class="bar"></div><div class="bar short"></div></div></li>';
      body.innerHTML = `<ul class="results">${row.repeat(5)}</ul>`;
    } else if (phase === 'error') {
      body.innerHTML = messageHtml('alert', `<p>${escapeHtml(error)}</p>${manualHtml(searched)}`);
    } else if (!results.length) {
      body.innerHTML = messageHtml('search', `<p>Nothing found for <strong>“${escapeHtml(searched)}”</strong>.</p>${manualHtml(searched)}`);
    } else {
      body.innerHTML = `<ul class="results">${results.map(resultHtml).join('')}</ul>`;
    }
  }

  // ----- adding -----

  async function add(button) {
    const index = Number(button.dataset.add);
    const status = button.dataset.status;
    const entry = index >= 0 ? results[index] : { category, title: searched };
    for (const b of button.parentElement.children) b.disabled = true;
    try {
      const { itemId } = await sendAction({ type: 'addItem', ...entry, status });
      added.set(keyOf(entry), { itemId, status, fresh: true });
      render();
      toast(`“${entry.title}” added to ${STATUS_LABEL[status]}`, { icon: 'check' });
      if (status === 'done') openItem(itemId, { fromSearch: true, justAdded: true });   // to rate it, if you like
    } catch (err) {
      toast(err.message, { error: true });
      for (const b of button.parentElement.children) b.disabled = false;
    }
  }

  // ----- events -----

  picker.addEventListener('click', (e) => {
    const button = e.target.closest('[data-category]');
    if (button && button.dataset.category !== category) setCategory(button.dataset.category);
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
    const addButton = e.target.closest('[data-add]');
    if (addButton) return add(addButton);
    const owned = e.target.closest('[data-open]');
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
     * Opens the search, keeping the last search text.
     * @param {string|null} onlyCategory  the category shown on screen (only it can be added), or null on home
     */
    open(onlyCategory) {
      lockTo(CATEGORY_IDS.includes(onlyCategory) ? onlyCategory : null);
      sheet.open();
      // in the tap's handler, so phones show the keyboard; without scrolling, because the sheet is still
      // below the screen (sliding in) and the phone would pan the whole page down to "show" the field
      input.focus({ preventScroll: true });
      input.select();
    },

    setCredits(value) {
      credits = value;
      showCredits();
    },

    /** The library changed: update the "In your library" marks. */
    refresh() {
      if (sheet.isOpen && phase === 'results') render();
    },
  };
}
