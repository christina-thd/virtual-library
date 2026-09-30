import path from 'node:path';
import { CATEGORIES } from '../public/js/shared/library.js';
import { SearchError } from './catalog/index.js';
import { createCoverSync } from './covers.js';
import { UpstreamError } from './http-client.js';
import { ActionError, applyAction } from './library/actions.js';
import { toView } from './library/state.js';
import { SseHub } from './sse.js';
import { resolveInside, sendFile } from './static.js';

const MAX_BODY_BYTES = 10 * 1024;

const PAGES = {
  '/': 'index.html',
  '/manifest.webmanifest': 'manifest.webmanifest',
};
const STATIC_DIRS = ['/css/', '/js/', '/img/'];

// A saved cover never changes (a new item gets a new file), so phones can keep it.
const COVER_CACHE = 'public, max-age=31536000, immutable';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(json);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Builds the request handler.
 *
 *   GET  /                 the library
 *   GET  /manifest.webmanifest   web app manifest ("Add to Home Screen" opens it like an app)
 *   GET  /css/*, /js/*, /img/*   static files
 *   GET  /covers/<file>    saved cover images
 *   GET  /api/info         { version, categories, credits }
 *   GET  /api/events       live view (Server-Sent Events)
 *   GET  /api/search?category=movie&q=dune   search a catalog: { results }
 *   POST /api/actions      apply one action, e.g. { "type": "setStatus", "itemId": "…", "status": "done" }
 */
export function createApp({
  config, state, store, catalog, covers,
  hub = new SseHub(), now = Date.now, logger = console,
}) {
  const view = () => toView(state, config.version);

  function changed() {
    store.save(state);
    hub.broadcast(view());
  }

  const coverSync = createCoverSync({ state, covers, onChange: changed, logger });

  async function dispatch(req, res) {
    const action = await readJsonBody(req);
    const result = applyAction(state, action, { now: now(), allowImage: catalog.isAllowedImage });
    changed();
    sendJson(res, 200, result);
    coverSync.sync();
  }

  async function search(res, searchParams) {
    const results = await catalog.search(searchParams.get('category'), searchParams.get('q'));
    sendJson(res, 200, { results });
  }

  function notFound(res) {
    sendJson(res, 404, { error: 'Not found' });
  }

  function sendCover(req, res, pathname) {
    const file = covers.pathOf(pathname.slice('/covers/'.length));
    return file ? sendFile(req, res, file, () => notFound(res), { cacheControl: COVER_CACHE }) : notFound(res);
  }

  async function route(req, res) {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    const method = req.method;

    if (pathname === '/api/actions') {
      if (method !== 'POST') throw new HttpError(405, 'Use POST');
      return dispatch(req, res);
    }
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed');

    if (pathname === '/api/events') return hub.connect(req, res, view());
    if (pathname === '/api/search') return search(res, searchParams);
    if (pathname === '/api/info') {
      return sendJson(res, 200, { version: config.version, categories: CATEGORIES, credits: catalog.credits });
    }
    if (pathname.startsWith('/covers/')) return sendCover(req, res, pathname);
    if (Object.hasOwn(PAGES, pathname)) {
      return sendFile(req, res, path.join(config.publicDir, PAGES[pathname]), () => notFound(res));
    }
    if (STATIC_DIRS.some((dir) => pathname.startsWith(dir))) {
      let decoded;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        throw new HttpError(400, 'Malformed path');
      }
      const file = resolveInside(config.publicDir, decoded);
      return file ? sendFile(req, res, file, () => notFound(res)) : notFound(res);
    }
    return notFound(res);
  }

  async function handle(req, res) {
    try {
      await route(req, res);
    } catch (err) {
      if (err instanceof ActionError || err instanceof HttpError || err instanceof SearchError) {
        return sendJson(res, err.status, { error: err.message });
      }
      if (err instanceof UpstreamError) {
        logger.warn(`Search failed: ${err.message}`);
        return sendJson(res, err.status, { error: `Search is unavailable right now (${err.message})` });
      }
      logger.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
      else res.end();
    }
  }

  return { handle, hub, syncCovers: () => coverSync.sync() };
}
