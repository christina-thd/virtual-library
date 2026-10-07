// Which categories show on the home screen, in the stats and the search: a switch each, in the settings sheet and
// on the welcome screen. A hidden category keeps its items: showing it again brings everything back.
// The choice is saved with the library (setCategoryHidden).
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { CATEGORIES } from '../shared/library.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/** A switch per category in `list`; tapping one shows or hides it (one always stays shown). */
function createSwitches(list) {
  let saved = [];                   // hidden categories, as the server has them
  let hidden = [];                  // as shown: changes right away, the server confirms

  function render() {
    list.innerHTML = CATEGORIES.map((c) => `
      <button type="button" role="switch" class="kind-row" data-category="${c.id}" data-kind="${c.id}" aria-checked="${!hidden.includes(c.id)}">
        <span class="kind-icon">${icon(c.id)}</span>
        <span class="kind-name">${c.plural}</span>
        <span class="switch" aria-hidden="true"></span>
      </button>`).join('');
  }

  list.addEventListener('click', (e) => {
    const row = closest(e, '[data-kind]');
    if (!row) return;
    const id = row.dataset.kind;
    const hide = !hidden.includes(id);
    if (hide && hidden.length === CATEGORIES.length - 1) return toast('Keep at least one category shown', { error: true });
    hidden = hide ? [...hidden, id] : hidden.filter((other) => other !== id);
    render();
    sendAction({ type: 'setCategoryHidden', category: id, hidden: hide }).catch((err) => {
      hidden = saved;
      render();
      toast(err.message, { error: true });
    });
  });

  return {
    render,
    /** @param {string[]} value  the hidden categories, from the server */
    update(value) {
      saved = value;
      hidden = value;
      render();
    },
  };
}

/** The settings sheet (the ⋯ on the home screen): which categories show, and adding what you'd already seen. */
export function createShownKinds() {
  const switches = createSwitches($('kindsList'));
  const sheet = createSheet($('kindsLayer'));
  return {
    open() {
      sheet.open();
    },
    close() {
      sheet.close();
    },
    update: switches.update,
  };
}

/** The welcome screen's switches: the first step of setting up. */
export const createWelcomeSwitches = () => createSwitches($('welcomeKinds'));
