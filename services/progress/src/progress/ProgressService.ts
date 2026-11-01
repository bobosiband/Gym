import type { ProgressApi, WorkoutLoggedV1Event } from '@gym/contracts';
import {
  PROGRESS_LEVEL_UP_V1_DETAIL_TYPE,
  type ProgressLevelUpV1,
} from '@gym/contracts/events/progressLevelUp.v1';
import {
  STREAK_BROKEN_V1_DETAIL_TYPE,
  type StreakBrokenV1,
} from '@gym/contracts/events/streakBroken.v1';
import {
  STREAK_FROZEN_V1_DETAIL_TYPE,
  type StreakFrozenV1,
} from '@gym/contracts/events/streakFrozen.v1';

import type { EventPublisher } from '../events/EventPublisher.js';
import type { Clock } from '../util/Clock.js';
import type { IdGenerator } from '../util/IdGenerator.js';
import { LocalDate } from '../util/LocalDate.js';
import { FreezeRules } from './FreezeRules.js';
import type { ProcessedEventRepository, ProgressRepository } from './ProgressRepository.js';
import { ProgressServiceError } from './ProgressServiceErrors.js';
import type { DailySummaryRecord, ProgressStateRecord } from './ProgressStateRecord.js';
import { StreakRules } from './StreakRules.js';
import { XpRules } from './XpRules.js';

const DEFAULT_TIME_ZONE = 'UTC';
const PROCESSED_EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface ProgressServiceDeps {
  readonly progress: ProgressRepository;
  readonly processed: ProcessedEventRepository;
  readonly events: EventPublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Core service for the progress bounded context.
 *
 * The service owns the invariants that keep XP, levels, streaks and
 * daily targets consistent as `workout.logged.v1` events arrive out
 * of order and sometimes twice. The flow for every event:
 *
 *  1. Claim the eventId through
 *     {@link ProcessedEventRepository.tryClaim}. If the claim fails,
 *     the event is a replay and the service returns without touching
 *     state.
 *  2. Load the user's state. If no row exists, seed one at XP=0,
 *     level=1, streak=0, freezeBalance=0, time zone=UTC.
 *  3. Load the daily summary for the event's local date (resolved
 *     against the user's time zone). If none, start a fresh summary.
 *  4. Fold the event into the summary: push-up events add reps,
 *     set events increment `setCount`.
 *  5. Decide if the day is "counted": push-up reps now hit the
 *     daily target or at least one set is logged.
 *  6. Advance the streak via {@link StreakRules.onActiveDay} and
 *     emit `streak.frozen.v1` or `streak.broken.v1` accordingly.
 *  7. Credit XP via {@link XpRules.baseXpForEvent}, add the daily-
 *     target bonus if the target was hit on this event, and emit
 *     `progress.level_up.v1` on each level crossed.
 *  8. Persist the summary and the state row.
 */
export class ProgressService {
  public constructor(private readonly deps: ProgressServiceDeps) {}

  /**
   * Return the user's state as a {@link ProgressApi.ProgressState},
   * seeding a fresh row for a new user. The returned
   * `effectiveStreakDays` reflects the live local date; the stored
   * streak may be higher and will catch up on the next event.
   */
  public async getProgress(userId: string): Promise<ProgressApi.ProgressState> {
    const stored = await this.ensureState(userId);
    return this.toApi(stored);
  }

  /**
   * Update the user's time zone. The next event this user logs will
   * be resolved against the new zone.
   */
  public async setTimeZone(userId: string, timeZone: string): Promise<ProgressApi.ProgressState> {
    if (!LocalDate.isValidZone(timeZone)) {
      throw new ProgressServiceError('INVALID_TIME_ZONE', `invalid IANA time zone: ${timeZone}`);
    }
    const stored = await this.ensureState(userId);
    const updated: ProgressStateRecord = { ...stored, timeZone };
    await this.deps.progress.putState(updated);
    return this.toApi(updated);
  }

  /**
   * Set (or replace) the user's daily push-up target. Starts on
   * today's local date in the user's current zone. Replacing an
   * active target zeroes `completedDays` and `remainingReps` is
   * recomputed from the new daily reps and duration.
   */
  public async setDailyTarget(
    userId: string,
    request: ProgressApi.SetDailyTargetRequest
  ): Promise<ProgressApi.ProgressState> {
    const stored = await this.ensureState(userId);
    const startLocalDate = LocalDate.fromIsoUtc(this.deps.clock.nowIso(), stored.timeZone);
    const totalReps = request.repsPerDay * request.durationDays;
    const updated: ProgressStateRecord = {
      ...stored,
      dailyTarget: {
        repsPerDay: request.repsPerDay,
        durationDays: request.durationDays,
        startLocalDate,
        totalReps,
        remainingReps: totalReps,
        completedDays: 0,
      },
    };
    await this.deps.progress.putState(updated);
    return this.toApi(updated);
  }

  /**
   * Internal grant method. The quest service (built in a later
   * stage) is the only legitimate caller; the HTTP surface does not
   * expose this method today. The balance is capped per
   * {@link FreezeRules.MAX_FREEZES}.
   */
  public async grantFreezes(userId: string, amount: number): Promise<ProgressApi.ProgressState> {
    const stored = await this.ensureState(userId);
    const updated: ProgressStateRecord = {
      ...stored,
      freezeBalance: FreezeRules.grant(stored.freezeBalance, amount),
    };
    await this.deps.progress.putState(updated);
    return this.toApi(updated);
  }

  /**
   * Consume a `workout.logged.v1` event. Idempotent via
   * {@link ProcessedEventRepository.tryClaim}: a second call with
   * the same eventId is a no-op.
   */
  public async handleWorkoutLogged(event: WorkoutLoggedV1Event.WorkoutLoggedV1): Promise<void> {
    const claimed = await this.deps.processed.tryClaim(event.eventId, PROCESSED_EVENT_TTL_SECONDS);
    if (!claimed) {
      return;
    }
    const stored = await this.ensureState(event.userId);
    const localDate = LocalDate.fromIsoUtc(event.loggedAt, stored.timeZone);
    const existingSummary =
      (await this.deps.progress.getDailySummary(event.userId, localDate)) ??
      this.freshSummary(event.userId, localDate);
    const nextSummary = this.foldEventIntoSummary(existingSummary, event, stored);
    const wasCounted = this.isCounted(existingSummary, stored.dailyTarget?.repsPerDay);
    const nowCounted = this.isCounted(nextSummary, stored.dailyTarget?.repsPerDay);

    let nextState: ProgressStateRecord = stored;

    if (nowCounted && !wasCounted) {
      const outcome = StreakRules.onActiveDay({
        todayLocalDate: localDate,
        lastActiveLocalDate: stored.lastActiveLocalDate,
        streakDays: stored.streakDays,
        freezeBalance: stored.freezeBalance,
      });
      nextState = {
        ...nextState,
        streakDays: outcome.streakDays,
        freezeBalance: outcome.freezeBalance,
        lastActiveLocalDate: localDate,
      };
      await this.emitStreakEvents(event.userId, outcome);
    }

    const dailyTargetHitThisEvent =
      stored.dailyTarget !== null && nowCounted && !wasCounted && nextSummary.targetHit;
    const bonusXp = dailyTargetHitThisEvent ? XpRules.DAILY_TARGET_BONUS_XP : 0;
    const earnedXp = XpRules.baseXpForEvent(event) + bonusXp;
    if (earnedXp > 0) {
      const previousLevel = XpRules.levelForXp(nextState.xp);
      const newXp = nextState.xp + earnedXp;
      const newLevel = XpRules.levelForXp(newXp);
      nextState = { ...nextState, xp: newXp, level: newLevel };
      if (newLevel > previousLevel) {
        await this.emitLevelUp(event.userId, previousLevel, newLevel, newXp);
      }
    }

    nextState = {
      ...nextState,
      dailyTarget: this.applyDailyTarget(nextState.dailyTarget, event, dailyTargetHitThisEvent),
    };

    await this.deps.progress.putDailySummary(nextSummary);
    await this.deps.progress.putState(nextState);
  }

  private async ensureState(userId: string): Promise<ProgressStateRecord> {
    const existing = await this.deps.progress.getState(userId);
    if (existing !== null) {
      return existing;
    }
    const fresh: ProgressStateRecord = {
      userId,
      timeZone: DEFAULT_TIME_ZONE,
      xp: 0,
      level: 1,
      streakDays: 0,
      freezeBalance: 0,
      lastActiveLocalDate: null,
      dailyTarget: null,
    };
    await this.deps.progress.putState(fresh);
    return fresh;
  }

  private freshSummary(userId: string, localDate: string): DailySummaryRecord {
    return {
      userId,
      localDate,
      pushupReps: 0,
      setCount: 0,
      targetHit: false,
    };
  }

  private foldEventIntoSummary(
    summary: DailySummaryRecord,
    event: WorkoutLoggedV1Event.WorkoutLoggedV1,
    state: ProgressStateRecord
  ): DailySummaryRecord {
    const pushupReps =
      event.kind === 'pushup' ? summary.pushupReps + event.reps : summary.pushupReps;
    const setCount = event.kind === 'set' ? summary.setCount + 1 : summary.setCount;
    const target = state.dailyTarget?.repsPerDay;
    const targetHit =
      summary.targetHit ||
      (target !== undefined && pushupReps >= target) ||
      (target === undefined && setCount > 0);
    return {
      userId: summary.userId,
      localDate: summary.localDate,
      pushupReps,
      setCount,
      targetHit,
    };
  }

  private isCounted(summary: DailySummaryRecord, repsTarget: number | undefined): boolean {
    if (summary.setCount > 0) {
      return true;
    }
    if (repsTarget === undefined) {
      return false;
    }
    return summary.pushupReps >= repsTarget;
  }

  private applyDailyTarget(
    target: ProgressStateRecord['dailyTarget'],
    event: WorkoutLoggedV1Event.WorkoutLoggedV1,
    completedToday: boolean
  ): ProgressStateRecord['dailyTarget'] {
    if (target === null) {
      return null;
    }
    if (event.kind !== 'pushup') {
      return completedToday ? { ...target, completedDays: target.completedDays + 1 } : target;
    }
    const remainingReps = Math.max(0, target.remainingReps - event.reps);
    const completedDays = completedToday ? target.completedDays + 1 : target.completedDays;
    return { ...target, remainingReps, completedDays };
  }

  private async emitStreakEvents(
    userId: string,
    outcome: ReturnType<typeof StreakRules.onActiveDay>
  ): Promise<void> {
    const occurredAt = this.deps.clock.nowIso();
    if (outcome.kind === 'frozen') {
      const payload: StreakFrozenV1 = {
        eventId: this.deps.ids.newId(),
        userId,
        streakDaysAfter: outcome.streakDays,
        missedDays: outcome.missedDays,
        remainingFreezes: outcome.freezeBalance,
        occurredAt,
      };
      await this.deps.events.publish(STREAK_FROZEN_V1_DETAIL_TYPE, payload);
      return;
    }
    if (outcome.kind === 'broken') {
      const payload: StreakBrokenV1 = {
        eventId: this.deps.ids.newId(),
        userId,
        previousStreakDays: outcome.previousStreakDays,
        missedDays: outcome.missedDays,
        occurredAt,
      };
      await this.deps.events.publish(STREAK_BROKEN_V1_DETAIL_TYPE, payload);
    }
  }

  private async emitLevelUp(
    userId: string,
    previousLevel: number,
    newLevel: number,
    xpTotal: number
  ): Promise<void> {
    const payload: ProgressLevelUpV1 = {
      eventId: this.deps.ids.newId(),
      userId,
      previousLevel,
      newLevel,
      xpTotal,
      occurredAt: this.deps.clock.nowIso(),
    };
    await this.deps.events.publish(PROGRESS_LEVEL_UP_V1_DETAIL_TYPE, payload);
  }

  private toApi(record: ProgressStateRecord): ProgressApi.ProgressState {
    const todayLocalDate = LocalDate.fromIsoUtc(this.deps.clock.nowIso(), record.timeZone);
    const effectiveStreakDays = StreakRules.effectiveStreak({
      todayLocalDate,
      lastActiveLocalDate: record.lastActiveLocalDate,
      streakDays: record.streakDays,
      freezeBalance: record.freezeBalance,
    });
    const xpToNextLevel = XpRules.xpToNextLevel(record.xp);
    return {
      userId: record.userId,
      timeZone: record.timeZone,
      xp: record.xp,
      level: record.level,
      xpToNextLevel,
      streakDays: record.streakDays,
      effectiveStreakDays,
      freezeBalance: record.freezeBalance,
      lastActiveLocalDate: record.lastActiveLocalDate,
      dailyTarget: record.dailyTarget,
    };
  }
}
