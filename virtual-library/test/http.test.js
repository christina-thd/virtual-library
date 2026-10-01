import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { SearchError } from '../src/catalog/index.js';
import { ROOT_DIR } from '../src/config.js';
import { CoverStore } from '../src/covers.js';
import { UpstreamError } from '../src/http-client.js';
import { createInitialState } from '../src/library/state.js';
import { JsonFileStore } from '../src/store.js';

const IMAGE = 'https://img.example/dark.jpg';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** A catalog that knows one series, and fails for the query "down". */
const catalog = {
  sources: { series: [{ id: 'all', label: null, icon: null, credits: [{ id: 'fake', name: 'Fake', url: 'https://fake.example/' }] }] },
  isAllowedImage: (url) => url.startsWith('https://img.example/'),
  async search(category, query, source) {
    if (category !== 'series') throw new SearchError('category must be series');
    if (source) throw new SearchError(`asked ${source}`);
    if (query === 'down') throw new UpstreamError('api.example did not answer');
    return [{ category, title: 'Dark', year: 2017, creator: 'Netflix', source: { provider: 'fake', id: '1' }, coverUrl: IMAGE, thumbUrl: IMAGE }];
  },
};

let server;
let app;
let base;
let dir;
let state;
let covers;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-http-'));
  const config = { version: 'test', stateFile: path.join(dir, 'library.json'), publicDir: path.join(ROOT_DIR, 'public') };
  const imageHttp = { image: async () => ({ type: 'image/jpeg', body: JPEG }) };
  covers = new CoverStore(path.join(dir, 'covers'), { http: imageHttp });
  state = createInitialState();
  app = createApp({ config, state, store: new JsonFileStore(config.stateFile, { debounceMs: 0 }), catalog, covers, logger: { error() {}, warn() {} } });
  server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.hub.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (body) => fetch(`${base}/api/actions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('pages and static files', () => {
  test('the page, modules, styles and images are served with the right types', async () => {
    for (const [url, type] of [['/', 'text/html'], ['/js/app.js', 'text/javascript'], ['/js/library/search.js', 'text/javascript'],
      ['/js/shared/library.js', 'text/javascript'], ['/css/base.css', 'text/css'], ['/img/logo.svg', 'image/svg']]) {
      const res = await fetch(base + url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers.get('content-type'), new RegExp(type));
      assert.equal(res.headers.get('cache-control'), 'no-cache', url);
    }
  });

  test('cannot read files outside public/ or the covers folder', async () => {
    for (const url of ['/js/../../package.json', '/js/%2e%2e/%2e%2e/package.json', '/css/..%2F..%2Fsrc/app.js', '/js/%E0%A4%A',
      '/covers/../library.json', '/covers/%2e%2e%2flibrary.json', '/covers/abc.json']) {
      const res = await fetch(base + url);
      assert.ok([400, 404].includes(res.status), `${url} → ${res.status}`);
    }
  });

  test('unknown paths are 404', async () => {
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  });

  test('the web app manifest opens in portrait, and its icons exist', async () => {
    const res = await fetch(`${base}/manifest.webmanifest`);
    assert.match(res.headers.get('content-type'), /application\/manifest\+json/);
    const manifest = await res.json();
    assert.equal(manifest.orientation, 'portrait');
    for (const icon of manifest.icons) assert.equal((await fetch(`${base}/${icon.src}`)).status, 200, icon.src);
  });

  test('info lists the categories and who searches them', async () => {
    const info = await (await fetch(`${base}/api/info`)).json();
    assert.equal(info.version, 'test');
    assert.deepEqual(info.categories.map((c) => c.id), ['movie', 'series', 'book', 'game']);
    assert.equal(info.sources.series[0].credits[0].name, 'Fake');
  });
});

describe('search API', () => {
  test('returns the catalog results', async () => {
    const res = await fetch(`${base}/api/search?category=series&q=dark`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).results[0].title, 'Dark');
  });

  test('passes on which source to ask (games: pc or nintendo)', async () => {
    const res = await fetch(`${base}/api/search?category=series&q=dark&source=nintendo`);
    assert.equal((await res.json()).error, 'asked nintendo');
  });

  test('a bad search is 400, a catalog that is down is 502', async () => {
    const bad = await fetch(`${base}/api/search?category=podcast&q=x`);
    assert.equal(bad.status, 400);
    const down = await fetch(`${base}/api/search?category=series&q=down`);
    assert.equal(down.status, 502);
    assert.match((await down.json()).error, /unavailable/);
  });
});

describe('actions API', () => {
  test('adding a search result saves its cover, served from the add-on', async () => {
    const [result] = (await (await fetch(`${base}/api/search?category=series&q=dark`)).json()).results;
    const res = await post({ type: 'addItem', ...result, status: 'done', rating: 5 });
    assert.equal(res.status, 200);
    const { itemId } = await res.json();

    await app.syncCovers();
    const item = state.items.find((i) => i.id === itemId);
    assert.equal(item.cover, `${itemId}.jpg`);

    const cover = await fetch(`${base}/covers/${item.cover}`);
    assert.equal(cover.status, 200);
    assert.equal(cover.headers.get('content-type'), 'image/jpeg');
    assert.match(cover.headers.get('cache-control'), /immutable/);
    assert.deepEqual(Buffer.from(await cover.arrayBuffer()), JPEG);
  });

  test('the same result cannot be added twice', async () => {
    const [result] = (await (await fetch(`${base}/api/search?category=series&q=dark`)).json()).results;
    const res = await post({ type: 'addItem', ...result });
    assert.equal(res.status, 409);
  });

  test('rejects bad input with a clear error', async () => {
    for (const [body, status] of [['{ nope', 400], [{ type: 'deleteEverything' }, 400], [{ type: 'removeItem', itemId: 'ghost' }, 404]]) {
      const res = await post(body);
      assert.equal(res.status, status);
      assert.ok((await res.json()).error);
    }
  });

  test('removing an item deletes its saved cover', async () => {
    const item = state.items.find((i) => i.cover);
    assert.equal((await post({ type: 'removeItem', itemId: item.id })).status, 200);
    assert.ok(!fs.existsSync(covers.pathOf(item.cover)));
  });

  test('only POST is allowed', async () => {
    assert.equal((await fetch(`${base}/api/actions`)).status, 405);
  });
});

describe('live updates', () => {
  test('a new connection immediately receives the library', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/events`, { signal: controller.signal });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    const { value } = await reader.read();
    controller.abort();
    const view = JSON.parse(new TextDecoder().decode(value).replace(/^data: /, ''));
    assert.equal(view.version, 'test');
    assert.ok(Array.isArray(view.items));
  });
});
