// Client for the server API. Paths are relative so the app also works behind
// Home Assistant ingress (served under /api/hassio_ingress/<token>/).
import { storage } from './storage.js';

const RETRY_MS = 5000;

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
  }).catch(() => {
    throw new Error("You're offline");                    // not "Load failed" (iPhone) or "Failed to fetch"
  });
  return readJson(res);
}

/** { version, categories, sources } */
export const fetchInfo = () => fetch('api/info').then(readJson);

/**
 * Search results for a category; pass an AbortSignal to cancel a search that's been replaced.
 * `source` picks one of the category's sources (games: "pc" or "nintendo"); the server's default when null.
 */
export async function searchCatalog(category, query, signal, source = null) {
  const params = new URLSearchParams({ category, q: query });
  if (source) params.set('source', source);
  const { results } = await readJson(await fetch(`api/search?${params}`, { signal }));
  // e.g. a login or error page from a proxy instead of the add-on's answer
  if (!Array.isArray(results)) throw new Error('Search is unavailable right now (unexpected answer)');
  return results;
}

/**
 * Calls `onView` with the full view on connect and after every change, and `onConnection` with true or false as
 * the connection comes and goes. If the server was updated to a new version while the page stayed open, reloads the
 * page so it never runs old code against the new server (and keeps the version, to say so after: `updatedTo`).
 * @param {(view: any) => void} onView
 * @param {(online: boolean) => void} [onConnection]
 */
export function subscribe(onView, onConnection = () => {}) {
  let version = null;
  function connect() {
    const events = new EventSource('api/events');
    events.onopen = () => onConnection(true);
    events.onmessage = (event) => {
      const view = JSON.parse(event.data);
      if (version && view.version !== version) {
        storage.set('updatedTo', view.version);
        location.reload();
        return;
      }
      version = view.version;
      onView(view);
    };
    events.onerror = () => {
      onConnection(false);
      // the browser retries by itself, but gives up on an error page (Home Assistant restarting): try again later
      if (events.readyState === EventSource.CLOSED) setTimeout(connect, RETRY_MS);
    };
  }
  connect();
}
