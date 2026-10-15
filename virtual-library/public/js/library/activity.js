// Recent activity (a quiet link at the bottom of settings): the latest changes to items, newest first, each with an
// Undo for mistakes. An item's changes undo newest first, so only its latest one has the button.
import { sendAction } from '../shared/api.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "12 Mar". */
function ago(at, now = Date.now()) {
  const past = now - at;
  if (past < MINUTE) return 'Just now';
  if (past < HOUR) return `${Math.floor(past / MINUTE)} min ago`;
  const day = new Date(now).setHours(0, 0, 0, 0);
  if (at >= day) return `${Math.floor(past / HOUR)} h ago`;
  if (at >= day - 24 * HOUR) return 'Yesterday';
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function createActivity() {
  const list = $('activityList');
  const sheet = createSheet($('activityLayer'));
  let entries = [];

  function render() {
    list.innerHTML = entries.length ? entries.map((e) => `
      <li class="activity-row ${e.undone ? 'undone' : ''}" data-category="${e.category}">
        <span class="kind-icon">${icon(e.category)}</span>
        <span class="activity-text">
          <strong>${escapeHtml(e.title)}</strong>
          <span>${escapeHtml(e.text)} · ${ago(e.at)}</span>
        </span>
        ${e.canUndo ? `<button type="button" class="activity-undo" data-undo="${e.id}">Undo</button>`
          : e.undone ? '<span class="activity-undone">Undone</span>' : ''}
      </li>`).join('') : '<li class="activity-empty">Nothing yet</li>';
  }

  list.addEventListener('click', (e) => {
    const button = closest(e, '[data-undo]');
    if (!button) return;
    /** @type {HTMLButtonElement} */ (button).disabled = true;
    sendAction({ type: 'undo', entryId: button.dataset.undo })
      .then(() => toast('Undone', { icon: 'check' }))
      .catch((err) => {
        toast(err.message, { error: true });
        render();
      });
  });

  return {
    open() {
      render();                     // the times move on
      list.scrollTop = 0;
      sheet.open();
    },
    /** @param {any[]} value  the activity, from the server */
    update(value) {
      entries = value;
      render();
    },
  };
}
