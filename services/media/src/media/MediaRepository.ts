/**
 * Opaque identifier for the fetch range the worker asked R2 for.
 */
export interface MediaRangeRequest {
  readonly offset: number;
  readonly length?: number;
}

/**
 * Metadata and body stream for a single stored object.
 *
 * `body` is a `ReadableStream<Uint8Array>` so the worker can forward
 * bytes to the client without buffering the whole file in memory.
 * `size` is the full object size (not the range size); the worker
 * computes `content-length` for ranged responses itself.
 */
export interface MediaObject {
  readonly body: ReadableStream<Uint8Array>;
  readonly size: number;
  readonly etag: string;
  readonly uploadedAt: Date;
}

/**
 * Repository contract for an object store backing the media Worker.
 *
 * The production implementation (`R2MediaRepository`) delegates to
 * Cloudflare R2. Tests use an in-memory fake so the Worker can be
 * exercised without a Cloudflare account. Keeping the Worker behind
 * this interface also lets a later migration to a different storage
 * backend happen without touching the handlers.
 */
export interface MediaRepository {
  /**
   * Resolve the given key to a stored object. Returns `null` when
   * the object is missing.
   */
  get(key: string, range?: MediaRangeRequest): Promise<MediaObject | null>;

  /**
   * `true` if the given key exists. Used by `HEAD /media/<key>` so
   * the Worker can answer without streaming the body.
   */
  head(key: string): Promise<Pick<MediaObject, 'size' | 'etag' | 'uploadedAt'> | null>;
}
