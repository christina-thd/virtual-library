// Entry point: keeps the latest library from the server and hands it to the views.
// The server is the only source of truth; views never change items locally, they send actions.
import { createCategoryView } from './library/category.js';
import { createDetails } from './library/details.js';
import { onTileTap, renderHome } from './library/home.js';
import { createSearch } from './library/search.js';
import { fetchInfo, subscribe } from './shared/api.js';
import { $ } from './shared/dom.js';
import { goBack, pushBack } from './ui/back.js';
import { installCoverFallback } from './ui/cover.js';
import { icon } from './ui/icons.js';
import { trackVisibleViewport } from './ui/viewport.js';

let items = [];
const getItem = (id) => items.find((i) => i.id === id);

const categoryView = createCategoryView({ onBack: goBack });
const details = createDetails({ getItem });
const search = createSearch({ getItems: () => items, openItem: (id) => details.open(id) });

// ----- home ↔ category -----

function showView(id) {
  for (const view of document.querySelectorAll('.view')) {
    const shown = view.id === id;
    view.hidden = !shown;
    view.classList.toggle('entering', shown);
  }
  window.scrollTo(0, 0);
}

function openCategory(id) {
  categoryView.show(id);
  showView('categoryView');
  pushBack(showHome);                              // back (button or phone) returns home
}

function showHome() {
  categoryView.hide();
  showView('homeView');
}

onTileTap(openCategory);

// ----- start -----

installCoverFallback();
trackVisibleViewport();
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', () => search.open(categoryView.category));
$('shelf').addEventListener('click', (e) => {
  const card = e.target.closest('[data-item]');
  if (card) details.open(card.dataset.item);
});

fetchInfo().then(({ credits }) => search.setCredits(credits)).catch(() => {});

subscribe((view) => {
  items = view.items;
  renderHome(items);
  categoryView.update(items);
  details.refresh();
  search.refresh();
});
