import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { ROOT_DIR } from '../src/config.js';
import { watchTls } from '../src/tls.js';

const fixture = (name) => path.join(ROOT_DIR, 'test', 'fixtures', name);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const silent = { log() {}, warn() {} };

let dir;
let config;
let loads;
let stop;
const server = { setSecureContext: (options) => loads.push(options) };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-tls-'));
  config = { tlsCert: path.join(dir, 'cert.pem'), tlsKey: path.join(dir, 'key.pem') };
  fs.copyFileSync(fixture('tls-cert.pem'), config.tlsCert);
  fs.copyFileSync(fixture('tls-key.pem'), config.tlsKey);
  loads = [];
});

afterEach(() => {
  stop?.();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a renewed certificate is loaded into the running server', async () => {
  stop = watchTls(server, config, { intervalMs: 20, logger: silent });
  await wait(80);
  assert.equal(loads.length, 0);                                     // unchanged: nothing to do

  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(config.tlsCert, later, later);                        // "renewed"
  await wait(80);
  assert.equal(loads.length, 1);
  assert.deepEqual(loads[0].cert, fs.readFileSync(config.tlsCert));
  assert.deepEqual(loads[0].key, fs.readFileSync(config.tlsKey));
});

test('a certificate that is being replaced is tried again, and the old one kept meanwhile', async () => {
  let fail = true;
  const fussy = { setSecureContext: (options) => { if (fail) throw new Error('key does not match'); loads.push(options); } };
  stop = watchTls(fussy, config, { intervalMs: 20, logger: silent });
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(config.tlsCert, later, later);
  await wait(80);
  assert.equal(loads.length, 0);
  fail = false;                                                       // the key has been written too
  await wait(80);
  assert.equal(loads.length, 1);
});
