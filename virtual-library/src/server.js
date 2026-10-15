#!/usr/bin/env node
// Hoard Board: movies, series, books, comics and games you've finished or still have pending.
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app.js';
import { chooseProviders, createCatalog } from './catalog/index.js';
import { loadConfig } from './config.js';
import { CoverStore } from './covers.js';
import { createHttpClient } from './http-client.js';
import { normalizeState } from './library/state.js';
import { JsonFileStore } from './store.js';
import { readTls, watchTls } from './tls.js';

const config = loadConfig();
const store = new JsonFileStore(config.stateFile);
const saved = store.load();
const state = normalizeState(saved);
// the stats' start date is set on the first run with stats: save it now, so a restart doesn't move it
if (saved && saved.statsSince !== state.statsSince) store.save(state);

const client = createHttpClient({ userAgent: `HoardBoard/${config.version} (Home Assistant add-on)` });
const providers = chooseProviders({ tmdbApiKey: config.tmdbApiKey, rawgApiKey: config.rawgApiKey });
const catalog = createCatalog({ http: client, providers });
const covers = new CoverStore(config.coversDir, { http: client });

const app = createApp({ config, state, store, catalog, covers });
const servers = [http.createServer(app.handle)];

servers[0].listen(config.port, config.host, () => {
  console.log(`Hoard Board ${config.version}`);
  console.log(`  Open:     http://localhost:${config.port}/`);
  console.log(`  Library:  ${config.stateFile} (${state.items.length} items)`);
  const searchedOn = (s) => (s.label ? `${s.label}: ` : '') + s.credits.map((c) => c.name).join(' / ');
  console.log(`  Search:   ${Object.entries(catalog.sources).map(([category, list]) => `${category} → ${list.map(searchedOn).join(' · ')}`).join(', ')}`);
  app.syncCovers();                                  // covers that couldn't be saved last time
  app.syncDetails();                                 // details not looked up yet, or a week old
});

// Optional https, so Android can install the app. http keeps working either way.
if (config.httpsPort && config.tlsCert && config.tlsKey) {
  try {
    const secure = https.createServer(readTls(config), app.handle);
    secure.on('error', (err) => console.warn(`https not available: ${err.message}`));
    secure.listen(config.httpsPort, config.host, () => console.log(`  Secure:   https on port ${config.httpsPort}`));
    watchTls(secure, config);
    servers.push(secure);
  } catch (err) {
    console.warn(`https not available: ${err.message}`);
  }
}

// Save anything pending and close connections before exiting (Ctrl+C, add-on stop).
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  store.flush();
  app.hub.close();
  let open = servers.length;
  for (const server of servers) server.close(() => { if (--open === 0) process.exit(0); });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
