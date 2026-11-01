/**
 * Error codes surfaced by `ProgressService`. The HTTP handlers map
 * each code to a response code; the event-consumer path ignores the
 * HTTP mapping and simply logs the error and returns.
 */
export type ProgressServiceErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_TIME_ZONE'
  | 'DAILY_TARGET_ACTIVE'
  | 'NOT_FOUND'
  | 'EVENT_PUBLISH_FAILED';

export class ProgressServiceError extends Error {
  public readonly code: ProgressServiceErrorCode;

  public constructor(code: ProgressServiceErrorCode, message: string) {
    super(message);
    this.name = 'ProgressServiceError';
    this.code = code;
  }
}
