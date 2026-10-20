// Item sheet: the cover, its status, drop it, rate it (games: playtime and a note), where you left off (pending books
// and comics, series not done), remove it. These are saved with a Save button that shows once one of them changes; closing before
// asks first.
import { sendAction } from '../shared/api.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { formatCount, formatRuntime } from '../shared/format.js';
import { isManga, kindOf, LEFT_OFF, leftOffUnit, MAX_NOTE, STATUS_LABELS, statusesFor } from '../shared/library.js';
import { ask } from '../ui/ask.js';
import { undoFor } from './activity.js';
import { celebrate } from '../ui/celebrate.js';
import { coverHtml } from '../ui/cover.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { starInputHtml } from '../ui/stars.js';
import { toast } from '../ui/toast.js';
import { cheerFor } from './cheers.js';

const STATUS_ICONS = { pending: 'clock', waiting: 'hourglass', done: 'check' };

const DISARM_MS = 3000;

/** @param {{ getItem: (id: string) => import('../shared/library.js').Item | undefined }} options */
export function createDetails({ getItem }) {
  const panel = $('details');
  const sheet = createSheet($('detailsLayer'), { onClose: () => { itemId = null; draft = null; }, beforeClose: askToSave });

  let itemId = null;
  // changes not saved yet: { rating, hours and leftOff (as typed), note } (each undefined while unchanged), and
  // whether the note box and the left off field are open
  let draft = null;
  let noteOpen = false;
  let leftOffOpen = false;
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

  /** What the page shows for these: the changed value, or the saved one. */
  const shown = (item) => ({
    rating: draft?.rating !== undefined ? draft.rating : item.rating,
    hours: draft?.hours !== undefined ? draft.hours : item.hoursPlayed == null ? '' : String(item.hoursPlayed),
    note: draft?.note !== undefined ? draft.note : item.note ?? '',
    leftOff: draft?.leftOff !== undefined ? draft.leftOff : item.leftOff == null ? '' : String(item.leftOff),
    season: draft?.season !== undefined ? draft.season : String(item.seenUpTo?.season ?? ''),
    episode: draft?.episode !== undefined ? draft.episode : String(item.seenUpTo?.episode ?? ''),
  });

  /** Where you left off: a pending book or comic. */
  const keepsLeftOff = (item) => item.status === 'pending' && Boolean(LEFT_OFF[item.category]);
  /** The last episode you saw: a series not done yet. */
  const keepsSeen = (item) => item.category === 'series' && item.status !== 'done';

  /** Something changed and isn't saved yet. */
  function dirty(item) {
    if (!draft || !item) return false;
    const now = shown(item);
    const saved = { rating: item.rating, hours: item.hoursPlayed == null ? '' : String(item.hoursPlayed), note: item.note ?? '',
      leftOff: item.leftOff == null ? '' : String(item.leftOff) };
    if (keepsLeftOff(item)) return now.leftOff.trim() !== saved.leftOff;
    if (keepsSeen(item)) {
      return now.season.trim() !== String(item.seenUpTo?.season ?? '') || now.episode.trim() !== String(item.seenUpTo?.episode ?? '');
    }
    return item.status === 'done' && (now.rating !== saved.rating || now.hours.trim() !== saved.hours || now.note.trim() !== saved.note);
  }

  function render(item) {
    const value = shown(item);
    const meta = [item.year, item.creator].filter(Boolean).map(escapeHtml).join(' · ');
    // a quieter line under it: how long a movie or book is, how many seasons and episodes of a series are out,
    // how many volumes of a manga, how many pages of a book or comic
    const facts = [item.category === 'series' ? '' : formatRuntime(item.runtime),     // a series': for the stats only
      formatCount(item.seasons, 'season'), formatCount(item.episodes, 'episode'), formatCount(item.pages, 'page'), isManga(item) ? formatCount(item.volumes, 'volume') : '']
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
        <div class="details-meta"><span class="kind">${icon(item.category)}${kindOf(item)}</span>${meta ? `<span>· ${meta}</span>` : ''}</div>
        ${facts ? `<div class="details-facts">${facts}</div>` : ''}
        ${item.genres?.length ? `<div class="details-genres">${item.genres.map((g) => `<span>${escapeHtml(g)}</span>`).join('')}</div>` : ''}

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
            <div class="rating-label">${value.rating ? 'Your rating' : 'Rate it (optional)'}</div>
            ${starInputHtml(value.rating)}
          </div>` : ''}

        ${done && item.category === 'game' ? `
          <form class="hours" data-field>
            <label class="rating-label" for="hoursInput">Playtime${value.hours.trim() ? '' : ' (optional)'}</label>
            <span class="hours-field">
              <input id="hoursInput" type="text" inputmode="decimal" autocomplete="off" maxlength="8" placeholder="–"
                value="${escapeHtml(value.hours)}"><span aria-hidden="true">h</span>
            </span>
            <button type="button" class="note-toggle ${value.note.trim() ? 'has-note' : ''}" data-note-toggle aria-expanded="${noteOpen}"
              aria-label="${value.note.trim() ? 'Note' : 'Add a note'}" title="${value.note.trim() ? 'Note' : 'Add a note'}">${icon('note')}</button>
          </form>
          ${noteOpen ? `
            <div class="note">
              <textarea id="noteInput" rows="3" maxlength="${MAX_NOTE}" placeholder="Thoughts?" aria-label="Note">${escapeHtml(value.note)}</textarea>
            </div>` : ''}` : ''}

        ${keepsLeftOff(item) ? leftOffHtml(item, value.leftOff) : ''}
        ${keepsSeen(item) ? seenHtml(item, value) : ''}

        ${dirty(item) ? '<button type="button" class="details-save" data-save>Save</button>' : ''}

        <button type="button" class="pill danger details-remove ${removeArmed ? 'armed' : ''}" data-remove>
          ${removeArmed ? 'Tap again to remove' : 'Remove from library'}
        </button>
      </div>`;
  }

  /**
   * A pending book's or comic's page or manga's volume, "of 412" when it's known: a bookmark button (with the saved one on it)
   * that opens the field.
   */
  function leftOffHtml(item, typed) {
    const saved = item.leftOff != null;
    const unit = leftOffUnit(item);
    const short = unit === 'page' ? 'Page' : 'Vol.';
    const total = unit === 'page' ? item.pages : item.volumes;
    return `
      <button type="button" class="pill left-off-toggle ${item.leftOff ? 'on' : ''}" data-left-off-toggle aria-expanded="${leftOffOpen}"
        aria-controls="leftOffInput">${icon('bookmark')}${item.leftOff ? `${short} ${item.leftOff}` : 'Left off at'}</button>
      ${leftOffOpen ? `
      <form class="hours left-off" data-field>
        <span class="hours-field">
          <span aria-hidden="true">${short}</span>
          <input id="leftOffInput" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="–"
            aria-label="Left off at ${unit}" value="${escapeHtml(typed)}">${total ? `<span aria-hidden="true">of ${total}</span>` : ''}
        </span>
        ${saved ? `<button type="button" class="icon-button left-off-clear" data-left-off-clear aria-label="Clear" title="Clear">${icon('close')}</button>` : ''}
      </form>` : ''}`;
  }

  /**
   * A season or episode picker: looks like the field, with the phone's own list on top (a wheel on iPhone) when how
   * many there are is known; a field to type in when it isn't.
   */
  function numberPicker(id, name, value, most) {
    if (!most) {
      return `<input id="${id}" class="short-input" type="text" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="–"
        aria-label="${name}" value="${escapeHtml(value)}">`;
    }
    const options = Array.from({ length: most }, (_, i) => `<option value="${i + 1}" ${String(i + 1) === value ? 'selected' : ''}>${i + 1}</option>`);
    return `<span class="wheel-value">${escapeHtml(value) || '–'}</span>${icon('down')}
      <select id="${id}" aria-label="${name}"><option value="" ${value ? '' : 'selected'}>–</option>${options.join('')}</select>`;
  }

  /** A series' last seen episode: the same bookmark button ("S2 · E5" on it), opening a season and an episode picker. */
  function seenHtml(item, value) {
    const seen = item.seenUpTo;
    const saved = seen != null;
    const label = !seen ? 'Left off at' : seen.episode ? `S${seen.season} · E${seen.episode}` : `Season ${seen.season}`;
    const seasons = item.seasons ?? item.seasonEpisodes?.length;
    // the season's episodes when the catalog says, else all of them
    const episodes = item.seasonEpisodes?.[Number(value.season) - 1] ?? item.episodes;
    return `
      <button type="button" class="pill left-off-toggle ${seen ? 'on' : ''}" data-left-off-toggle aria-expanded="${leftOffOpen}"
        aria-controls="seasonInput">${icon('bookmark')}${label}</button>
      ${leftOffOpen ? `
      <form class="hours left-off" data-field>
        <label class="hours-field ${seasons ? 'wheel' : ''}">
          <span aria-hidden="true">Season</span>
          ${numberPicker('seasonInput', 'Season', value.season.trim(), seasons)}
        </label>
        <label class="hours-field ${seasons && episodes ? 'wheel' : ''}">
          <span aria-hidden="true">Ep.</span>
          ${numberPicker('episodeInput', 'Episode', value.episode.trim(), seasons && episodes)}
        </label>
        ${saved ? `<button type="button" class="icon-button left-off-clear" data-left-off-clear aria-label="Clear" title="Clear">${icon('close')}</button>` : ''}
      </form>` : ''}`;
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
        .then((result) => {
          if (status === 'done') return celebrateFinishing(item);      // the cheer says it
          // leaving Done clears its rating and its Dropped mark: said, so it's no surprise
          const lost = item.status === 'done' ? [item.rating ? 'rating cleared' : '', item.dropped ? 'no longer dropped' : ''] : [];
          const message = [`“${item.title}” moved to ${STATUS_LABELS[status]}`, ...lost].filter(Boolean).join(' · ');
          toast(message, { icon: 'check', action: undoFor(result) });
        })
        .catch(() => {});
      return;
    }

    // given up on: it counts as done (no confetti), with a mark on its cover
    if (closest(e, '[data-drop]')) {
      const dropped = !item.dropped;
      send({ type: 'setDropped', itemId, dropped })
        .then((result) => toast(dropped ? `“${item.title}” dropped` : `“${item.title}” is no longer dropped`, { icon: 'check', action: undoFor(result) }))
        .catch(() => {});
      return;
    }

    const starButton = closest(e, '[data-rate]');
    if (starButton) {
      const stars = Number(starButton.dataset.rate);
      draft = { ...draft, rating: stars === shown(item).rating ? null : stars };   // tap your rating again to clear it
      return render(item);
    }

    if (closest(e, '[data-note-toggle]')) {
      noteOpen = !noteOpen;
      render(item);
      if (noteOpen) $('noteInput').focus();
      return;
    }

    // no longer keeping track: cleared straight away
    if (closest(e, '[data-left-off-clear]')) {
      const action = item.category === 'series' ? { type: 'setSeenUpTo', itemId, season: null } : { type: 'setLeftOff', itemId, at: null };
      send(action).then(() => saved('Cleared'), () => {});
      return;
    }

    if (closest(e, '[data-left-off-toggle]')) {
      leftOffOpen = !leftOffOpen;
      render(item);
      if (leftOffOpen) /** @type {HTMLElement | null} */ (panel.querySelector('input#leftOffInput, input#seasonInput'))?.focus();
      return;
    }

    if (closest(e, '[data-save]')) return save(item);

    if (closest(e, '[data-remove]')) {
      if (!removeArmed) {
        removeArmed = true;
        disarmTimer = setTimeout(() => { disarm(); if (itemId) render(getItem(itemId)); }, DISARM_MS);
        render(item);
        return;
      }
      disarm();
      const removed = await send({ type: 'removeItem', itemId }).catch(() => null);
      if (!removed) return render(item);
      toast(`Removed “${item.title}”`, { action: undoFor(removed) });
      draft = null;
      sheet.close({ force: true });
    }
  });

  // playtime, where you left off: Enter hides the keyboard
  panel.addEventListener('submit', (e) => {
    if (!closest(e, '[data-field]')) return;
    e.preventDefault();
    /** @type {HTMLElement} */ (document.activeElement)?.blur();
  });

  // typing the playtime, a note or where you left off: kept in the draft; the Save button shows (or goes) without redrawing the field
  panel.addEventListener('input', (e) => {
    const field = /** @type {HTMLInputElement} */ (e.target);
    const item = itemId && getItem(itemId);
    const key = { hoursInput: 'hours', noteInput: 'note', leftOffInput: 'leftOff', seasonInput: 'season', episodeInput: 'episode' }[field.id];
    if (!item || !key) return;
    draft = { ...draft, [key]: field.value };
    // picked from a list: shown, and a new season's episodes listed (the one picked kept if that season has it)
    if (field.tagName === 'SELECT') {
      const most = key === 'season' && (item.seasonEpisodes?.[Number(field.value) - 1] ?? item.episodes);
      if (most && Number(shown(item).episode) > most) draft.episode = '';
      return render(item);
    }
    const button = panel.querySelector('[data-save]');
    if (dirty(item) && !button) panel.querySelector('.details-remove').insertAdjacentHTML('beforebegin', '<button type="button" class="details-save" data-save>Save</button>');
    if (!dirty(item)) button?.remove();
  });

  /** Saves what changed (rating, playtime, note, where you left off): true once saved, false when something's wrong (it says what). */
  async function save(item) {
    const value = shown(item);
    if (keepsLeftOff(item)) return saveLeftOff(item, value.leftOff.trim());
    if (keepsSeen(item)) return saveSeen(value.season.trim(), value.episode.trim());
    const text = value.hours.trim().replace(',', '.');           // "42,5" too, as many phones write it
    const hours = text === '' ? null : Math.round(Number(text) * 10) / 10;
    if (hours !== null && !(hours >= 0.1 && hours <= 100_000)) {
      toast('Type a number for the playtime, like 42.5', { error: true });
      return false;
    }
    const note = value.note.trim() || null;
    const actions = [
      value.rating !== item.rating ? { type: 'rateItem', itemId, rating: value.rating } : null,
      item.category === 'game' && hours !== item.hoursPlayed ? { type: 'setHours', itemId, hours } : null,
      item.category === 'game' && note !== item.note ? { type: 'setNote', itemId, note } : null,
    ].filter(Boolean);
    try {
      for (const action of actions) await send(action);
    } catch {
      return false;                                              // it said why
    }
    draft = null;
    noteOpen = false;
    toast('Saved', { icon: 'check' });
    const now = itemId && getItem(itemId);
    if (now) render(now);
    return true;
  }

  async function saveSeen(seasonText, episodeText) {
    const whole = (text) => (text === '' ? null : Number.isInteger(Number(text)) && Number(text) >= 1 && Number(text) < 100_000 ? Number(text) : NaN);
    const [season, episode] = [whole(seasonText), whole(episodeText)];
    if (Number.isNaN(season) || (season === null && episode !== null) || Number.isNaN(episode)) {
      toast(Number.isNaN(episode) && season !== null ? 'Type an episode number' : 'Type a season number', { error: true });
      return false;
    }
    return send({ type: 'setSeenUpTo', itemId, season, episode }).then(() => saved(), () => false);
  }

  /** Saved (or cleared): the fields close and the page shows what's saved. */
  function saved(message = 'Saved') {
    draft = null;
    leftOffOpen = false;
    toast(message, { icon: 'check' });
    const now = itemId && getItem(itemId);
    if (now) render(now);
    return true;
  }

  async function saveLeftOff(item, typed) {
    const at = typed === '' ? null : Number(typed);
    if (at !== null && !(Number.isInteger(at) && at >= 1 && at <= 99_999)) {
      toast(`Type a ${leftOffUnit(item)} number, like 42`, { error: true });
      return false;
    }
    try {
      await send({ type: 'setLeftOff', itemId, at });
    } catch {
      return false;                                              // it said why
    }
    draft = null;
    leftOffOpen = false;
    toast('Saved', { icon: 'check' });
    const now = itemId && getItem(itemId);
    if (now) render(now);
    return true;
  }

  /** Closing with changes not saved: asks first. Save saves (and closes); Discard drops them; swiping it away stays. */
  async function askToSave() {
    const item = itemId && getItem(itemId);
    if (!dirty(item)) return true;
    const answer = await ask({ title: 'Save changes?', yes: { id: 'save', label: 'Save' }, no: { id: 'discard', label: 'Discard' } });
    if (answer === 'discard') {
      draft = null;
      return true;
    }
    return answer === 'save' ? save(item) : false;
  }

  return {
    /** @param {{ fromSearch?: boolean }} [how] */
    open(id, how = {}) {
      const item = getItem(id);
      waitingFor = item ? null : id;
      options = how;
      if (!item) return;
      itemId = id;
      draft = null;
      noteOpen = false;
      leftOffOpen = false;
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
      if (!item) {
        draft = null;
        return sheet.close({ force: true });
      }
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (typing && ['hoursInput', 'noteInput', 'leftOffInput', 'seasonInput', 'episodeInput'].includes(document.activeElement.id)) return;   // redrawn on leaving
      render(item);
    },
  };
}
