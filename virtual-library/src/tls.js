import fs from 'node:fs';

/**
 * The https certificate and key (PEM files).
 * @param {{ tlsCert: string, tlsKey: string }} config
 */
export const readTls = ({ tlsCert, tlsKey }) => ({ cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) });

/**
 * Loads a renewed certificate into the running https server, so it never has to be restarted for it
 * (Let's Encrypt certificates from Home Assistant are renewed every couple of months). Checks the files'
 * modification times; until both files are readable and match, it keeps the current one and tries again.
 * @param {{ setSecureContext(options: { cert: Buffer, key: Buffer }): void }} server
 * @param {{ tlsCert: string, tlsKey: string }} config
 * @param {{ intervalMs?: number, logger?: { log(message: string): void, warn(message: string): void } }} [options]
 * @returns {() => void} stops watching
 */
export function watchTls(server, config, { intervalMs = 10 * 60_000, logger = console } = {}) {
  const stamp = () => {
    try {
      return `${fs.statSync(config.tlsCert).mtimeMs}:${fs.statSync(config.tlsKey).mtimeMs}`;
    } catch {
      return null;           // being replaced right now: look again next time
    }
  };
  let loaded = stamp();
  const timer = setInterval(() => {
    const now = stamp();
    if (!now || now === loaded) return;
    try {
      server.setSecureContext(readTls(config));
      loaded = now;
      logger.log('https certificate reloaded');
    } catch (err) {
      logger.warn(`Could not load the renewed https certificate yet: ${err.message}`);
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
