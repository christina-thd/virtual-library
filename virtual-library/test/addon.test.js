// Checks that the Home Assistant add-on files agree with each other and with the app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ROOT_DIR } from '../src/config.js';

const read = (file) => fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
const yamlValue = (yaml, key) => yaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, 'm'))?.[1];
const block = (yaml, name) => yaml.split(new RegExp(`^${name}:\\n`, 'm'))[1]?.split(/^\S/m)[0] ?? '';
const keys = (text) => [...text.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]).sort();

const config = read('config.yaml');
const pkg = JSON.parse(read('package.json'));

test('config.yaml and package.json have the same version', () => {
  assert.equal(yamlValue(config, 'version'), pkg.version);
});

test('the changelog has an entry for this version', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')}$`, 'm'));
});

test('run.sh starts the app on the ingress port', () => {
  const run = read('run.sh');
  assert.equal(run.match(/^export PORT=(\d+)/m)?.[1], yamlValue(config, 'ingress_port'));
  assert.match(run, /^#!\/usr\/bin\/with-contenv bashio\n/);
  assert.match(run, /exec node \/app\/src\/server\.js/);
});

test('the direct port and the Dockerfile use the same port as the app', () => {
  const port = yamlValue(config, 'ingress_port');
  assert.deepEqual(keys(block(config, 'ports').replace(/^ {2}(\d+)\/tcp:/gm, '  p$1:')), [`p${port}`]);
  assert.match(read('Dockerfile'), new RegExp(`^EXPOSE ${port}/tcp$`, 'm'));
});

test('the library is kept in the add-on data folder', () => {
  const run = read('run.sh');
  assert.match(run, /^export STATE_FILE="\/data\//m);
  assert.match(run, /^export COVERS_DIR="\/data\//m);
});

test('run.sh has Unix line endings (it runs in a Linux container)', () => {
  assert.ok(!read('run.sh').includes('\r'));
});

test('everything the Dockerfile copies exists', () => {
  const sources = [...read('Dockerfile').matchAll(/^COPY (.+) \S+$/gm)].flatMap((m) => m[1].split(/\s+/));
  assert.ok(sources.length > 0);
  for (const source of sources) assert.ok(fs.existsSync(path.join(ROOT_DIR, source)), source);
});

test('the app needs no npm packages (the Dockerfile installs none)', () => {
  assert.equal(pkg.dependencies, undefined);
});

test('every option has a schema entry, and run.sh reads each one', () => {
  assert.deepEqual(keys(block(config, 'options')), keys(block(config, 'schema')));
  const run = read('run.sh');
  for (const option of keys(block(config, 'options'))) assert.match(run, new RegExp(`bashio::config '${option}'`), option);
});

test('API keys are hidden in the add-on configuration', () => {
  for (const line of block(config, 'schema').trim().split('\n')) assert.match(line, /: "password\?"$/, line);
});

test('the Dockerfile builds without BUILD_FROM (newer Supervisors only pass BUILD_ARCH)', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /^ARG BUILD_ARCH=\S+$/m);
  assert.match(dockerfile, /^ARG BUILD_FROM=ghcr\.io\/home-assistant\/\$\{BUILD_ARCH\}-base:\S+$/m);
});

test('store images are PNGs of the sizes Home Assistant expects', () => {
  const pngSize = (file) => {
    const png = fs.readFileSync(path.join(ROOT_DIR, file));
    assert.equal(png.toString('latin1', 1, 4), 'PNG', `${file} is not a PNG`);
    return [png.readUInt32BE(16), png.readUInt32BE(20)];   // IHDR width, height
  };
  assert.deepEqual(pngSize('icon.png'), [128, 128]);
  assert.deepEqual(pngSize('logo.png'), [250, 100]);
});
