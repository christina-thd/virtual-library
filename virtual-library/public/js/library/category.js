// One category: its title, the Pending / (Waiting /) Done tabs, the sort button and the shelf. It always opens
// on Pending, and each tab starts in its own order (Done: best rated first).
import { $, closest, escapeHtml } from '../shared/dom.js';
import { categoryOf, statusesFor } from '../shared/library.js';
import { icon } from '../ui/icons.js';
import { renderShelf, SORTS, sortsFor } from './shelf.js';

// the order each tab starts in
const START_SORT = { pending: 'recent', waiting: 'recent', done: 'rating' };

/** "Pokémon" is found by "pokemon". */
const simplify = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const matches = (item, query) => simplify(`${item.title} ${item.creator ?? ''}`).includes(query);

export function createCategoryView({ onBack }) {
  let category = null;
  let status = 'pending';
  // the order on each tab, while it's shown
  const sorts = { ...START_SORT };
  let library = [];
  let reversed = false;              // the order the other way round
  let query = '';                   // searching inside the category: by title or creator, on every tab

  const view = $('categoryView');
  const tabs = $('statusTabs');
  const sortSelect = /** @type {HTMLSelectElement} */ ($('sortSelect'));
  /** The Pending / (Waiting) / Done buttons. */
  const tabButtons = () => /** @type {NodeListOf<HTMLElement>} */ (tabs.querySelectorAll('[data-status]'));
  tabs.classList.add('segmented');
  $('backButton').innerHTML = icon('back');
  $('backButton').addEventListener('click', onBack);
  $('sortPicker').querySelector('.sort-icon').innerHTML = icon('sort');
  $('sortDirection').innerHTML = icon('arrow');

  /** The order used on this tab. */
  const currentSort = () => sortsFor(category, status).find((s) => s.id === sorts[status]) ?? SORTS[0];

  function markSelected() {
    for (const button of tabButtons()) {
      const selected = button.dataset.status === status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    }
    // the phone's own list (a wheel on iPhone) opens on tap
    const current = currentSort();
    sortSelect.innerHTML = sortsFor(category, status).map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('');
    sortSelect.value = current.id;
    $('sortLabel').textContent = current.label;
    $('sortDirection').setAttribute('aria-pressed', String(reversed));
  }

  function render({ animate = false } = {}) {
    if (!category) return;
    const inCategory = library.filter((i) => i.category === category);
    const found = query ? inCategory.filter((i) => matches(i, query)) : inCategory;
    for (const button of tabButtons()) {
      const count = found.filter((i) => i.status === button.dataset.status).length;
      button.querySelector('.count').textContent = count ? String(count) : '';
    }
    const context = { category, status, inCategory: inCategory.length, sort: currentSort().id, reversed, query };
    renderShelf(found.filter((i) => i.status === status), context, { animate });
    updateJump();
  }

  tabs.addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button || button.dataset.status === status) return;
    status = button.dataset.status;
    sorts[status] = START_SORT[status];
    reversed = false;
    markSelected();
    render({ animate: true });
  });

  $('sortDirection').addEventListener('click', () => {
    reversed = !reversed;
    markSelected();
    render({ animate: true });
  });

  sortSelect.addEventListener('change', () => {
    sorts[status] = sortSelect.value;
    reversed = false;
    markSelected();
    render({ animate: true });
  });

  // the title and tabs stay at the top; they get a background once the shelf scrolls under them
  new IntersectionObserver(([entry]) => $('categoryHead').classList.toggle('stuck', !entry.isIntersecting))
    .observe($('headSentinel'));

  const findInput = /** @type {HTMLInputElement} */ ($('findInput'));
  $('findButton').innerHTML = icon('search');
  $('findBar').querySelector('.search-icon').innerHTML = icon('search');
  $('findClose').innerHTML = icon('close');

  function openFind() {
    $('findBar').hidden = false;
    $('findButton').setAttribute('aria-expanded', 'true');
    findInput.focus();
  }

  function closeFind() {
    $('findBar').hidden = true;
    $('findButton').setAttribute('aria-expanded', 'false');
    findInput.value = '';
    if (query) {
      query = '';
      render();
    }
  }

  $('findButton').addEventListener('click', () => ($('findBar').hidden ? openFind() : closeFind()));
  $('findClose').addEventListener('click', closeFind);
  findInput.addEventListener('input', () => {
    query = simplify(findInput.value.trim());
    render();
  });
  // Enter hides the keyboard
  $('findBar').addEventListener('submit', (e) => {
    e.preventDefault();
    findInput.blur();
  });

  // go to top / bottom: each shows once there's a screen's worth to go that way
  const JUMP_MIN = 300;
  $('jumpTop').innerHTML = icon('up');
  $('jumpBottom').innerHTML = icon('down');
  function updateJump() {
    const below = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    $('jumpTop').classList.toggle('off', window.scrollY < JUMP_MIN);
    $('jumpBottom').classList.toggle('off', below < JUMP_MIN);
  }
  $('jumpTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $('jumpBottom').addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  window.addEventListener('scroll', updateJump, { passive: true });
  window.addEventListener('resize', updateJump);

  markSelected();

  return {
    /** The category shown, or null on the home screen. */
    get category() {
      return category;
    },

    show(id) {
      category = id;
      view.dataset.category = id;
      status = 'pending';
      // only series have Waiting (caught up, waiting for a new season)
      for (const button of tabButtons()) button.hidden = !statusesFor(id).includes(button.dataset.status);
      $('filters').classList.toggle('three-tabs', statusesFor(id).length > 2);   // sort button: icon only
      Object.assign(sorts, START_SORT);
      reversed = false;
      markSelected();
      $('categoryTitle').innerHTML = `${icon(id)}<span>${categoryOf(id).plural}</span>`;
      $('jumpButtons').hidden = false;
      query = '';
      closeFind();
      render({ animate: true });
      requestAnimationFrame(updateJump);           // once the view is on screen
    },

    hide() {
      category = null;
      $('jumpButtons').hidden = true;
    },

    update(items) {
      library = items;
      render();
    },
  };
}
