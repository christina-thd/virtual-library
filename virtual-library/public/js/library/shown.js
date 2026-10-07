// The sheet that shows or hides kinds on the home screen, in the stats and the search. A hidden kind keeps its
// items: showing it again brings everything back. The choice is saved with the library (setCategoryHidden).
import { sendAction } from '../shared/api.js';
import { $, closest } from '../shared/dom.js';
import { CATEGORIES } from '../shared/library.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

export function createShownKinds() {
  const sheet = createSheet($('kindsLayer'));
  const list = $('kindsList');
  let saved = [];                   // hidden kinds, as the server has them
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
    open() {
      render();
      sheet.open();
    },
    /** @param {string[]} value  the hidden kinds, from the server */
    update(value) {
      saved = value;
      hidden = value;
      if (sheet.isOpen) render();
    },
  };
}
