// Entry point: keeps the latest library from the server and hands it to the views.
// The server is the only source of truth; views never change items locally, they send actions.
import { createCategoryView } from './library/category.js';
import { createDetails } from './library/details.js';
import { onTileTap, renderHome, reshuffleHome } from './library/home.js';
import { createSearch } from './library/search.js';
import { createStatsView } from './library/stats.js';
import { fetchInfo, subscribe } from './shared/api.js';
import { $ } from './shared/dom.js';
import { goBack, pushBack } from './ui/back.js';
import { installCelebrate } from './ui/celebrate.js';
import { installCoverFallback } from './ui/cover.js';
import { icon } from './ui/icons.js';
import { trackVisibleViewport } from './ui/viewport.js';

let items = [];
const getItem = (id) => items.find((i) => i.id === id);

const categoryView = createCategoryView({ onBack: goBack });
const details = createDetails({ getItem });
const search = createSearch({ getItems: () => items, openItem: (id, how) => details.open(id, how) });
const statsView = createStatsView({ onBack: goBack, onOpenItem: (id) => details.open(id) });

// ----- home ↔ category, stats -----

function showView(id) {
  for (const view of document.querySelectorAll('.view')) {
    const shown = view.id === id;
    view.hidden = !shown;
    view.classList.toggle('entering', shown);
  }
  $('addButton').hidden = id === 'statsView';      // nothing to add on the stats
  window.scrollTo(0, 0);
}

function openCategory(id) {
  categoryView.show(id);
  showView('categoryView');
  pushBack(showHome);                              // back (button or phone) returns home
}

function openStats() {
  statsView.show();
  showView('statsView');
  pushBack(showHome);
}

function showHome() {
  categoryView.hide();
  statsView.hide();
  reshuffleHome();                                 // new random covers each time you come back
  renderHome(items);
  showView('homeView');
}

onTileTap(openCategory);
$('statsButton').innerHTML = icon('chart');
$('statsButton').addEventListener('click', openStats);

// ----- start -----

installCoverFallback();
installCelebrate();
trackVisibleViewport();
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', () => search.open(categoryView.category));
$('shelf').addEventListener('click', (e) => {
  const card = e.target.closest('[data-item]');
  if (card) details.open(card.dataset.item);
});

fetchInfo().then(({ sources }) => search.setSources(sources)).catch(() => {});

subscribe((view) => {
  items = view.items;
  renderHome(items);
  categoryView.update(items);
  statsView.update(items);
  details.refresh();
  search.refresh();
});
