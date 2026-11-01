import { describe, expect, it } from 'vitest';

import { MediaHandler } from '../../services/media/src/media/MediaHandler.js';
import { InMemoryMediaRepository } from './support/InMemoryMediaRepository.js';

const MAX_AGE = 3600;

function newHandler(): { handler: MediaHandler; repo: InMemoryMediaRepository } {
  const repo = new InMemoryMediaRepository();
  const handler = new MediaHandler(repo, MAX_AGE);
  return { handler, repo };
}

describe('MediaHandler.handleGet', () => {
  it('streams the stored bytes with the right content type and cache headers', async () => {
    const { handler, repo } = newHandler();
    const original = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    repo.put('pushups/01.gif', new Uint8Array(original));
    const response = await handler.handleGet(
      new Request('https://host/media/pushups/01.gif', { method: 'GET' })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/gif');
    expect(response.headers.get('content-length')).toBe(String(original.length));
    expect(response.headers.get('cache-control')).toBe(`public, max-age=${MAX_AGE}, immutable`);
    expect(response.headers.get('etag')).toBe(`"${original.length}"`);
    const received = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(received)).toEqual(original);
  });

  it('returns 404 when the object is missing', async () => {
    const { handler } = newHandler();
    const response = await handler.handleGet(
      new Request('https://host/media/pushups/missing.gif', { method: 'GET' })
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 400 when the key fails validation', async () => {
    const { handler } = newHandler();
    const response = await handler.handleGet(
      new Request('https://host/media/..%2Fetc%2Fpasswd', { method: 'GET' })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when the extension is not on the allow list', async () => {
    const { handler, repo } = newHandler();
    repo.put('pushups/01.html', new Uint8Array([0x3c]));
    const response = await handler.handleGet(
      new Request('https://host/media/pushups/01.html', { method: 'GET' })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('BAD_REQUEST');
  });
});

describe('MediaHandler.handleHead', () => {
  it('returns metadata without a body', async () => {
    const { handler, repo } = newHandler();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    repo.put('pushups/01.gif', bytes);
    const response = await handler.handleHead(
      new Request('https://host/media/pushups/01.gif', { method: 'HEAD' })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(response.headers.get('content-type')).toBe('image/gif');
    expect(response.body).toBeNull();
  });

  it('returns 404 for a missing object with no body', async () => {
    const { handler } = newHandler();
    const response = await handler.handleHead(
      new Request('https://host/media/pushups/missing.gif', { method: 'HEAD' })
    );
    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
  });
});
