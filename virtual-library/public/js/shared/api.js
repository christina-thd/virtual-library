// Client for the server API. Paths are relative so the app also works behind
// Home Assistant ingress (served under /api/hassio_ingress/<token>/).

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function sendAction(action) {
  const res = await fetch('api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return readJson(res);
}

/** { version, categories, credits } */
export const fetchInfo = () => fetch('api/info').then(readJson);

/** Search results for a category; pass an AbortSignal to cancel a search that's been replaced. */
export async function searchCatalog(category, query, signal) {
  const params = new URLSearchParams({ category, q: query });
  const { results } = await readJson(await fetch(`api/search?${params}`, { signal }));
  // e.g. a login or error page from a proxy instead of the add-on's answer
  if (!Array.isArray(results)) throw new Error('Search is unavailable right now (unexpected answer)');
  return results;
}

/**
 * Calls `onView` with the full view on connect and after every change.
 * If the server was updated to a new version while the page stayed open, reloads the page
 * so it never runs old code against the new server.
 */
export function subscribe(onView) {
  let version = null;
  const events = new EventSource('api/events');
  events.onmessage = (event) => {
    const view = JSON.parse(event.data);
    if (version && view.version !== version) {
      location.reload();
      return;
    }
    version = view.version;
    onView(view);
  };
  return events;
}
