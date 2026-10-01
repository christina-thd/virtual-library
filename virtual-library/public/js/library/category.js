// One category: its title, the Pending / Done tabs and the shelf. It always opens on Pending.
import { $ } from '../shared/dom.js';
import { categoryOf } from '../shared/library.js';
import { icon } from '../ui/icons.js';
import { renderShelf } from './shelf.js';

export function createCategoryView({ onBack }) {
  let category = null;
  let status = 'pending';
  let library = [];

  const view = $('categoryView');
  const tabs = $('statusTabs');
  tabs.classList.add('segmented');
  $('backButton').innerHTML = icon('back');
  $('backButton').addEventListener('click', onBack);

  function markSelected() {
    for (const button of tabs.querySelectorAll('[data-status]')) {
      const selected = button.dataset.status === status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', selected);
    }
  }

  function render({ animate = false } = {}) {
    if (!category) return;
    const inCategory = library.filter((i) => i.category === category);
    for (const button of tabs.querySelectorAll('[data-status]')) {
      const count = inCategory.filter((i) => i.status === button.dataset.status).length;
      button.querySelector('.count').textContent = count || '';
    }
    renderShelf(inCategory.filter((i) => i.status === status), { category, status, inCategory: inCategory.length }, { animate });
  }

  tabs.addEventListener('click', (e) => {
    const button = e.target.closest('[data-status]');
    if (!button || button.dataset.status === status) return;
    status = button.dataset.status;
    markSelected();
    render({ animate: true });
  });

  // the tabs get a background once they stick to the top (the title above them has scrolled away)
  new IntersectionObserver(([entry]) => $('filters').classList.toggle('stuck', !entry.isIntersecting))
    .observe(view.querySelector('.top'));

  markSelected();

  return {
    /** The category shown, or null on the home screen. */
    get category() {
      return category;
    },

    show(id) {
      category = id;
      view.dataset.category = id;
      status = 'pending';                          // always opens on Pending
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
