/** The catalog or an image host failed or answered with something unusable. Answered as 502. */
export class UpstreamError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamError';
    this.status = 502;
  }
}

const hostOf = (url) => new URL(url).hostname;

/**
 * Small wrapper around fetch for talking to the outside world: a timeout, a User-Agent,
 * and errors that name the host but never the full URL (it can contain an API key).
 */
export function createHttpClient({ fetch = globalThis.fetch, timeoutMs = 8000, userAgent = 'HoardBoard' } = {}) {
  async function request(url, headers) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': userAgent, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new UpstreamError(`${hostOf(url)} did not answer`);
    }
    if (!res.ok) throw new UpstreamError(`${hostOf(url)} answered ${res.status}`);
    return res;
  }

  return {
    async json(url, { headers = {} } = {}) {
      const res = await request(url, { Accept: 'application/json', ...headers });
      try {
        return await res.json();
      } catch {
        throw new UpstreamError(`${hostOf(url)} sent an invalid answer`);
      }
    },

    /** Downloads an image: { type, body }. Rejects anything that isn't an image or is larger than maxBytes. */
    async image(url, { maxBytes }) {
      const res = await request(url, { Accept: 'image/*' });
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/')) throw new UpstreamError(`${hostOf(url)} did not send an image`);
      if (Number(res.headers.get('content-length')) > maxBytes) throw new UpstreamError('Image is too large');
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > maxBytes) throw new UpstreamError('Image is too large');
      return { type, body };
    },
  };
}
