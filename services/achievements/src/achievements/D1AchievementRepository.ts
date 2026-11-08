import type { AchievementRepository, ProcessedEventRepository } from './AchievementRepository.js';
import type { AchievementRecord, UserSnapshot } from './UserSnapshot.js';

/**
 * Cloudflare D1 driver for {@link AchievementRepository}. Keeps the
 * domain code SQL-free; every query lives here.
 */
export class D1AchievementRepository implements AchievementRepository {
  public constructor(private readonly db: D1Database) {}

  public async getSnapshot(userId: string): Promise<UserSnapshot | null> {
    const result = await this.db
      .prepare(
        'SELECT userId, totalWorkouts, totalReps, highestLevel, activeDaysJson, updatedAt FROM user_snapshots WHERE userId = ?'
      )
      .bind(userId)
      .first<{
        userId: string;
        totalWorkouts: number;
        totalReps: number;
        highestLevel: number;
        activeDaysJson: string;
        updatedAt: string;
      }>();
    if (result === null) {
      return null;
    }
    return {
      userId: result.userId,
      totalWorkouts: Number(result.totalWorkouts),
      totalReps: Number(result.totalReps),
      highestLevel: Number(result.highestLevel),
      activeDays: D1AchievementRepository.parseActiveDays(result.activeDaysJson),
      updatedAt: result.updatedAt,
    };
  }

  public async putSnapshot(snapshot: UserSnapshot): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO user_snapshots (userId, totalWorkouts, totalReps, highestLevel, activeDaysJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET totalWorkouts = excluded.totalWorkouts, totalReps = excluded.totalReps, highestLevel = excluded.highestLevel, activeDaysJson = excluded.activeDaysJson, updatedAt = excluded.updatedAt'
      )
      .bind(
        snapshot.userId,
        snapshot.totalWorkouts,
        snapshot.totalReps,
        snapshot.highestLevel,
        JSON.stringify(snapshot.activeDays),
        snapshot.updatedAt
      )
      .run();
  }

  public async insertAchievementIfAbsent(record: AchievementRecord): Promise<boolean> {
    const result = await this.db
      .prepare(
        'INSERT OR IGNORE INTO user_achievements (userId, badgeId, name, description, unlockedAt) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(record.userId, record.badgeId, record.name, record.description, record.unlockedAt)
      .run();
    const changes = result.meta.changes ?? 0;
    return changes > 0;
  }

  public async listAchievements(userId: string): Promise<readonly AchievementRecord[]> {
    const result = await this.db
      .prepare(
        'SELECT userId, badgeId, name, description, unlockedAt FROM user_achievements WHERE userId = ? ORDER BY unlockedAt DESC'
      )
      .bind(userId)
      .all<AchievementRecord>();
    return result.results;
  }

  private static parseActiveDays(raw: string): readonly string[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((value): value is string => typeof value === 'string');
    } catch {
      return [];
    }
  }
}

/**
 * D1 driver for the processed-event id set.
 */
export class D1ProcessedEventRepository implements ProcessedEventRepository {
  public constructor(private readonly db: D1Database) {}

  public async tryClaim(eventId: string): Promise<boolean> {
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');
    const result = await this.db
      .prepare('INSERT OR IGNORE INTO processed_events (eventId, processedAt) VALUES (?, ?)')
      .bind(eventId, now)
      .run();
    const changes = result.meta.changes ?? 0;
    return changes > 0;
  }
}
