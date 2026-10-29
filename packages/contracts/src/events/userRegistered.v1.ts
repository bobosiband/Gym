/**
 * `user.registered.v1` event schema.
 *
 * Emitted by `services/auth` on every successful sign-up, after the user
 * record has been written to DynamoDB and the verification email has been
 * queued. Any change to this type is a breaking change and requires
 * owner approval. See `docs/events.md` for the versioning rule.
 *
 * The event is a fact, not a command. Consumers must tolerate duplicate
 * deliveries and use `eventId` as the idempotency key.
 */

/**
 * Canonical event name on the bus. Including the version suffix in the
 * detail type makes it easy for consumers to match a specific schema
 * version without string manipulation.
 */
export const USER_REGISTERED_V1_DETAIL_TYPE = 'user.registered.v1';

/**
 * Detail payload for `user.registered.v1`.
 *
 * `userId` is the auth service's canonical identifier for the user and
 * is the same subject that appears in access tokens. `registeredAt` is
 * an ISO 8601 UTC timestamp.
 */
export interface UserRegisteredV1 {
  readonly eventId: string;
  readonly userId: string;
  readonly registeredAt: string;
}
