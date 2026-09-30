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
const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

const STATUS_LABEL = { pending: 'Pending', done: 'Done' };

/**
 * @param {object} options
 * @param {() => object[]} options.getItems    the library, to mark results that are already in it
 * @param {(itemId: string) => void} options.openItem
 */
export function createSearch({ getItems, openItem }) {
  const sheet = createSheet($('searchLayer'));
  const body = $('searchBody');
  const input = $('searchInput');
  const picker = $('searchCategories');

  let category = CATEGORY_IDS.includes(storage.get(CATEGORY_KEY)) ? storage.get(CATEGORY_KEY) : 'movie';
  let credits = {};
  // idle | loading | results | error
  let phase = 'idle';
  let results = [];
  let error = '';
  let searched = '';
  let controller = null;
  let timer = null;

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
    searched = query;
    phase = 'loading';
    render();
    try {
      results = await searchCatalog(category, query, signal);
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
    storage.set(CATEGORY_KEY, id);
    input.placeholder = `Search ${categoryOf(id).plural.toLowerCase()}`;
    for (const button of picker.children) {
      const selected = button.dataset.category === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', selected);
    }
    showCredits();
    run();
  }

  function showCredits() {
    const credit = credits[category];
    $('searchCredits').innerHTML = credit
      ? `Search by <a href="${escapeHtml(credit.url)}" target="_blank" rel="noopener">${escapeHtml(credit.name)}</a>` : '';
  }

  // ----- rendering -----

  const libraryMatch = (result) => getItems().find((item) => sameSource(item.source, result.source));

  function addButtons(index) {
    return `<div class="result-actions">
      <button type="button" class="pill" data-add="${index}" data-status="pending">${icon('clock')}Pending</button>
      <button type="button" class="pill primary" data-add="${index}" data-status="done">${icon('check')}Done</button>
    </div>`;
  }

  function resultHtml(result, index) {
    const owned = libraryMatch(result);
    const action = owned
      ? `<button type="button" class="in-library" data-open="${owned.id}">${icon('check')}In your library · ${STATUS_LABEL[owned.status]}</button>`
      : addButtons(index);
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
    return `<div class="manual">
      <p>Add <strong>“${escapeHtml(query)}”</strong> anyway?</p>
      ${addButtons(-1)}
    </div>`;
  }

  function messageHtml(iconName, html) {
    return `<div class="search-message">${icon(iconName)}${html}</div>`;
  }

  function render() {
    $('searchClear').hidden = !input.value;
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
      toast(`Added to ${STATUS_LABEL[status]}`);
      if (status === 'done') openItem(itemId);    // to rate it, if you like
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
    if (owned) openItem(owned.dataset.open);
  });

  // the keyboard covers half the screen: hide it when scrolling through results
  body.addEventListener('touchstart', () => input.blur(), { passive: true });

  setCategory(category);

  return {
    /** Opens on the given category (the one chosen on the shelf), keeping the last search. */
    open(preferredCategory) {
      if (CATEGORY_IDS.includes(preferredCategory) && preferredCategory !== category) setCategory(preferredCategory);
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
