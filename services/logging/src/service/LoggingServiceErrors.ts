/**
 * Stable error codes thrown by `LoggingService`. Handlers map
 * these to HTTP statuses in `HandlerBase.mapLoggingError`. Keeping
 * them as a union of string literals (not an enum) means the
 * compiler flags unhandled codes in the mapper.
 */
export type LoggingServiceErrorCode =
  'NOT_FOUND' | 'FORBIDDEN' | 'IDEMPOTENCY_IN_PROGRESS' | 'EVENT_PUBLISH_FAILED';

/**
 * Error thrown by the service layer when a request cannot be
 * completed for a known business reason. Carries a machine
 * readable code and a human message; the mapper decides the HTTP
 * status.
 */
export class LoggingServiceError extends Error {
  public constructor(
    public readonly code: LoggingServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'LoggingServiceError';
  }
}
