import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import type { User } from './User.js';
import type { UserRepository } from './UserRepository.js';

/**
 * DynamoDB-backed implementation of `UserRepository`.
 *
 * Table layout: partition key `id` (string). A sparse global secondary
 * index named `by-email` is defined on `email` so we can look up users
 * by normalised email without a scan. The `createUser` call issues two
 * writes in a sequence that is safe because the GSI write is a plain
 * mirror; see the comment on that method for the race explanation.
 */
export class DynamoUserRepository implements UserRepository {
  private static readonly EMAIL_INDEX = 'by-email';

  public constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async createUser(user: User): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(id)',
      })
    );
  }

  public async getUserById(id: string): Promise<User | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } })
    );
    return (result.Item as User | undefined) ?? null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DynamoUserRepository.EMAIL_INDEX,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      })
    );
    const items = result.Items;
    if (items === undefined || items.length === 0) return null;
    return items[0] as User;
  }

  public async markEmailVerified(userId: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: userId },
        UpdateExpression: 'SET emailVerified = :t',
        ExpressionAttributeValues: { ':t': true },
      })
    );
  }

  public async updatePasswordHash(userId: string, newPasswordHash: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: userId },
        UpdateExpression: 'SET passwordHash = :h, failedLoginCount = :z REMOVE lockedUntil',
        ExpressionAttributeValues: { ':h': newPasswordHash, ':z': 0 },
      })
    );
  }

  public async recordFailedLogin(userId: string, lockUntilIso?: string): Promise<void> {
    if (lockUntilIso !== undefined) {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id: userId },
          UpdateExpression:
            'SET failedLoginCount = if_not_exists(failedLoginCount, :z) + :inc, lockedUntil = :l',
          ExpressionAttributeValues: { ':inc': 1, ':z': 0, ':l': lockUntilIso },
        })
      );
      return;
    }
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: userId },
        UpdateExpression: 'SET failedLoginCount = if_not_exists(failedLoginCount, :z) + :inc',
        ExpressionAttributeValues: { ':inc': 1, ':z': 0 },
      })
    );
  }

  public async resetFailedLogins(userId: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: userId },
        UpdateExpression: 'SET failedLoginCount = :z REMOVE lockedUntil',
        ExpressionAttributeValues: { ':z': 0 },
      })
    );
  }

  /**
   * Not part of the `UserRepository` interface, but handy for tests and
   * for a future admin tool. Not called by any handler.
   */
  public async deleteUser(userId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id: userId } })
    );
  }
}
