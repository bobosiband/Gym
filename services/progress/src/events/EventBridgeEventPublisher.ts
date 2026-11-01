import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

import type { EventPublisher } from './EventPublisher.js';

/**
 * EventBridge-backed {@link EventPublisher}. Mirrors the shape used
 * by `services/logging` so events emitted here are indistinguishable
 * (bus name, source) from those emitted by the auth or logging
 * services.
 */
export class EventBridgeEventPublisher implements EventPublisher {
  public constructor(
    private readonly client: EventBridgeClient,
    private readonly busName: string,
    private readonly source: string = 'gym.progress'
  ) {}

  public async publish(detailType: string, detail: Record<string, unknown>): Promise<void> {
    const response = await this.client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.busName,
            Source: this.source,
            DetailType: detailType,
            Detail: JSON.stringify(detail),
          },
        ],
      })
    );
    const failed = response.FailedEntryCount ?? 0;
    if (failed > 0) {
      throw new Error(`EventBridgeEventPublisher: ${failed} failed entries`);
    }
  }
}
