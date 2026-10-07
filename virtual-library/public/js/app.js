// Entry point: keeps the latest library from the server and hands it to the views.
// The server is the only source of truth; views never change items locally, they send actions.
import { createCategoryView } from './library/category.js';
import { createDetails } from './library/details.js';
import { onTileTap, renderHome, reshuffleHome } from './library/home.js';
import { createSearch } from './library/search.js';
import { createShownKinds, createWelcomeSwitches } from './library/shown.js';
import { createStatsView } from './library/stats.js';
import { fetchInfo, sendAction, subscribe } from './shared/api.js';
import { $, closest } from './shared/dom.js';
import { goBack, pushBack } from './ui/back.js';
import { installCelebrate } from './ui/celebrate.js';
import { installCoverFallback } from './ui/cover.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { trackVisibleViewport } from './ui/viewport.js';

let items = [];
let hidden = [];                     // kinds hidden from home, stats and search (their items are kept)
let setupStep = null;                // setup: 'categories' (welcome), 'library' (home, with a banner), null: done
// setting up: when it started, and whether it's the first time (nothing in the library from before)
let setup = { step: null, since: 0, first: false };
const getItem = (id) => items.find((i) => i.id === id);

const categoryView = createCategoryView({ onBack: goBack });
const details = createDetails({ getItem });
const search = createSearch({ getItems: () => items, openItem: (id, how) => details.open(id, how) });
const statsView = createStatsView({ onBack: goBack, onOpenItem: (id) => details.open(id) });
const shownKinds = createShownKinds();
const welcomeSwitches = createWelcomeSwitches();

// ----- home ↔ category, stats -----

function showView(id) {
  for (const view of document.querySelectorAll('.view')) {
    if (!(view instanceof HTMLElement)) continue;
    const shown = view.id === id;
    view.hidden = !shown;
    view.classList.toggle('entering', shown);
  }
  $('addButton').hidden = id === 'statsView' || id === 'welcomeView';   // nothing to add there
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
  renderHome(items, hidden, setup);
  showView('homeView');
}

/** Setting up (the first time, or again): which categories you use. */
function showWelcome() {
  categoryView.hide();
  statsView.hide();
  shownKinds.close();
  showView('welcomeView');
}

const sendSetup = (step) => sendAction({ type: 'setSetup', step });
$('welcomeNext').addEventListener('click', () => sendSetup('library').catch((err) => toast(err.message, { error: true })));
$('setupDone').addEventListener('click', () => sendSetup('done')
  .then(() => toast(setup.first ? 'Stats start now' : 'Saved', { icon: 'check' }))
  .catch((err) => toast(err.message, { error: true })));

onTileTap(openCategory);
$('statsButton').innerHTML = icon('chart');
$('statsButton').addEventListener('click', openStats);
$('kindsButton').innerHTML = icon('dots');
$('welcomeEye').innerHTML = icon('dots');
// in settings, adding what you'd already seen (say, in a category just switched on): setup's library step, with its
// banner on home; what's marked done until it's done counts as seen before, not this year
$('seenButton').innerHTML = `${icon('history')}<span>Add already seen</span>`;
$('seenButton').addEventListener('click', () => sendSetup('library')
  .then(() => shownKinds.close())
  .catch((err) => toast(err.message, { error: true })));
$('kindsButton').addEventListener('click', () => shownKinds.open());

// ----- start -----

installCoverFallback();
installCelebrate();
trackVisibleViewport();
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', () => search.open(categoryView.category));
$('shelf').addEventListener('click', (e) => {
  const card = closest(e, '[data-item]');
  if (card) details.open(card.dataset.item);
});

fetchInfo().then(({ sources }) => search.setSources(sources)).catch(() => {});

subscribe((view) => {
  items = view.items;
  hidden = view.hiddenCategories ?? [];
  const welcomed = setupStep === 'categories';
  setupStep = view.setupStep ?? null;
  const since = view.setupSince ?? 0;
  setup = { step: setupStep, since, first: setupStep !== null && !items.some((i) => i.addedAt < since) };
  renderHome(items, hidden, setup);
  categoryView.update(items);
  statsView.update(items, view.statsSince, hidden, setup.first);   // the first time: no stats until it's done
  search.setHidden(hidden);
  shownKinds.update(hidden);
  welcomeSwitches.update(hidden);
  if (setupStep === 'categories' && !welcomed) showWelcome();
  else if (setupStep !== 'categories' && welcomed) showHome();
  details.refresh();
  search.refresh();
});
