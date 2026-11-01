import type { IdempotencyRecord } from './IdempotencyRecord.js';

/**
 * Outcome of `IdempotencyRepository.beginOrGet`.
 *
 * `created`: the row did not exist and was inserted with
 * `status: 'in_progress'`. The caller owns the lifecycle and must
 * eventually call `markCompleted`.
 *
 * `existing`: the row already exists. The caller must branch on
 * `record.status`: `completed` means the response is cached and
 * can be returned verbatim; `in_progress` means a prior attempt
 * is still in flight and the caller must retry the event publish
 * before marking the row completed.
 */
export type BeginOutcome =
  | { readonly kind: 'created'; readonly record: IdempotencyRecord }
  | { readonly kind: 'existing'; readonly record: IdempotencyRecord };

/**
 * Persistence boundary for idempotency rows. The service holds an
 * `IdempotencyRepository`; the AWS implementation lives in
 * `DynamoIdempotencyRepository` and the in-memory fake in
 * `tests/logging/support/InMemoryIdempotencyRepository.ts`.
 */
export interface IdempotencyRepository {
  /**
   * Insert the row if it does not exist, otherwise return the
   * existing row. Uses a `PutItem` with
   * `attribute_not_exists(pk)` so two concurrent requests racing
   * on the same key resolve to exactly one `created` result.
   */
  beginOrGet(record: IdempotencyRecord): Promise<BeginOutcome>;

  /**
   * Flip the row's status to `completed`. The caller must pass
   * the full record so the TTL is preserved; implementations
   * must not touch any other row.
   */
  markCompleted(record: IdempotencyRecord): Promise<void>;
}
