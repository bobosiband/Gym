import type { MediaObject, MediaRangeRequest, MediaRepository } from './MediaRepository.js';

/**
 * Cloudflare R2 implementation of {@link MediaRepository}.
 *
 * The repository is a thin shim over the R2 binding: Cloudflare's SDK
 * already handles network reconnections, range requests, and streaming
 * reads. The main value of this class is isolating the `R2Bucket`
 * type from the rest of the Worker so test code does not need to
 * import `@cloudflare/workers-types`.
 */
export class R2MediaRepository implements MediaRepository {
  public constructor(private readonly bucket: R2Bucket) {}

  public async get(key: string, range?: MediaRangeRequest): Promise<MediaObject | null> {
    const options = range === undefined ? undefined : { range: this.toR2Range(range) };
    const object = await this.bucket.get(key, options);
    if (object === null) {
      return null;
    }
    return {
      body: object.body,
      size: object.size,
      etag: object.httpEtag,
      uploadedAt: object.uploaded,
    };
  }

  public async head(
    key: string
  ): Promise<Pick<MediaObject, 'size' | 'etag' | 'uploadedAt'> | null> {
    const object = await this.bucket.head(key);
    if (object === null) {
      return null;
    }
    return {
      size: object.size,
      etag: object.httpEtag,
      uploadedAt: object.uploaded,
    };
  }

  private toR2Range(range: MediaRangeRequest): R2Range {
    if (range.length === undefined) {
      return { offset: range.offset };
    }
    return { offset: range.offset, length: range.length };
  }
}
