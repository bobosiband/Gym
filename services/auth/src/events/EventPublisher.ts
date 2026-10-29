/**
 * Event-bus boundary. Keeps the business logic from importing the
 * AWS SDK directly so tests can assert on published events with a
 * simple in-memory recorder.
 */
export interface EventPublisher {
  publish(detailType: string, detail: unknown): Promise<void>;
}
