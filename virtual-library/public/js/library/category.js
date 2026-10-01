// One category: its title, the Pending / (Waiting /) Done tabs, the sort button and the shelf. It always opens
// on Pending, and each tab starts in its own order (Done: best rated first).
import { $, closest, escapeHtml } from '../shared/dom.js';
import { categoryOf, statusesFor } from '../shared/library.js';
import { icon } from '../ui/icons.js';
import { renderShelf, SORTS, sortsFor } from './shelf.js';

// the order each tab starts in
const START_SORT = { pending: 'recent', waiting: 'recent', done: 'rating' };

export function createCategoryView({ onBack }) {
  let category = null;
  let status = 'pending';
  // the order on each tab, while it's shown
  const sorts = { ...START_SORT };
  let library = [];

  const view = $('categoryView');
  const tabs = $('statusTabs');
  const sortSelect = /** @type {HTMLSelectElement} */ ($('sortSelect'));
  /** The Pending / (Waiting) / Done buttons. */
  const tabButtons = () => /** @type {NodeListOf<HTMLElement>} */ (tabs.querySelectorAll('[data-status]'));
  tabs.classList.add('segmented');
  $('backButton').innerHTML = icon('back');
  $('backButton').addEventListener('click', onBack);
  $('sortPicker').querySelector('.sort-icon').innerHTML = icon('sort');

  /** The order used on this tab. */
  const currentSort = () => sortsFor(category, status).find((s) => s.id === sorts[status]) ?? SORTS[0];

  function markSelected() {
    for (const button of tabButtons()) {
      const selected = button.dataset.status === status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    }
    // the phone's own list (a wheel on iPhone) opens on tap; the button shows the short name
    const current = currentSort();
    sortSelect.innerHTML = sortsFor(category, status).map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    sortSelect.value = current.id;
    $('sortLabel').textContent = current.label;
  }

  function render({ animate = false } = {}) {
    if (!category) return;
    const inCategory = library.filter((i) => i.category === category);
    for (const button of tabButtons()) {
      const count = inCategory.filter((i) => i.status === button.dataset.status).length;
      button.querySelector('.count').textContent = count ? String(count) : '';
    }
    const context = { category, status, inCategory: inCategory.length, sort: currentSort().id };
    renderShelf(inCategory.filter((i) => i.status === status), context, { animate });
  }

  tabs.addEventListener('click', (e) => {
    const button = closest(e, '[data-status]');
    if (!button || button.dataset.status === status) return;
    status = button.dataset.status;
    sorts[status] = START_SORT[status];
    markSelected();
    render({ animate: true });
  });

  sortSelect.addEventListener('change', () => {
    sorts[status] = sortSelect.value;
    markSelected();
    render({ animate: true });
  });

  // the title and tabs stay at the top; they get a background once the shelf scrolls under them
  new IntersectionObserver(([entry]) => $('categoryHead').classList.toggle('stuck', !entry.isIntersecting))
    .observe($('headSentinel'));

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
      markSelected();
      $('categoryTitle').innerHTML = `${icon(id)}<span>${categoryOf(id).plural}</span>`;
      render({ animate: true });
    },

    hide() {
      category = null;
    },

    update(items) {
      library = items;
      render();
    },
  };
}
