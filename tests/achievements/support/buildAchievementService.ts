import { AchievementService } from '../../../services/achievements/src/achievements/AchievementService.js';
import type {
  AchievementRepository,
  ProcessedEventRepository,
} from '../../../services/achievements/src/achievements/AchievementRepository.js';
import type { Clock } from '../../../services/achievements/src/achievements/Clock.js';
import type { IdGenerator } from '../../../services/achievements/src/achievements/IdGenerator.js';
import type {
  AchievementRecord,
  UserSnapshot,
} from '../../../services/achievements/src/achievements/UserSnapshot.js';
import type { BadgeRegistry } from '../../../services/achievements/src/badges/BadgeRegistry.js';
import { DefaultBadgeRegistryFactory } from '../../../services/achievements/src/badges/DefaultBadgeRegistryFactory.js';
import type { EventPublisher } from '../../../services/achievements/src/events/EventPublisher.js';

export class StubClock implements Clock {
  public constructor(public current: string) {}

  public nowIso(): string {
    return this.current;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private cursor = 0;

  public newId(): string {
    this.cursor += 1;
    return `id-${this.cursor.toString().padStart(2, '0')}`;
  }
}

export class InMemoryAchievementRepository implements AchievementRepository {
  public readonly snapshots: Map<string, UserSnapshot> = new Map();
  public readonly achievements: Map<string, AchievementRecord[]> = new Map();

  public async getSnapshot(userId: string): Promise<UserSnapshot | null> {
    return this.snapshots.get(userId) ?? null;
  }

  public async putSnapshot(snapshot: UserSnapshot): Promise<void> {
    this.snapshots.set(snapshot.userId, snapshot);
  }

  public async insertAchievementIfAbsent(record: AchievementRecord): Promise<boolean> {
    const list = this.achievements.get(record.userId) ?? [];
    if (list.some((existing) => existing.badgeId === record.badgeId)) {
      return false;
    }
    list.unshift(record);
    this.achievements.set(record.userId, list);
    return true;
  }

  public async listAchievements(userId: string): Promise<readonly AchievementRecord[]> {
    return this.achievements.get(userId) ?? [];
  }
}

export class InMemoryProcessedEventRepository implements ProcessedEventRepository {
  public readonly claimed: Set<string> = new Set();

  public async tryClaim(eventId: string): Promise<boolean> {
    if (this.claimed.has(eventId)) {
      return false;
    }
    this.claimed.add(eventId);
    return true;
  }
}

export class RecordingEventPublisher implements EventPublisher {
  public readonly events: Array<{ detailType: string; detail: Record<string, unknown> }> = [];

  public async publish(detailType: string, detail: Record<string, unknown>): Promise<void> {
    this.events.push({ detailType, detail });
  }
}

export interface Built {
  readonly service: AchievementService;
  readonly repo: InMemoryAchievementRepository;
  readonly processed: InMemoryProcessedEventRepository;
  readonly events: RecordingEventPublisher;
  readonly badges: BadgeRegistry;
  readonly clock: StubClock;
  readonly ids: SequentialIdGenerator;
}

export function buildAchievementService(opts: { now?: string } = {}): Built {
  const repo = new InMemoryAchievementRepository();
  const processed = new InMemoryProcessedEventRepository();
  const events = new RecordingEventPublisher();
  const badges = DefaultBadgeRegistryFactory.create();
  const clock = new StubClock(opts.now ?? '2026-11-09T00:00:00');
  const ids = new SequentialIdGenerator();
  const service = new AchievementService({ repo, processed, badges, events, clock, ids });
  return { service, repo, processed, events, badges, clock, ids };
}
