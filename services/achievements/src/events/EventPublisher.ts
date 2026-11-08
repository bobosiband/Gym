/**
 * Port for publishing outbound events. Kept as an interface so the
 * service never knows whether it is going to EventBridge, a log
 * line, or an in-memory test sink. The production adapter is
 * intentionally a no-op today (events out = none at Stage 3; see
 * docs/architecture.md); real emission ships when a subscriber
 * appears.
 */
export interface EventPublisher {
  publish(detailType: string, detail: Record<string, unknown>): Promise<void>;
}

/**
 * Default no-op publisher. Logs the emission so a deploy smoke test
 * can confirm the service is reaching the emit path without
 * incurring any outbound cost.
 */
export class LoggingEventPublisher implements EventPublisher {
  public async publish(detailType: string, detail: Record<string, unknown>): Promise<void> {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'achievements.events',
        message: 'would emit',
        detailType,
        detail,
      })
    );
  }
}
