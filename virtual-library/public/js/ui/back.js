// The phone's back button (and the Home Assistant app's) undoes the last thing opened — a sheet,
// or a category — instead of leaving the page. Each opened thing adds a history entry and a handler;
// going back runs the newest handler.

const handlers = [];

window.addEventListener('popstate', () => handlers.pop()?.());

/** Adds a history entry; `onBack` runs when the user goes back past it. */
export function pushBack(onBack) {
  handlers.push(onBack);
  history.pushState({ depth: handlers.length }, '');
}

/** Goes back one step, the same as the back button. */
export function goBack() {
  history.back();
}
