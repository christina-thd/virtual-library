#!/usr/bin/env node
// Hoard Board: movies, series, books and games you've finished or still have pending.
import http from 'node:http';
import { createApp } from './app.js';
import { chooseProviders, createCatalog } from './catalog/index.js';
import { loadConfig } from './config.js';
import { CoverStore } from './covers.js';
import { createHttpClient } from './http-client.js';
import { normalizeState } from './library/state.js';
import { JsonFileStore } from './store.js';

const config = loadConfig();
const store = new JsonFileStore(config.stateFile);
const state = normalizeState(store.load());

const client = createHttpClient({ userAgent: `HoardBoard/${config.version} (Home Assistant add-on)` });
const providers = chooseProviders({ tmdbApiKey: config.tmdbApiKey, rawgApiKey: config.rawgApiKey });
const catalog = createCatalog({ http: client, providers });
const covers = new CoverStore(config.coversDir, { http: client });

const app = createApp({ config, state, store, catalog, covers });
const server = http.createServer(app.handle);

server.listen(config.port, config.host, () => {
  console.log(`Hoard Board ${config.version}`);
  console.log(`  Open:     http://localhost:${config.port}/`);
  console.log(`  Library:  ${config.stateFile} (${state.items.length} items)`);
  console.log(`  Search:   ${Object.entries(catalog.credits).map(([category, list]) => `${category} → ${list.map((c) => c.name).join(' / ')}`).join(', ')}`);
  app.syncCovers();                                  // covers that couldn't be saved last time
});

// Save anything pending and close connections before exiting (Ctrl+C, add-on stop).
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  store.flush();
  app.hub.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
