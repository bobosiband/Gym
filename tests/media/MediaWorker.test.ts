import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Env } from '../../services/media/src/Env.js';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

/**
 * Integration tests for the media Worker running inside a Miniflare
 * isolate. Every test seeds the R2 bucket directly via the typed
 * `env.MEDIA` binding and then exercises the Worker's `fetch` entry.
 */

const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);

describe('MediaWorker', () => {
  beforeEach(async () => {
    const bucket = env.MEDIA as unknown as R2Bucket;
    const list = await bucket.list();
    await Promise.all(list.objects.map((object) => bucket.delete(object.key)));
  });

  it('serves /health without touching R2', async () => {
    const response = await SELF.fetch('https://host/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await SELF.fetch('https://host/not-a-route');
    expect(response.status).toBe(404);
  });

  it('returns 405 for POST on /media/<key>', async () => {
    const response = await SELF.fetch('https://host/media/pushups/01.gif', { method: 'POST' });
    expect(response.status).toBe(405);
  });

  it('answers CORS preflight for allow-listed origins', async () => {
    const response = await SELF.fetch('https://host/media/pushups/01.gif', {
      method: 'OPTIONS',
      headers: { origin: 'https://trusted.example' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://trusted.example');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('does not set CORS headers for an off-list origin', async () => {
    const response = await SELF.fetch('https://host/media/pushups/01.gif', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('streams a stored object with cache + CORS headers', async () => {
    const bucket = env.MEDIA as unknown as R2Bucket;
    await bucket.put('pushups/01.gif', gifBytes);
    const response = await SELF.fetch('https://host/media/pushups/01.gif', {
      headers: { origin: 'https://trusted.example' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/gif');
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://trusted.example');
    const buffer = new Uint8Array(await response.arrayBuffer());
    expect(buffer.length).toBe(gifBytes.length);
  });

  it('returns 404 when the stored object is missing', async () => {
    const response = await SELF.fetch('https://host/media/pushups/missing.gif');
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('rejects a key with a disallowed extension', async () => {
    const bucket = env.MEDIA as unknown as R2Bucket;
    await bucket.put('pushups/01.html', new Uint8Array([0x3c]));
    const response = await SELF.fetch('https://host/media/pushups/01.html');
    expect(response.status).toBe(400);
  });

  it('answers HEAD without a body', async () => {
    const bucket = env.MEDIA as unknown as R2Bucket;
    await bucket.put('pushups/01.gif', gifBytes);
    const response = await SELF.fetch('https://host/media/pushups/01.gif', { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(gifBytes.length));
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBe(0);
  });
});
