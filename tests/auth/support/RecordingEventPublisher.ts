import type { EventPublisher } from '../../../services/auth/src/events/EventPublisher.js';

/**
 * In-memory `EventPublisher`. Records every published event so tests
 * can assert on detail-type and detail payload without touching
 * EventBridge.
 */
export class RecordingEventPublisher implements EventPublisher {
  public readonly events: { detailType: string; detail: unknown }[] = [];

  public async publish(detailType: string, detail: unknown): Promise<void> {
    this.events.push({ detailType, detail });
  }
}
