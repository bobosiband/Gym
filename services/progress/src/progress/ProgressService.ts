import type { ExerciseRegistry, WorkoutEventLike } from '@gym/exercise-core';
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
const DEFAULT_TARGET_EXERCISE_ID = 'pushup';
const PROCESSED_EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface ProgressServiceDeps {
  readonly progress: ProgressRepository;
  readonly processed: ProcessedEventRepository;
  readonly events: EventPublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly exercises: ExerciseRegistry;
}

/**
 * Core service for the progress bounded context.
 *
 * The service owns the invariants that keep XP, levels, streaks and
 * daily targets consistent as `workout.logged.v1` events arrive out
 * of order and sometimes twice. Per-exercise scoring is delegated to
 * strategies in the injected {@link ExerciseRegistry}; this class
 * never branches on the event's `kind` field.
 *
 * Flow for every event:
 *
 *  1. Claim the eventId through
 *     {@link ProcessedEventRepository.tryClaim}. If the claim fails,
 *     the event is a replay and the service returns without touching
 *     state.
 *  2. Load the user's state. If no row exists, seed one at XP=0,
 *     level=1, streak=0, freezeBalance=0, time zone=UTC.
 *  3. Load the daily summary for the event's local date (resolved
 *     against the user's time zone). If none, start a fresh summary.
 *  4. Fold the event into the summary via the exercise's
 *     {@link SummaryContribution}: the exercise decides how many
 *     reps feed the target and whether the event marks the day
 *     active on its own.
 *  5. Decide if the day is "counted": it is active or the target
 *     was hit.
 *  6. Advance the streak via {@link StreakRules.onActiveDay} and
 *     emit `streak.frozen.v1` or `streak.broken.v1` accordingly.
 *  7. Credit XP via the exercise's {@link XpRule}, add the
 *     daily-target bonus if the target was hit on this event, and
 *     emit `progress.level_up.v1` on each level crossed.
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
   * Set (or replace) the user's daily reps target. Starts on today's
   * local date in the user's current zone. Replacing an active
   * target zeroes `completedDays` and `remainingReps` is recomputed
   * from the new daily reps and duration.
   *
   * The target is pinned to the push-up exercise today; when a
   * second reps-based exercise ships, the request schema gains an
   * optional `exerciseId` and this method honours it.
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
        exerciseId: DEFAULT_TARGET_EXERCISE_ID,
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
    const exercise = this.deps.exercises.get(event.kind);
    const stored = await this.ensureState(event.userId);
    const localDate = LocalDate.fromIsoUtc(event.loggedAt, stored.timeZone);
    const existingSummary =
      (await this.deps.progress.getDailySummary(event.userId, localDate)) ??
      this.freshSummary(event.userId, localDate);
    const target = stored.dailyTarget;
    const contributesToTarget = target !== null && target.exerciseId === event.kind;
    const effort = ProgressService.toWorkoutEvent(event);
    const repsForTarget = contributesToTarget
      ? exercise.summaryContribution.repsTowardTarget(effort)
      : 0;
    const marksActive = exercise.summaryContribution.marksDayActive(effort);
    const nextTargetReps = existingSummary.targetReps + repsForTarget;
    const nextActivityCount = existingSummary.activityCount + (marksActive ? 1 : 0);
    const wasTargetHit = existingSummary.targetHit;
    const nowTargetHit =
      wasTargetHit ||
      (target !== null && contributesToTarget && nextTargetReps >= target.repsPerDay);
    const nextSummary: DailySummaryRecord = {
      userId: existingSummary.userId,
      localDate: existingSummary.localDate,
      targetReps: nextTargetReps,
      activityCount: nextActivityCount,
      targetHit: nowTargetHit,
    };
    const wasCounted = existingSummary.targetHit || existingSummary.activityCount > 0;
    const nowCounted = nowTargetHit || nextActivityCount > 0;

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

    const dailyTargetHitThisEvent = nowTargetHit && !wasTargetHit;
    const bonusXp = dailyTargetHitThisEvent ? XpRules.DAILY_TARGET_BONUS_XP : 0;
    const baseXp = exercise.xpRule.baseXp(effort);
    const earnedXp = baseXp + bonusXp;
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
      dailyTarget: this.applyDailyTarget(
        nextState.dailyTarget,
        event,
        contributesToTarget,
        dailyTargetHitThisEvent
      ),
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
      targetReps: 0,
      activityCount: 0,
      targetHit: false,
    };
  }

  private applyDailyTarget(
    target: ProgressStateRecord['dailyTarget'],
    event: WorkoutLoggedV1Event.WorkoutLoggedV1,
    contributesToTarget: boolean,
    completedToday: boolean
  ): ProgressStateRecord['dailyTarget'] {
    if (target === null) {
      return null;
    }
    const completedDays = completedToday ? target.completedDays + 1 : target.completedDays;
    if (!contributesToTarget) {
      return completedToday ? { ...target, completedDays } : target;
    }
    const remainingReps = Math.max(0, target.remainingReps - event.reps);
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

  private static toWorkoutEvent(event: WorkoutLoggedV1Event.WorkoutLoggedV1): WorkoutEventLike {
    return {
      reps: event.reps,
      ...(event.weightKg === undefined ? {} : { weightKg: event.weightKg }),
      ...(event.durationSeconds === undefined ? {} : { durationSeconds: event.durationSeconds }),
    };
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
