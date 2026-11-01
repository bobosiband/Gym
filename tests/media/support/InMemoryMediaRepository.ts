import type {
  MediaObject,
  MediaRangeRequest,
  MediaRepository,
} from '../../../services/media/src/media/MediaRepository.js';

/**
 * In-memory implementation of {@link MediaRepository} used by the
 * handler unit tests. Writes land in a `Map` so the test can seed
 * objects by calling {@link put} and then exercise `get`/`head`.
 */
export class InMemoryMediaRepository implements MediaRepository {
  private readonly objects: Map<string, { bytes: Uint8Array; etag: string; uploadedAt: Date }> =
    new Map();

  public put(key: string, bytes: Uint8Array, etag: string = `"${bytes.length}"`): void {
    this.objects.set(key, { bytes, etag, uploadedAt: new Date('2026-01-01T00:00:00Z') });
  }

  public async get(key: string, _range?: MediaRangeRequest): Promise<MediaObject | null> {
    const entry = this.objects.get(key);
    if (entry === undefined) {
      return null;
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(entry.bytes);
        controller.close();
      },
    });
    return {
      body: stream,
      size: entry.bytes.length,
      etag: entry.etag,
      uploadedAt: entry.uploadedAt,
    };
  }

  public async head(
    key: string
  ): Promise<Pick<MediaObject, 'size' | 'etag' | 'uploadedAt'> | null> {
    const entry = this.objects.get(key);
    if (entry === undefined) {
      return null;
    }
    return { size: entry.bytes.length, etag: entry.etag, uploadedAt: entry.uploadedAt };
  }
}
