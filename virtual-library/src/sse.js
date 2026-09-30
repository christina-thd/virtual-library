/**
 * Server-Sent Events hub: every open page keeps one connection and receives the full view
 * whenever something changes. A comment line is sent periodically so proxies (and Home
 * Assistant ingress) don't close idle connections.
 */
export class SseHub {
  #clients = new Set();
  #heartbeat;

  constructor({ heartbeatMs = 20_000 } = {}) {
    this.#heartbeat = setInterval(() => this.#send(': ping\n\n'), heartbeatMs);
    this.#heartbeat.unref?.();
  }

  get size() {
    return this.#clients.size;
  }

  connect(req, res, initialData) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(SseHub.#format(initialData));
    this.#clients.add(res);
    req.on('close', () => this.#clients.delete(res));
  }

  broadcast(data) {
    this.#send(SseHub.#format(data));
  }

  close() {
    clearInterval(this.#heartbeat);
    for (const res of this.#clients) res.end();
    this.#clients.clear();
  }

  #send(chunk) {
    for (const res of this.#clients) res.write(chunk);
  }

  static #format(data) {
    return `data: ${JSON.stringify(data)}\n\n`;
  }
}
