import type {
  ProcessedEventRepository,
  ProgressRepository,
} from '../../../services/progress/src/progress/ProgressRepository.js';
import type {
  DailySummaryRecord,
  ProgressStateRecord,
} from '../../../services/progress/src/progress/ProgressStateRecord.js';

/**
 * In-memory {@link ProgressRepository} for tests. Round-trips state
 * and daily-summary rows through plain `Map`s so test assertions can
 * inspect the stored shape directly.
 */
export class InMemoryProgressRepository implements ProgressRepository {
  public readonly state: Map<string, ProgressStateRecord> = new Map();
  public readonly summaries: Map<string, DailySummaryRecord> = new Map();

  public async getState(userId: string): Promise<ProgressStateRecord | null> {
    return this.state.get(userId) ?? null;
  }

  public async putState(record: ProgressStateRecord): Promise<void> {
    this.state.set(record.userId, record);
  }

  public async getDailySummary(
    userId: string,
    localDate: string
  ): Promise<DailySummaryRecord | null> {
    return this.summaries.get(`${userId}#${localDate}`) ?? null;
  }

  public async putDailySummary(record: DailySummaryRecord): Promise<void> {
    this.summaries.set(`${record.userId}#${record.localDate}`, record);
  }
}

/**
 * In-memory {@link ProcessedEventRepository}. Returns `false` on
 * repeat ids so the service can prove its idempotency path.
 */
export class InMemoryProcessedEventRepository implements ProcessedEventRepository {
  public readonly claimed: Set<string> = new Set();

  public async tryClaim(eventId: string, _ttlSeconds: number): Promise<boolean> {
    if (this.claimed.has(eventId)) {
      return false;
    }
    this.claimed.add(eventId);
    return true;
  }
}
