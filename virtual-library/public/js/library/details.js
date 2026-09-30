// Item sheet: big cover, move between Pending and Done, rate when done, remove.
import { sendAction } from '../shared/api.js';
import { $, escapeHtml } from '../shared/dom.js';
import { formatDate } from '../shared/format.js';
import { categoryOf } from '../shared/library.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { previewStars, starInputHtml } from '../ui/stars.js';
import { toast } from '../ui/toast.js';

const DISARM_MS = 3000;

/** @param {{ getItem: (id: string) => object | undefined }} options */
export function createDetails({ getItem }) {
  const panel = $('details');
  const sheet = createSheet($('detailsLayer'), { onClose: () => { itemId = null; } });

  let itemId = null;
  let waitingFor = null;            // just added: opens when the item arrives with the next view
  let removeArmed = false;          // remove needs a second tap
  let disarmTimer = null;

  function send(action) {
    return sendAction(action).catch((err) => {
      toast(err.message, { error: true });
      throw err;
    });
  }

  function render(item) {
    const kind = categoryOf(item.category);
    const meta = [item.year, item.creator].filter(Boolean).map(escapeHtml).join(' · ');
    const done = item.status === 'done';
    const dates = done
      ? `Finished ${formatDate(item.finishedAt)}`
      : `Added ${formatDate(item.addedAt)}`;
    const glow = item.image ? `<div class="details-glow" style="background-image:url('${escapeHtml(item.image)}')"></div>` : '';

    panel.dataset.category = item.category;
    panel.innerHTML = `
      ${glow}
      <div class="grabber" data-drag data-close></div>
      <button type="button" class="icon-button details-close" data-close aria-label="Close">${icon('close')}</button>
      <div class="details-content">
        <div data-drag>${coverHtml(item, 'details-cover')}</div>
        <h2 class="details-title">${escapeHtml(item.title)}</h2>
        <div class="details-meta"><span class="kind">${icon(item.category)}${kind.label}</span>${meta ? `<span>· ${meta}</span>` : ''}</div>

        <div class="segmented details-status" role="radiogroup" aria-label="Status">
          <button type="button" role="radio" data-status="pending" class="${done ? '' : 'selected'}" aria-checked="${!done}">${icon('clock')}Pending</button>
          <button type="button" role="radio" data-status="done" class="${done ? 'selected' : ''}" aria-checked="${done}">${icon('check')}Done</button>
        </div>

        ${done ? `
          <div class="rating">
            <div class="rating-label">${item.rating ? 'Your rating' : 'Rate it (optional)'}</div>
            ${starInputHtml(item.rating)}
          </div>` : ''}

        <p class="details-dates">${dates}</p>
        <button type="button" class="pill danger details-remove ${removeArmed ? 'armed' : ''}" data-remove>
          ${removeArmed ? 'Tap again to remove' : 'Remove from library'}
        </button>
      </div>`;
  }

  function disarm() {
    clearTimeout(disarmTimer);
    removeArmed = false;
  }

  panel.addEventListener('click', async (e) => {
    const item = itemId && getItem(itemId);
    if (!item) return;

    const statusButton = e.target.closest('[data-status]');
    if (statusButton && statusButton.dataset.status !== item.status) {
      send({ type: 'setStatus', itemId, status: statusButton.dataset.status }).catch(() => {});
      return;
    }

    const starButton = e.target.closest('[data-rate]');
    if (starButton) {
      const stars = Number(starButton.dataset.rate);
      const rating = stars === item.rating ? null : stars;       // tap your rating again to clear it
      previewStars(panel, rating);
      send({ type: 'rateItem', itemId, rating }).catch(() => render(item));
      return;
    }

    if (e.target.closest('[data-remove]')) {
      if (!removeArmed) {
        removeArmed = true;
        disarmTimer = setTimeout(() => { disarm(); if (itemId) render(getItem(itemId)); }, DISARM_MS);
        render(item);
        return;
      }
      disarm();
      const removed = await send({ type: 'removeItem', itemId }).then(() => true, () => false);
      if (!removed) return render(item);
      toast(`Removed “${item.title}”`);
      sheet.close();
    }
  });

  return {
    open(id) {
      const item = getItem(id);
      waitingFor = item ? null : id;
      if (!item) return;
      itemId = id;
      disarm();
      render(item);
      panel.scrollTop = 0;
      sheet.open();
    },

    /** The library changed: show the new state, or close if the item is gone. */
    refresh() {
      if (waitingFor && getItem(waitingFor)) return this.open(waitingFor);
      if (!itemId) return;
      const item = getItem(itemId);
      if (item) render(item);
      else sheet.close();
    },
  };
}
