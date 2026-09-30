// Item sheet: big cover, move between Pending and Done, rate when done, remove.
import { sendAction } from '../shared/api.js';
import { $, escapeHtml } from '../shared/dom.js';
import { categoryOf } from '../shared/library.js';
import { celebrate } from '../ui/celebrate.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { previewStars, starInputHtml } from '../ui/stars.js';
import { toast } from '../ui/toast.js';
import { cheerFor } from './cheers.js';

const DISARM_MS = 3000;

/** @param {{ getItem: (id: string) => object | undefined }} options */
export function createDetails({ getItem }) {
  const panel = $('details');
  const sheet = createSheet($('detailsLayer'), { onClose: () => { itemId = null; } });

  let itemId = null;
  let options = {};                 // how it was opened: { fromSearch, justAdded }
  let popBanner = false;            // the "Added to …" banner pops in once, when the sheet opens
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
    const glow = item.image
      ? `<div class="details-glow" style="background-image:url('${escapeHtml(item.image)}')"></div>`
      : '<div class="details-glow tint"></div>';
    const banner = options.justAdded
      ? `<div class="details-added ${popBanner ? 'pop' : ''}">${icon('check')}Added to ${done ? 'Done' : 'Pending'}</div>` : '';
    popBanner = false;

    panel.dataset.category = item.category;
    panel.innerHTML = `
      ${glow}
      <div class="grabber" data-drag data-close></div>
      <div class="details-bar">
        ${banner}
        <button type="button" class="details-close" data-close>${options.fromSearch ? 'Back to search' : 'Close'}</button>
      </div>
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

        <button type="button" class="pill danger details-remove ${removeArmed ? 'armed' : ''}" data-remove>
          ${removeArmed ? 'Tap again to remove' : 'Remove from library'}
        </button>
      </div>`;
  }

  /** Pending → Done: confetti in the category's color, and a (hopefully) funny line. */
  function celebrateFinishing(item) {
    const tint = getComputedStyle(panel).getPropertyValue('--tint').trim();
    celebrate(cheerFor(item.category), [tint, '#f4c566', '#a78bfa', '#eeeaf6']);
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
      const status = statusButton.dataset.status;
      send({ type: 'setStatus', itemId, status })
        .then(() => { if (status === 'done') celebrateFinishing(item); })
        .catch(() => {});
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
    /** @param {{ fromSearch?: boolean, justAdded?: boolean }} [how] */
    open(id, how = {}) {
      const item = getItem(id);
      waitingFor = item ? null : id;
      options = how;
      popBanner = Boolean(how.justAdded);
      if (!item) return;
      itemId = id;
      disarm();
      render(item);
      panel.scrollTop = 0;
      sheet.open();
    },

    /** The library changed: show the new state, or close if the item is gone. */
    refresh() {
      if (waitingFor && getItem(waitingFor)) return this.open(waitingFor, options);
      if (!itemId) return;
      const item = getItem(itemId);
      if (item) render(item);
      else sheet.close();
    },
  };
}
