import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';

import type { EventPublisher } from './EventPublisher.js';

/**
 * `EventPublisher` backed by AWS EventBridge.
 *
 * `source` is a fixed value (`gym.auth`) that lets consumers filter on
 * origin without parsing the detail-type string. The client is reused
 * across invocations of the same Lambda instance to amortise the TLS
 * handshake.
 */
export class EventBridgeEventPublisher implements EventPublisher {
  private static readonly SOURCE = 'gym.auth';

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
    await this.client.send(new PutEventsCommand({ Entries: [entry] }));
  }
}
