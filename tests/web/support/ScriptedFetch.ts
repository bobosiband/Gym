import type { FetchLike } from '../../../apps/web/src/api/FetchHttpClient.js';

/**
 * One expected request/response pair.
 */
export interface ScriptEntry {
  readonly url: string;
  readonly method: string;
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Captured request so tests can assert on headers and payload.
 */
export interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly body: string | undefined;
  readonly headers: Record<string, string>;
}

/**
 * A `fetch` stub that returns scripted responses in order. Pop one
 * response per call; if the script runs out an assertion-friendly
 * error is thrown. Tests can read {@link requests} to assert the
 * request shape.
 */
export class ScriptedFetch {
  public readonly requests: RecordedRequest[] = [];
  private readonly script: ScriptEntry[];
  private cursor = 0;

  public constructor(script: readonly ScriptEntry[]) {
    this.script = [...script];
  }

  public asFetch(): FetchLike {
    return async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers: Record<string, string> = {};
      if (init?.headers !== undefined) {
        for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
          headers[k.toLowerCase()] = v;
        }
      }
      const bodyRaw = init?.body;
      const body = typeof bodyRaw === 'string' ? bodyRaw : undefined;
      this.requests.push({ url: input, method, body, headers });
      const entry = this.script[this.cursor];
      this.cursor += 1;
      if (entry === undefined) {
        throw new Error(`ScriptedFetch: unexpected request ${method} ${input}`);
      }
      if (entry.url !== input || entry.method !== method) {
        throw new Error(
          `ScriptedFetch: expected ${entry.method} ${entry.url}, got ${method} ${input}`
        );
      }
      const headerInit = new Headers({
        'content-type': 'application/json',
        ...(entry.headers ?? {}),
      });
      return new Response(entry.body === undefined ? null : JSON.stringify(entry.body), {
        status: entry.status,
        headers: headerInit,
      });
    };
  }

  public remaining(): number {
    return this.script.length - this.cursor;
  }
}
