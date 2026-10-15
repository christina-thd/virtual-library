// Bottom sheets. The page needs, per sheet:
//   <div class="layer" hidden><div class="backdrop" data-close></div><section class="sheet">…</section></div>
// Sheets can stack (the item sheet opens on top of search); the back button closes the top one.
// [data-close] closes it on tap; dragging [data-drag] (its top) down far enough, or flicking it, does too.
import { closest } from '../shared/dom.js';
import { goBack, pushBack } from './back.js';

const DRAG_START_PX = 8;            // movement before a touch counts as a drag (so taps still work)
const CLOSE_DISTANCE_PX = 110;
const CLOSE_SPEED = 0.6;            // px per ms: a quick flick closes even when short

let open = 0;                       // sheets open right now: the page doesn't scroll behind them

/** Swipe down to close: the sheet follows the finger, then closes or springs back. */
function enableDragToClose(panel, close) {
  let drag = null;
  let justDragged = false;

  panel.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !closest(e, '[data-drag]')) return;
    drag = { id: e.pointerId, startY: e.clientY, startTime: e.timeStamp, moved: false, dy: 0 };
  });

  panel.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = Math.max(0, e.clientY - drag.startY);
    if (!drag.moved) {
      if (dy < DRAG_START_PX) return;
      drag.moved = true;
      try {
        panel.setPointerCapture(e.pointerId);        // keep following the finger outside the handle
      } catch {
        // the pointer is already gone: the drag still works while it's over the sheet
      }
      panel.classList.add('dragging');
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();   // hide the keyboard
    }
    drag.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, dy, startTime } = drag;
    drag = null;
    if (!moved) return;
    justDragged = true;                              // the click that follows isn't a tap
    panel.classList.remove('dragging');
    const speed = dy / Math.max(1, e.timeStamp - startTime);
    if (dy > CLOSE_DISTANCE_PX || speed > CLOSE_SPEED) {
      panel.style.transform = 'translateY(100%)';    // carry on sliding down from where the finger left it
      close().then((closing) => {
        if (!closing) panel.style.transform = '';    // it asked first, and stays: spring back
      });
    } else {
      panel.style.transform = '';                    // spring back
    }
  }
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);

  panel.addEventListener('click', (e) => {
    if (!justDragged) return;
    justDragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

/**
 * @param {HTMLElement} layer
 * @param {{ onClose?: () => void, beforeClose?: () => boolean | Promise<boolean> }} [options]
 *   onClose: called when it starts closing; beforeClose: asked first (Close, a swipe, back): false keeps it open
 */
export function createSheet(layer, { onClose, beforeClose } = {}) {
  const panel = /** @type {HTMLElement} */ (layer.querySelector('.sheet'));
  let isOpen = false;
  let closing = false;              // going back is asynchronous: don't go back twice

  function hide() {
    isOpen = false;
    closing = false;
    if (--open === 0) document.body.classList.remove('locked');
    layer.classList.remove('open');
    const done = () => {
      if (isOpen) return;
      layer.hidden = true;
      panel.style.transform = '';
    };
    panel.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400);                          // in case the transition doesn't run
    onClose?.();
  }

  let asked = false;                // close() asked already: going back doesn't ask again

  // the back button: history has gone back already, so if it may not close yet, its entry is put back
  async function onBack() {
    const ask = beforeClose && !asked;
    asked = false;
    if (ask && !(await beforeClose())) return pushBack(onBack);
    hide();
  }

  const sheet = {
    get isOpen() {
      return isOpen;
    },

    open() {
      if (isOpen) return;
      isOpen = true;
      open++;
      pushBack(onBack);
      document.body.classList.add('locked');
      panel.style.transform = '';
      layer.hidden = false;
      void panel.offsetHeight;                      // apply the closed position first, so it slides in
      layer.classList.add('open');
    },

    /**
     * Closes through history, so the entry added by open() goes away too. Resolves whether it's closing (false: it
     * asked first and stays open).
     * @param {{ force?: boolean }} [how]  force: without asking (e.g. the item is gone)
     */
    async close({ force = false } = {}) {
      if (!isOpen || closing) return false;
      if (!force && beforeClose) {
        closing = true;                              // no second close while it asks
        const may = await beforeClose();
        closing = false;
        if (!may || !isOpen) return false;
      }
      closing = true;
      asked = true;
      goBack();
      return true;
    },
  };

  layer.addEventListener('click', (e) => {
    if (closest(e, '[data-close]')) sheet.close();
  });
  enableDragToClose(panel, () => sheet.close());

  return sheet;
}
