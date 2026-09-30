// Bottom sheets. The page needs, per sheet:
//   <div class="layer" hidden><div class="backdrop" data-close></div><section class="sheet">…</section></div>
// Sheets can stack (the item sheet opens on top of search); the back button closes the top one.
import { goBack, pushBack } from './back.js';

let open = 0;                       // sheets open right now: the page doesn't scroll behind them

export function createSheet(layer, { onClose } = {}) {
  const panel = layer.querySelector('.sheet');
  let isOpen = false;
  let closing = false;              // going back is asynchronous: don't go back twice

  function hide() {
    isOpen = false;
    closing = false;
    if (--open === 0) document.body.classList.remove('locked');
    layer.classList.remove('open');
    const done = () => { if (!isOpen) layer.hidden = true; };
    panel.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400);                          // in case the transition doesn't run
    onClose?.();
  }

  const sheet = {
    get isOpen() {
      return isOpen;
    },

    open() {
      if (isOpen) return;
      isOpen = true;
      open++;
      pushBack(hide);
      document.body.classList.add('locked');
      layer.hidden = false;
      void panel.offsetHeight;                      // apply the closed position first, so it slides in
      layer.classList.add('open');
    },

    /** Closes through history, so the entry added by open() goes away too. */
    close() {
      if (!isOpen || closing) return;
      closing = true;
      goBack();
    },
  };

  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) sheet.close();
  });

  return sheet;
}
