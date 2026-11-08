import {
  ACHIEVEMENT_UNLOCKED_V1_DETAIL_TYPE,
  type AchievementUnlockedV1,
} from '@gym/contracts/events/achievementUnlocked.v1';
import type { ProgressLevelUpV1Event, WorkoutLoggedV1Event } from '@gym/contracts';

import type { BadgeRegistry } from '../badges/BadgeRegistry.js';
import type { EventPublisher } from '../events/EventPublisher.js';
import type { AchievementRepository, ProcessedEventRepository } from './AchievementRepository.js';
import { Clock } from './Clock.js';
import { IdGenerator } from './IdGenerator.js';
import { LocalDate } from './LocalDate.js';
import type { AchievementRecord, UserSnapshot } from './UserSnapshot.js';

const ACTIVE_DAYS_WINDOW = 60;

/**
 * Dependencies the service needs. Each is an interface so tests
 * swap in an in-memory fake.
 */
export interface AchievementServiceDeps {
  readonly repo: AchievementRepository;
  readonly processed: ProcessedEventRepository;
  readonly badges: BadgeRegistry;
  readonly events: EventPublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Core service for the achievements bounded context.
 *
 * Reads two event types from the internal webhook:
 *
 *  - `workout.logged.v1`: bumps totalWorkouts and totalReps, adds the
 *    event's local date to the active-days window.
 *  - `progress.level_up.v1`: raises highestLevel.
 *
 * After each event the service walks the badge registry, inserts
 * any newly satisfied badge (idempotent on `(userId, badgeId)`), and
 * emits `achievement.unlocked.v1` for each actual unlock.
 */
export class AchievementService {
  public constructor(private readonly deps: AchievementServiceDeps) {}

  /** Return the user's unlocked badges, newest first. */
  public async listAchievements(userId: string): Promise<readonly AchievementRecord[]> {
    return this.deps.repo.listAchievements(userId);
  }

  /** Consume a `workout.logged.v1`. Idempotent on `eventId`. */
  public async handleWorkoutLogged(
    event: WorkoutLoggedV1Event.WorkoutLoggedV1
  ): Promise<readonly AchievementRecord[]> {
    const claimed = await this.deps.processed.tryClaim(event.eventId);
    if (!claimed) {
      return [];
    }
    const snapshot = await this.ensureSnapshot(event.userId);
    const localDate = LocalDate.fromIsoUtc(event.loggedAt, 'UTC');
    const nextSnapshot: UserSnapshot = {
      ...snapshot,
      totalWorkouts: snapshot.totalWorkouts + 1,
      totalReps: snapshot.totalReps + event.reps,
      activeDays: LocalDate.boundedWindow(snapshot.activeDays, localDate, ACTIVE_DAYS_WINDOW),
      updatedAt: this.deps.clock.nowIso(),
    };
    await this.deps.repo.putSnapshot(nextSnapshot);
    return this.evaluateBadges(nextSnapshot);
  }

  /** Consume a `progress.level_up.v1`. Idempotent on `eventId`. */
  public async handleProgressLevelUp(
    event: ProgressLevelUpV1Event.ProgressLevelUpV1
  ): Promise<readonly AchievementRecord[]> {
    const claimed = await this.deps.processed.tryClaim(event.eventId);
    if (!claimed) {
      return [];
    }
    const snapshot = await this.ensureSnapshot(event.userId);
    const nextSnapshot: UserSnapshot = {
      ...snapshot,
      highestLevel: Math.max(snapshot.highestLevel, event.newLevel),
      updatedAt: this.deps.clock.nowIso(),
    };
    await this.deps.repo.putSnapshot(nextSnapshot);
    return this.evaluateBadges(nextSnapshot);
  }

  private async ensureSnapshot(userId: string): Promise<UserSnapshot> {
    const existing = await this.deps.repo.getSnapshot(userId);
    if (existing !== null) {
      return existing;
    }
    const fresh: UserSnapshot = {
      userId,
      totalWorkouts: 0,
      totalReps: 0,
      highestLevel: 1,
      activeDays: [],
      updatedAt: this.deps.clock.nowIso(),
    };
    await this.deps.repo.putSnapshot(fresh);
    return fresh;
  }

  private async evaluateBadges(snapshot: UserSnapshot): Promise<readonly AchievementRecord[]> {
    const unlocked: AchievementRecord[] = [];
    for (const rule of this.deps.badges.list()) {
      if (!rule.shouldUnlock(snapshot)) {
        continue;
      }
      const record: AchievementRecord = {
        userId: snapshot.userId,
        badgeId: rule.metadata.badgeId,
        name: rule.metadata.name,
        description: rule.metadata.description,
        unlockedAt: this.deps.clock.nowIso(),
      };
      const inserted = await this.deps.repo.insertAchievementIfAbsent(record);
      if (inserted) {
        unlocked.push(record);
        await this.emitUnlocked(record);
      }
    }
    return unlocked;
  }

  private async emitUnlocked(record: AchievementRecord): Promise<void> {
    const payload: AchievementUnlockedV1 = {
      eventId: this.deps.ids.newId(),
      userId: record.userId,
      badgeId: record.badgeId,
      name: record.name,
      description: record.description,
      unlockedAt: record.unlockedAt,
    };
    await this.deps.events.publish(ACHIEVEMENT_UNLOCKED_V1_DETAIL_TYPE, payload);
  }
}
