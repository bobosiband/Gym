import { ApiErrors } from '../ApiErrors.js';
import { ContentType } from './ContentType.js';
import { MediaKey } from './MediaKey.js';
import type { MediaRepository } from './MediaRepository.js';

/**
 * Handler for `GET` and `HEAD` on `/media/<key>`.
 *
 * Depends on {@link MediaRepository} via constructor injection so the
 * handler is testable with an in-memory fake. The handler is the one
 * place in the Worker that knows about the `/media/` URL prefix,
 * which keeps the router thin.
 */
export class MediaHandler {
  public constructor(
    private readonly repo: MediaRepository,
    private readonly maxAgeSeconds: number
  ) {}

  /**
   * Handle a `GET /media/<key>` request. Streams the object bytes
   * back to the client with the matching content-type and cache
   * headers. Returns 400 for an invalid key, 404 for a missing
   * object, 406 when the extension is not on the allow list.
   */
  public async handleGet(request: Request): Promise<Response> {
    const parsed = this.parseKey(request);
    if ('error' in parsed) {
      return parsed.error;
    }
    const key = parsed.key;
    const contentType = ContentType.forKey(key);
    if (contentType === null) {
      return ApiErrors.badRequest('unsupported media type');
    }
    const object = await this.repo.get(key);
    if (object === null) {
      return ApiErrors.notFound(`media not found: ${key}`);
    }
    const headers = new Headers({
      'content-type': contentType,
      'content-length': String(object.size),
      'cache-control': `public, max-age=${this.maxAgeSeconds}, immutable`,
      etag: object.etag,
      'last-modified': object.uploadedAt.toUTCString(),
    });
    return new Response(object.body, { status: 200, headers });
  }

  /**
   * Handle a `HEAD /media/<key>` request. Mirrors `GET` but returns
   * no body, so an HTTP client can discover an object's size or
   * cache metadata without downloading it.
   */
  public async handleHead(request: Request): Promise<Response> {
    const parsed = this.parseKey(request);
    if ('error' in parsed) {
      return new Response(null, { status: parsed.error.status });
    }
    const key = parsed.key;
    const contentType = ContentType.forKey(key);
    if (contentType === null) {
      return new Response(null, { status: 400 });
    }
    const meta = await this.repo.head(key);
    if (meta === null) {
      return new Response(null, { status: 404 });
    }
    const headers = new Headers({
      'content-type': contentType,
      'content-length': String(meta.size),
      'cache-control': `public, max-age=${this.maxAgeSeconds}, immutable`,
      etag: meta.etag,
      'last-modified': meta.uploadedAt.toUTCString(),
    });
    return new Response(null, { status: 200, headers });
  }

  private parseKey(request: Request): { key: string } | { error: Response } {
    const url = new URL(request.url);
    const key = MediaKey.extract(url.pathname);
    if (key === null) {
      return { error: ApiErrors.badRequest('invalid media key') };
    }
    return { key };
  }
}
