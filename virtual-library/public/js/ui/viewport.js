// Keeps --viewport-top and --viewport-height on the page equal to the part of the screen you can see,
// which shrinks when the keyboard opens. Sheets are sized from them (css/base.css), so the search sheet
// sits right above the keyboard instead of sliding under it. Phones without visualViewport keep the
// CSS fallbacks (the full screen).

export function trackVisibleViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement.style;

  function update() {
    root.setProperty('--viewport-top', `${viewport.offsetTop}px`);
    root.setProperty('--viewport-height', `${viewport.height}px`);
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  update();
}
