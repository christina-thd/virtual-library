// Item sheet: big cover, move between Pending, Waiting (series) and Done, drop it, rate when done (and for games,
// hours played), remove.
import { sendAction } from '../shared/api.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { formatCount, formatRuntime } from '../shared/format.js';
import { categoryOf, STATUS_LABELS, statusesFor } from '../shared/library.js';
import { celebrate } from '../ui/celebrate.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { previewStars, starInputHtml } from '../ui/stars.js';
import { toast } from '../ui/toast.js';
import { cheerFor } from './cheers.js';

const STATUS_ICONS = { pending: 'clock', waiting: 'hourglass', done: 'check' };

const DISARM_MS = 3000;

/** 1 → "1 hour", 42.5 → "42.5 hours". */
const formatHours = (hours) => `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

/** @param {{ getItem: (id: string) => import('../shared/library.js').Item | undefined }} options */
export function createDetails({ getItem }) {
  const panel = $('details');
  const sheet = createSheet($('detailsLayer'), { onClose: () => { itemId = null; } });

  let itemId = null;
  let options = {};                 // how it was opened: { fromSearch }
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
    // a quieter line under it: how long a movie or book is, how many seasons and episodes of a series are out
    const facts = [formatRuntime(item.runtime), formatCount(item.seasons, 'season'), formatCount(item.episodes, 'episode'), formatCount(item.pages, 'page')]
      .filter(Boolean).join(' · ');
    const done = item.status === 'done';
    const glow = item.image
      ? `<div class="details-glow" style="background-image:url('${escapeHtml(item.image)}')"></div>`
      : '<div class="details-glow tint"></div>';

    panel.dataset.category = item.category;
    panel.innerHTML = `
      ${glow}
      <div class="grabber" data-drag data-close></div>
      <div class="details-bar">
        <button type="button" class="details-close" data-close>${options.fromSearch ? 'Back to search' : 'Close'}</button>
      </div>
      <div class="details-content">
        <div data-drag>${coverHtml(item, 'details-cover')}</div>
        <h2 class="details-title">${escapeHtml(item.title)}</h2>
        <div class="details-meta"><span class="kind">${icon(item.category)}${kind.label}</span>${meta ? `<span>· ${meta}</span>` : ''}</div>
        ${facts ? `<div class="details-facts">${facts}</div>` : ''}

        <div class="segmented details-status" role="radiogroup" aria-label="Status">
          ${statusesFor(item.category).map((status) => `
            <button type="button" role="radio" data-status="${status}" class="${status === item.status ? 'selected' : ''}"
              aria-checked="${status === item.status}">${icon(STATUS_ICONS[status])}${STATUS_LABELS[status]}</button>`).join('')}
        </div>

        <button type="button" class="pill details-drop ${item.dropped ? 'on' : ''}" data-drop aria-pressed="${item.dropped}">
          ${icon('trash')}${item.dropped ? 'Dropped · tap to undo' : 'Dropped it'}
        </button>

        ${done ? `
          <div class="rating">
            <div class="rating-label">${item.rating ? 'Your rating' : 'Rate it (optional)'}</div>
            ${starInputHtml(item.rating)}
          </div>` : ''}

        ${done && item.category === 'game' ? `
          <form class="hours" data-hours>
            <label class="rating-label" for="hoursInput">Hours played (optional)</label>
            <span class="hours-field">
              <input id="hoursInput" type="text" inputmode="decimal" autocomplete="off" maxlength="8" placeholder="–"
                value="${item.hoursPlayed ?? ''}"><span aria-hidden="true">h</span>
            </span>
          </form>` : ''}

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

    const statusButton = closest(e, '[data-status]');
    if (statusButton && statusButton.dataset.status !== item.status) {
      const status = statusButton.dataset.status;
      send({ type: 'setStatus', itemId, status })
        .then(() => { if (status === 'done') celebrateFinishing(item); })
        .catch(() => {});
      return;
    }

    // given up on: it counts as done (no confetti), with a mark on its cover
    if (closest(e, '[data-drop]')) {
      const dropped = !item.dropped;
      send({ type: 'setDropped', itemId, dropped })
        .then(() => toast(dropped ? `“${item.title}” dropped` : `“${item.title}” is no longer dropped`, { icon: 'check' }))
        .catch(() => {});
      return;
    }

    const starButton = closest(e, '[data-rate]');
    if (starButton) {
      const stars = Number(starButton.dataset.rate);
      const rating = stars === item.rating ? null : stars;       // tap your rating again to clear it
      previewStars(panel, rating);
      send({ type: 'rateItem', itemId, rating })
        .then(() => toast(rating ? `Rated “${item.title}” ${rating} of 5` : `Rating of “${item.title}” cleared`, { icon: 'check' }))
        .catch(() => render(item));
      return;
    }

    if (closest(e, '[data-remove]')) {
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

  // hours played (games): saved when leaving the field or pressing Enter (which also hides the keyboard)
  panel.addEventListener('submit', (e) => {
    if (!closest(e, '[data-hours]')) return;
    e.preventDefault();
    $('hoursInput').blur();
  });

  panel.addEventListener('change', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.id !== 'hoursInput') return;
    const item = itemId && getItem(itemId);
    if (!item) return;
    const text = input.value.trim().replace(',', '.');           // "42,5" too, as many phones write it
    const hours = text === '' ? null : Math.round(Number(text) * 10) / 10;
    if (hours !== null && !(hours >= 0.1 && hours <= 100_000)) {
      input.value = item.hoursPlayed == null ? '' : String(item.hoursPlayed);
      return toast('Type a number, like 42.5', { error: true });
    }
    if (hours === item.hoursPlayed) return;
    send({ type: 'setHours', itemId, hours })
      .then(() => toast(hours ? `${formatHours(hours)} played on “${item.title}”` : `Hours played on “${item.title}” cleared`, { icon: 'check' }))
      .catch(() => render(item));
  });

  return {
    /** @param {{ fromSearch?: boolean }} [how] */
    open(id, how = {}) {
      const item = getItem(id);
      waitingFor = item ? null : id;
      options = how;
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
      if (!item) return sheet.close();
      if (document.activeElement?.id === 'hoursInput') return;   // typing: don't wipe it (it's shown on leaving)
      render(item);
    },
  };
}
