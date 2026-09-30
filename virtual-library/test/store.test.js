import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { JsonFileStore } from '../src/store.js';

let dir;
let file;
const silent = { warn() {} };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-store-'));
  file = path.join(dir, 'nested', 'state.json');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('load returns null when there is no file yet', () => {
  assert.equal(new JsonFileStore(file).load(), null);
});

test('save is debounced, flush writes the latest document and creates folders', () => {
  const store = new JsonFileStore(file, { debounceMs: 10_000 });
  const doc = { n: 1 };
  store.save(doc);
  doc.n = 2;                          // serialized at write time
  assert.equal(fs.existsSync(file), false);
  store.flush();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { n: 2 });
  assert.equal(fs.existsSync(`${file}.tmp`), false);
  assert.deepEqual(new JsonFileStore(file).load(), { n: 2 });
});

test('an unreadable file is moved aside, not lost', () => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ broken');
  assert.equal(new JsonFileStore(file, { logger: silent }).load(), null);
  const aside = fs.readdirSync(path.dirname(file)).filter((f) => f.includes('.corrupt-'));
  assert.equal(aside.length, 1);
});
