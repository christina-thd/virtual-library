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
  async function request(url, headers, timeout = timeoutMs, body = undefined) {
    let res;
    try {
      res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'User-Agent': userAgent, ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new UpstreamError(`${hostOf(url)} did not answer`);
    }
    if (!res.ok) throw new UpstreamError(`${hostOf(url)} answered ${res.status}`);
    return res;
  }

  return {
    /**
     * @param {string} url
     * @param {{ headers?: Record<string, string>, timeoutMs?: number, body?: unknown }} [options]
     *   timeoutMs: shorter, for nice-to-haves; body: sent as JSON, in a POST
     */
    async json(url, { headers = {}, timeoutMs: timeout, body } = {}) {
      const res = await request(url, { Accept: 'application/json', ...headers }, timeout, body);
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
