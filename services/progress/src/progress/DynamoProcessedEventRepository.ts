import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

import type { Clock } from '../util/Clock.js';
import type { ProcessedEventRepository } from './ProgressRepository.js';

/**
 * DynamoDB-backed {@link ProcessedEventRepository}.
 *
 * Writes are gated on `attribute_not_exists(pk)` so a duplicate
 * event id surfaces as a `ConditionalCheckFailedException`, which
 * the repository converts to a `false` return value. The row carries
 * a Dynamo TTL (`expiresAt`) so old claims age out automatically.
 */
export class DynamoProcessedEventRepository implements ProcessedEventRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly clock: Clock
  ) {}

  public async tryClaim(eventId: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `EVENT#${eventId}`,
            eventId,
            expiresAt: this.clock.nowSeconds() + ttlSeconds,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        })
      );
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw err;
    }
  }
}
