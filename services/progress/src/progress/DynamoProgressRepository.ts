import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import type { ProgressRepository } from './ProgressRepository.js';
import type { DailySummaryRecord, ProgressStateRecord } from './ProgressStateRecord.js';

/**
 * DynamoDB-backed implementation of {@link ProgressRepository}.
 *
 * Both state and daily summaries live in the same table under
 * composite keys so a point lookup for a user is a single partition
 * read. The `STATE` sort key holds the user's rolled-up progress;
 * `DAY#<localDate>` rows hold the per-day roll-up.
 */
export class DynamoProgressRepository implements ProgressRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async getState(userId: string): Promise<ProgressStateRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `USER#${userId}`, sk: 'STATE' },
      })
    );
    const item = result.Item;
    if (item === undefined) {
      return null;
    }
    return DynamoProgressRepository.readState(item);
  }

  public async putState(record: ProgressStateRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${record.userId}`,
          sk: 'STATE',
          userId: record.userId,
          timeZone: record.timeZone,
          xp: record.xp,
          level: record.level,
          streakDays: record.streakDays,
          freezeBalance: record.freezeBalance,
          lastActiveLocalDate: record.lastActiveLocalDate,
          dailyTarget: record.dailyTarget,
        },
      })
    );
  }

  public async getDailySummary(
    userId: string,
    localDate: string
  ): Promise<DailySummaryRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `USER#${userId}`, sk: `DAY#${localDate}` },
      })
    );
    const item = result.Item;
    if (item === undefined) {
      return null;
    }
    return DynamoProgressRepository.readSummary(item);
  }

  public async putDailySummary(record: DailySummaryRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${record.userId}`,
          sk: `DAY#${record.localDate}`,
          userId: record.userId,
          localDate: record.localDate,
          targetReps: record.targetReps,
          activityCount: record.activityCount,
          targetHit: record.targetHit,
        },
      })
    );
  }

  private static readState(item: Record<string, unknown>): ProgressStateRecord {
    return {
      userId: String(item['userId']),
      timeZone: String(item['timeZone']),
      xp: Number(item['xp']),
      level: Number(item['level']),
      streakDays: Number(item['streakDays']),
      freezeBalance: Number(item['freezeBalance']),
      lastActiveLocalDate:
        item['lastActiveLocalDate'] === null || item['lastActiveLocalDate'] === undefined
          ? null
          : String(item['lastActiveLocalDate']),
      dailyTarget:
        item['dailyTarget'] === null || item['dailyTarget'] === undefined
          ? null
          : (item['dailyTarget'] as ProgressStateRecord['dailyTarget']),
    };
  }

  private static readSummary(item: Record<string, unknown>): DailySummaryRecord {
    return {
      userId: String(item['userId']),
      localDate: String(item['localDate']),
      targetReps: Number(item['targetReps']),
      activityCount: Number(item['activityCount']),
      targetHit: Boolean(item['targetHit']),
    };
  }
}
