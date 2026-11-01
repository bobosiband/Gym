import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import type { Workout } from './Workout.js';
import type { ListWorkoutsOptions, WorkoutPage, WorkoutRepository } from './WorkoutRepository.js';

/**
 * DynamoDB-backed implementation of `WorkoutRepository`.
 *
 * Table layout: partition key `pk = USER#<userId>`, sort key
 * `sk = WORKOUT#<loggedAt>#<workoutId>` so per-user range queries
 * by date are cheap. A sparse global secondary index named
 * `by-workout` is defined on `workoutId` so point lookups by id
 * do not need to know the sort key. The index projects all
 * attributes so the single `GetById` query returns the full row.
 */
export class DynamoWorkoutRepository implements WorkoutRepository {
  private static readonly WORKOUT_INDEX = 'by-workout';

  public constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async put(workout: Workout): Promise<void> {
    const item = {
      pk: DynamoWorkoutRepository.userKey(workout.userId),
      sk: DynamoWorkoutRepository.workoutKey(workout.loggedAt, workout.workoutId),
      ...workout,
    };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
    );
  }

  public async getById(workoutId: string): Promise<Workout | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DynamoWorkoutRepository.WORKOUT_INDEX,
        KeyConditionExpression: 'workoutId = :w',
        ExpressionAttributeValues: { ':w': workoutId },
        Limit: 1,
      })
    );
    const items = result.Items;
    if (items === undefined || items.length === 0) return null;
    return DynamoWorkoutRepository.extractWorkout(items[0] as Record<string, unknown>);
  }

  public async list(userId: string, options: ListWorkoutsOptions): Promise<WorkoutPage> {
    const expressionValues: Record<string, string> = {
      ':pk': DynamoWorkoutRepository.userKey(userId),
      ':lo': options.from === undefined ? 'WORKOUT#' : `WORKOUT#${options.from}`,
      ':hi': options.to === undefined ? 'WORKOUT$' : `WORKOUT#${options.to}#~`,
    };
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :lo AND :hi',
        ExpressionAttributeValues: expressionValues,
        Limit: options.limit,
        ScanIndexForward: false,
        ExclusiveStartKey:
          options.cursor === undefined
            ? undefined
            : DynamoWorkoutRepository.decodeCursor(options.cursor),
      })
    );
    const workouts = (result.Items ?? []).map((item) =>
      DynamoWorkoutRepository.extractWorkout(item as Record<string, unknown>)
    );
    const cursor =
      result.LastEvaluatedKey === undefined
        ? undefined
        : DynamoWorkoutRepository.encodeCursor(result.LastEvaluatedKey);
    return cursor === undefined ? { workouts } : { workouts, cursor };
  }

  private static userKey(userId: string): string {
    return `USER#${userId}`;
  }

  private static workoutKey(loggedAt: string, workoutId: string): string {
    return `WORKOUT#${loggedAt}#${workoutId}`;
  }

  private static extractWorkout(item: Record<string, unknown>): Workout {
    return {
      workoutId: item['workoutId'] as string,
      userId: item['userId'] as string,
      loggedAt: item['loggedAt'] as string,
      exerciseId: item['exerciseId'] as string,
      kind: item['kind'] as Workout['kind'],
      reps: item['reps'] as number,
      ...(item['weightKg'] === undefined ? {} : { weightKg: item['weightKg'] as number }),
      ...(item['durationSeconds'] === undefined
        ? {}
        : { durationSeconds: item['durationSeconds'] as number }),
    };
  }

  private static encodeCursor(key: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
  }

  private static decodeCursor(cursor: string): Record<string, unknown> {
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as unknown;
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('cursor is not an object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new Error('invalid cursor');
    }
  }
}
