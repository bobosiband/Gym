import type { EventPublisher } from '../../../services/progress/src/events/EventPublisher.js';

/**
 * Captures every published event so tests can assert on both the
 * detail type and the full payload.
 */
export class RecordingEventPublisher implements EventPublisher {
  public readonly events: { detailType: string; detail: Record<string, unknown> }[] = [];

  public async publish(detailType: string, detail: Record<string, unknown>): Promise<void> {
    this.events.push({ detailType, detail });
  }
}
