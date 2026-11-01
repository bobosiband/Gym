import type { EventPublisher } from '../../../services/logging/src/events/EventPublisher.js';

/**
 * `EventPublisher` double that records every call and can be
 * programmed to fail. Tests use it to assert the published
 * envelope and to simulate transient EventBridge errors.
 */
export class RecordingEventPublisher implements EventPublisher {
  public readonly events: { detailType: string; detail: unknown }[] = [];
  private shouldFailOnce = false;
  private shouldFailAlways = false;

  public async publish(detailType: string, detail: unknown): Promise<void> {
    if (this.shouldFailAlways || this.shouldFailOnce) {
      this.shouldFailOnce = false;
      throw new Error('simulated eventbridge failure');
    }
    this.events.push({ detailType, detail });
  }

  public failOnce(): void {
    this.shouldFailOnce = true;
  }

  public failAlways(): void {
    this.shouldFailAlways = true;
  }

  public recover(): void {
    this.shouldFailAlways = false;
    this.shouldFailOnce = false;
  }
}
