import type { Workout } from '../../../services/logging/src/workouts/Workout.js';
import type {
  ListWorkoutsOptions,
  WorkoutPage,
  WorkoutRepository,
} from '../../../services/logging/src/workouts/WorkoutRepository.js';

/**
 * In-memory `WorkoutRepository`. Behaves like the Dynamo
 * implementation at normal traffic: `put` rejects on duplicate
 * `(userId, loggedAt, workoutId)`, `getById` is a linear scan on
 * workoutId, and `list` filters, sorts newest first, and
 * paginates with a numeric offset cursor.
 */
export class InMemoryWorkoutRepository implements WorkoutRepository {
  private readonly rows: Workout[] = [];

  public async put(workout: Workout): Promise<void> {
    const duplicate = this.rows.some(
      (row) =>
        row.userId === workout.userId &&
        row.loggedAt === workout.loggedAt &&
        row.workoutId === workout.workoutId
    );
    if (duplicate) {
      throw new Error('conflict: duplicate workout');
    }
    this.rows.push({ ...workout });
  }

  public async getById(workoutId: string): Promise<Workout | null> {
    const found = this.rows.find((row) => row.workoutId === workoutId);
    return found === undefined ? null : { ...found };
  }

  public async list(userId: string, options: ListWorkoutsOptions): Promise<WorkoutPage> {
    const filtered = this.rows
      .filter((row) => row.userId === userId)
      .filter((row) => options.from === undefined || row.loggedAt >= options.from)
      .filter((row) => options.to === undefined || row.loggedAt <= options.to)
      .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : a.loggedAt > b.loggedAt ? -1 : 0));
    const start = InMemoryWorkoutRepository.decodeCursor(options.cursor);
    const page = filtered.slice(start, start + options.limit);
    const nextStart = start + page.length;
    const cursor =
      nextStart < filtered.length ? InMemoryWorkoutRepository.encodeCursor(nextStart) : undefined;
    return cursor === undefined ? { workouts: page } : { workouts: page, cursor };
  }

  public all(): readonly Workout[] {
    return this.rows;
  }

  private static encodeCursor(offset: number): string {
    return Buffer.from(String(offset), 'utf8').toString('base64url');
  }

  private static decodeCursor(cursor: string | undefined): number {
    if (cursor === undefined) return 0;
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('invalid cursor');
    return parsed;
  }
}
