import type { IdempotencyRecord } from '../../../services/logging/src/idempotency/IdempotencyRecord.js';
import type {
  BeginOutcome,
  IdempotencyRepository,
} from '../../../services/logging/src/idempotency/IdempotencyRepository.js';

/**
 * In-memory `IdempotencyRepository` keyed by
 * `(userId, idempotencyKey)`. Matches the Dynamo implementation's
 * conditional-create semantics.
 */
export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly byKey = new Map<string, IdempotencyRecord>();

  public async beginOrGet(record: IdempotencyRecord): Promise<BeginOutcome> {
    const key = InMemoryIdempotencyRepository.key(record.userId, record.idempotencyKey);
    const existing = this.byKey.get(key);
    if (existing !== undefined) {
      return { kind: 'existing', record: existing };
    }
    this.byKey.set(key, record);
    return { kind: 'created', record };
  }

  public async markCompleted(record: IdempotencyRecord): Promise<void> {
    const key = InMemoryIdempotencyRepository.key(record.userId, record.idempotencyKey);
    this.byKey.set(key, { ...record, status: 'completed' });
  }

  public get(userId: string, idempotencyKey: string): IdempotencyRecord | undefined {
    return this.byKey.get(InMemoryIdempotencyRepository.key(userId, idempotencyKey));
  }

  public size(): number {
    return this.byKey.size;
  }

  private static key(userId: string, idempotencyKey: string): string {
    return `${userId}#${idempotencyKey}`;
  }
}
