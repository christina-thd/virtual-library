import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * Environment variables (the Home Assistant add-on sets them in run.sh):
 *   PORT          port to listen on (default 3100)
 *   HOST          interface to bind (default all)
 *   STATE_FILE    where the library is saved (default ./data/library.json)
 *   COVERS_DIR    where cover images are saved (default ./data/covers)
 *   TMDB_API_KEY  optional: search movies and series on TMDB first (then Cinemeta / TVmaze)
 *   RAWG_API_KEY  optional: search games on RAWG (all platforms) first (then Steam / GOG)
 */
export function loadConfig(env = process.env) {
  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

  return Object.freeze({
    version: pkg.version,
    port: parsePort(env.PORT) ?? 3100,
    host: env.HOST || '0.0.0.0',
    stateFile: env.STATE_FILE || path.join(ROOT_DIR, 'data', 'library.json'),
    coversDir: env.COVERS_DIR || path.join(ROOT_DIR, 'data', 'covers'),
    tmdbApiKey: env.TMDB_API_KEY || null,
    rawgApiKey: env.RAWG_API_KEY || null,
    publicDir: path.join(ROOT_DIR, 'public'),
  });
}
