import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createCoverSync, CoverStore } from '../src/covers.js';
import { createHttpClient, UpstreamError } from '../src/http-client.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const silent = { warn() {} };

/** A fetch that answers from `routes` (URL → { status, type, body }) and records requests. */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const route = routes[url];
    if (!route) throw new TypeError('fetch failed');
    return new Response(route.body ?? JPEG, { status: route.status ?? 200, headers: { 'Content-Type': route.type ?? 'image/jpeg' } });
  };
  return { fetch, calls };
}

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-covers-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('http client', () => {
  test('sends a User-Agent and a timeout; errors name the host but not the URL (it may hold a key)', async () => {
    const { fetch, calls } = fakeFetch({ 'https://api.example/secret?key=hunter2': { status: 500, type: 'application/json', body: '{}' } });
    const http = createHttpClient({ fetch, userAgent: 'Test/1' });
    await assert.rejects(http.json('https://api.example/secret?key=hunter2'), (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.equal(err.message, 'api.example answered 500');
      return true;
    });
    assert.equal(calls[0].options.headers['User-Agent'], 'Test/1');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    await assert.rejects(http.json('https://down.example/?key=hunter2'), /down\.example did not answer/);
  });

  test('json() with a body sends it as JSON, in a POST', async () => {
    const { fetch, calls } = fakeFetch({ 'https://api.example/search': { type: 'application/json', body: '{"ok":true}' } });
    const http = createHttpClient({ fetch });
    assert.deepEqual(await http.json('https://api.example/search', { body: { search: 'One Piece' } }), { ok: true });
    assert.deepEqual([calls[0].options.method, calls[0].options.body, calls[0].options.headers['Content-Type']],
      ['POST', '{"search":"One Piece"}', 'application/json']);
    await http.json('https://api.example/search');
    assert.equal(calls[1].options.method, 'GET');
  });

  test('image() rejects things that are not images, or too big', async () => {
    const { fetch } = fakeFetch({
      'https://img.example/page': { type: 'text/html', body: '<html>' },
      'https://img.example/big.jpg': { body: Buffer.alloc(2000) },
    });
    const http = createHttpClient({ fetch });
    await assert.rejects(http.image('https://img.example/page', { maxBytes: 1000 }), /did not send an image/);
    await assert.rejects(http.image('https://img.example/big.jpg', { maxBytes: 1000 }), /too large/);
  });
});

describe('CoverStore', () => {
  test('saves an image as <item id>.<ext>, atomically', async () => {
    const { fetch } = fakeFetch({ 'https://img.example/a': { type: 'image/webp; charset=binary' } });
    const covers = new CoverStore(path.join(dir, 'covers'), { http: createHttpClient({ fetch }) });
    const file = await covers.download('abc123', 'https://img.example/a');
    assert.equal(file, 'abc123.webp');
    assert.deepEqual(fs.readFileSync(covers.pathOf(file)), JPEG);
    assert.deepEqual(fs.readdirSync(covers.dir), ['abc123.webp']);   // no temp file left
  });

  test('refuses image types it does not serve', async () => {
    const { fetch } = fakeFetch({ 'https://img.example/a.gif': { type: 'image/gif' } });
    const covers = new CoverStore(dir, { http: createHttpClient({ fetch }) });
    await assert.rejects(covers.download('abc', 'https://img.example/a.gif'), /Unsupported image type/);
  });

  test('pathOf only accepts cover file names', () => {
    const covers = new CoverStore(dir, { http: null });
    assert.equal(covers.pathOf('abc.jpg'), path.join(dir, 'abc.jpg'));
    for (const name of ['../state.json', 'abc.jpg/../x', 'ABC.jpg', 'abc.html', '']) assert.equal(covers.pathOf(name), null, name);
  });

  test('prune deletes covers no item uses, and nothing else', () => {
    for (const f of ['aaa.jpg', 'bbb.png', 'notes.txt']) fs.writeFileSync(path.join(dir, f), 'x');
    new CoverStore(dir, { http: null }).prune(new Set(['aaa.jpg']));
    assert.deepEqual(fs.readdirSync(dir).sort(), ['aaa.jpg', 'notes.txt']);
    new CoverStore(path.join(dir, 'missing'), { http: null }).prune(new Set());   // no folder yet: fine
  });
});

describe('cover sync', () => {
  const item = (id, imageUrls, extra = {}) => ({ id, title: id, imageUrls, cover: null, ...extra });

  function setup(routes, items) {
    const { fetch, calls } = fakeFetch(routes);
    const state = { items };
    let changes = 0;
    const covers = new CoverStore(dir, { http: createHttpClient({ fetch }) });
    const sync = createCoverSync({ state, covers, onChange: () => changes++, logger: silent });
    return { state, sync, calls, changes: () => changes };
  }

  test('downloads missing covers, trying each image until one works', async () => {
    const { state, sync, calls, changes } = setup({
      'https://img.example/ok.jpg': {},
      'https://img.example/fallback.jpg': {},
    }, [
      item('aaa', ['https://img.example/ok.jpg']),
      item('bbb', ['https://img.example/missing.jpg', 'https://img.example/fallback.jpg']),
      item('ccc', []),
    ]);
    await sync.sync();
    assert.deepEqual(state.items.map((i) => i.cover), ['aaa.jpg', 'bbb.jpg', null]);
    assert.equal(changes(), 2);
    assert.equal(calls.length, 3);

    await sync.sync();                               // nothing left to do
    assert.equal(calls.length, 3);
  });

  test('an item whose images all fail is not retried until the next start', async () => {
    const { state, sync, calls } = setup({}, [item('aaa', ['https://img.example/gone.jpg'])]);
    await sync.sync();
    await sync.sync();
    assert.equal(state.items[0].cover, null);
    assert.equal(calls.length, 1);
  });

  test('deletes the covers of removed items', async () => {
    const { state, sync } = setup({ 'https://img.example/a.jpg': {} }, [item('aaa', ['https://img.example/a.jpg'])]);
    await sync.sync();
    assert.ok(fs.existsSync(path.join(dir, 'aaa.jpg')));
    state.items = [];
    await sync.sync();
    assert.ok(!fs.existsSync(path.join(dir, 'aaa.jpg')));
  });

  test('an item removed while its cover downloads leaves no file behind', async () => {
    const { state, sync } = setup({ 'https://img.example/a.jpg': {} }, [item('aaa', ['https://img.example/a.jpg'])]);
    const running = sync.sync();
    state.items = [];
    await running;
    assert.deepEqual(fs.readdirSync(dir), []);
  });
});
