import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import type { IdempotencyRecord } from './IdempotencyRecord.js';
import type { BeginOutcome, IdempotencyRepository } from './IdempotencyRepository.js';

/**
 * DynamoDB-backed implementation of `IdempotencyRepository`.
 *
 * Table layout: partition key `pk =
 * IDEMPOTENCY#<userId>#<idempotencyKey>`. No sort key. The TTL
 * attribute is `expiresAt`; DynamoDB sweeps the row within 48
 * hours of that Unix seconds value, which is well below the free
 * tier TTL quota.
 */
export class DynamoIdempotencyRepository implements IdempotencyRepository {
  public constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async beginOrGet(record: IdempotencyRecord): Promise<BeginOutcome> {
    const item = {
      pk: DynamoIdempotencyRepository.key(record.userId, record.idempotencyKey),
      ...record,
    };
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(pk)',
        })
      );
      return { kind: 'created', record };
    } catch (err) {
      if (!DynamoIdempotencyRepository.isConditionalFailure(err)) throw err;
      const existing = await this.getRow(record.userId, record.idempotencyKey);
      if (existing === null) {
        throw new Error('idempotency row vanished between put and get');
      }
      return { kind: 'existing', record: existing };
    }
  }

  public async markCompleted(record: IdempotencyRecord): Promise<void> {
    const item = {
      pk: DynamoIdempotencyRepository.key(record.userId, record.idempotencyKey),
      ...record,
      status: 'completed',
    };
    await this.docClient.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  private async getRow(userId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: DynamoIdempotencyRepository.key(userId, idempotencyKey) },
      })
    );
    const item = result.Item;
    if (item === undefined) return null;
    const typed = item as unknown as IdempotencyRecord & { pk?: string };
    const { pk: _pk, ...rest } = typed;
    void _pk;
    return rest;
  }

  private static key(userId: string, idempotencyKey: string): string {
    return `IDEMPOTENCY#${userId}#${idempotencyKey}`;
  }

  private static isConditionalFailure(err: unknown): boolean {
    if (err === null || typeof err !== 'object') return false;
    const name = (err as { name?: unknown }).name;
    return name === 'ConditionalCheckFailedException';
  }
}
