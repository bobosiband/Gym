import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';

import type { EventPublisher } from './EventPublisher.js';

/**
 * `EventPublisher` backed by AWS EventBridge.
 *
 * `source` is a fixed value (`gym.logging`) that lets consumers
 * filter on origin without parsing the detail-type string. The
 * client is reused across invocations of the same Lambda instance
 * to amortise the TLS handshake. The target bus is the shared
 * `gym-events` bus that `services/auth` creates; this service
 * imports it by name in CDK rather than creating its own.
 */
export class EventBridgeEventPublisher implements EventPublisher {
  private static readonly SOURCE = 'gym.logging';

  public constructor(
    private readonly client: EventBridgeClient,
    private readonly eventBusName: string
  ) {}

  public async publish(detailType: string, detail: unknown): Promise<void> {
    const entry: PutEventsRequestEntry = {
      EventBusName: this.eventBusName,
      Source: EventBridgeEventPublisher.SOURCE,
      DetailType: detailType,
      Detail: JSON.stringify(detail),
    };
    const result = await this.client.send(new PutEventsCommand({ Entries: [entry] }));
    if (result.FailedEntryCount !== undefined && result.FailedEntryCount > 0) {
      const first = result.Entries?.[0];
      const code = first?.ErrorCode ?? 'unknown';
      throw new Error(`eventbridge put failed: ${code}`);
    }
  }
}
