import fs from 'node:fs';
import path from 'node:path';
import { COVER_FILE } from './library/state.js';

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Saved copies of the cover images, one file per item (`<item id>.jpg`), so the library keeps its
 * pictures even if a catalog changes its links, and phones load them from the add-on.
 */
export class CoverStore {
  #dir;
  #http;
  #maxBytes;

  constructor(dir, { http, maxBytes = 5 * 1024 * 1024 }) {
    this.#dir = dir;
    this.#http = http;
    this.#maxBytes = maxBytes;
  }

  get dir() {
    return this.#dir;
  }

  /** Full path of a saved cover, or null if `file` isn't a cover file name. */
  pathOf(file) {
    return COVER_FILE.test(file) ? path.join(this.#dir, file) : null;
  }

  /** Downloads the image for an item and returns the saved file name. Written atomically. */
  async download(itemId, url) {
    const { type, body } = await this.#http.image(url, { maxBytes: this.#maxBytes });
    const extension = EXTENSIONS[type];
    if (!extension) throw new Error(`Unsupported image type ${type}`);
    const file = `${itemId}.${extension}`;
    fs.mkdirSync(this.#dir, { recursive: true });
    const temp = path.join(this.#dir, `${file}.tmp`);
    fs.writeFileSync(temp, body);
    fs.renameSync(temp, path.join(this.#dir, file));
    return file;
  }

  /** Deletes saved covers that no item uses any more. */
  prune(inUse) {
    let files;
    try {
      files = fs.readdirSync(this.#dir);
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const file of files) {
      if (COVER_FILE.test(file) && !inUse.has(file)) fs.rmSync(path.join(this.#dir, file), { force: true });
    }
  }
}

/**
 * Keeps every item's cover saved: downloads missing ones (one at a time, in the background) and
 * deletes the files of removed items. `sync()` is safe to call after every change.
 * Each of an item's image URLs is tried in turn. If none works, it's retried on the next start.
 * @param {{ state: any, covers: CoverStore, onChange: () => void, logger?: { warn(message: string): void } }} options
 */
export function createCoverSync({ state, covers, onChange, logger = console }) {
  const failed = new Set();
  let running = null;

  const nextMissing = () => state.items.find((i) => i.imageUrls.length && !i.cover && !failed.has(i.id));

  /** The first of the item's images that downloads, or null. */
  async function downloadFirst(item) {
    for (const url of item.imageUrls) {
      try {
        return await covers.download(item.id, url);
      } catch (err) {
        logger.warn(`Cover for "${item.title}" not saved from ${new URL(url).hostname}: ${err.message}`);
      }
    }
    return null;
  }

  async function downloadMissing() {
    for (let item = nextMissing(); item; item = nextMissing()) {
      const file = await downloadFirst(item);
      if (!file) failed.add(item.id);
      else if (!state.items.includes(item)) prune();   // removed while downloading
      else {
        item.cover = file;
        onChange();
      }
    }
  }

  function prune() {
    covers.prune(new Set(state.items.map((i) => i.cover).filter(Boolean)));
  }

  function sync() {
    prune();
    running ??= downloadMissing().finally(() => { running = null; });
    return running;
  }

  return { sync };
}
