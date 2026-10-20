// Keeps --viewport-top and --viewport-height on the page equal to the part of the screen you can see,
// which shrinks when the keyboard opens. Sheets are sized from them (css/base.css), so the search sheet
// sits right above the keyboard instead of sliding under it. Phones without visualViewport keep the
// CSS fallbacks (the full screen).

const FIELD_MARGIN_PX = 16;

/** The nearest parent that scrolls (a sheet's content), or null. */
function scrollerOf(el) {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

/**
 * The field being typed in, scrolled into its sheet's visible part. A sheet shrinks when the keyboard opens but keeps
 * its scroll position, so a field low in it (a note, where you left off) would end up under its bottom edge.
 */
export function keepFieldInView() {
  const field = document.activeElement;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  const scroller = scrollerOf(field);
  if (!scroller) return;
  const box = scroller.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  if (rect.bottom > box.bottom - FIELD_MARGIN_PX) scroller.scrollTop += rect.bottom - box.bottom + FIELD_MARGIN_PX;
  else if (rect.top < box.top + FIELD_MARGIN_PX) scroller.scrollTop -= box.top - rect.top + FIELD_MARGIN_PX;
}

export function trackVisibleViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement.style;

  function update() {
    root.setProperty('--viewport-top', `${viewport.offsetTop}px`);
    root.setProperty('--viewport-height', `${viewport.height}px`);
    requestAnimationFrame(keepFieldInView);         // once the sheet has its new size
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  update();

  if (/** @type {any} */ (navigator).standalone) {
    const settle = () => {
      const { scrollY } = window;
      window.scrollTo(0, scrollY + 1);
      window.scrollTo(0, scrollY);
      update();
    };
    window.addEventListener('load', () => requestAnimationFrame(settle), { once: true });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) requestAnimationFrame(settle);
    });
  }
}
