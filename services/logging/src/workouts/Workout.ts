import type { LoggingApi } from '@gym/contracts';

/**
 * Internal representation of a workout record.
 *
 * This is intentionally the same shape as the public API
 * `LoggingApi.Workout`: the service does not store derived fields
 * at the moment, so there is no need for a separate persistence
 * type. If future stages add internal-only columns (for example a
 * schema version) they can be added here without changing the
 * public contract.
 */
export type Workout = LoggingApi.Workout;
