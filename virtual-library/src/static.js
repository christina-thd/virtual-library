import fs from 'node:fs';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/** Resolves `relative` inside `root`, or returns null if it would escape it (e.g. `../`). */
export function resolveInside(root, relative) {
  const base = path.resolve(root);
  const full = path.resolve(base, `.${path.sep}${relative}`);
  return full.startsWith(base + path.sep) ? full : null;
}

/** Parses a single `bytes=start-end` range. Returns null for none, false if it can't be satisfied. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  } else {
    start = Math.max(size - Number(match[2]), 0);   // suffix: the last N bytes
    end = size - 1;
  }
  return start <= end && start < size ? { start, end } : false;
}

/**
 * Streams a file with its content type, supporting byte ranges.
 * Calls `onMissing` if the file doesn't exist or its type isn't served.
 * `cacheControl` defaults to always revalidating: the app is updated in place, so updates show up on reload.
 */
export function sendFile(req, res, file, onMissing, { cacheControl = 'no-cache' } = {}) {
  const type = MIME_TYPES[path.extname(file).toLowerCase()];
  if (!type) return onMissing();
  fs.stat(file, (err, stats) => {
    if (err || !stats.isFile()) return onMissing();
    const headers = {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    };

    const range = parseRange(req.headers.range, stats.size);
    if (range === false) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stats.size}` });
      return res.end();
    }
    if (range) {
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${stats.size}`,
        'Content-Length': range.end - range.start + 1,
      });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, range).pipe(res);
    }

    res.writeHead(200, { ...headers, 'Content-Length': stats.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
