import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

import type { SessionArtefactKind, SessionRecord } from './Session.js';
import type { SessionRepository } from './SessionRepository.js';

/**
 * DynamoDB-backed implementation of `SessionRepository`.
 *
 * Table layout:
 * - Partition key `tokenHashId` (string).
 * - Attribute `expiresAt` (number): Dynamo TTL field, seconds since the
 *   Unix epoch. Both token rows and email-counter rows age out through
 *   this TTL so no background job is required.
 * - GSI `by-family`: partition key `familyId` for refresh-family
 *   revocation.
 * - GSI `by-user`: partition key `userId` for revoke-all-on-reset.
 * - GSI `by-email-kind`: partition key `emailKind` (`"<kind>#<email>"`),
 *   sort key `createdAtSeconds`. Only email-counter rows populate this
 *   GSI, which keeps the index small.
 */
export class DynamoSessionRepository implements SessionRepository {
  private static readonly FAMILY_INDEX = 'by-family';
  private static readonly USER_INDEX = 'by-user';
  private static readonly EMAIL_KIND_INDEX = 'by-email-kind';
  private static readonly EMAIL_WINDOW_SECONDS = 3600;

  public constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async create(record: SessionRecord): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
        ConditionExpression: 'attribute_not_exists(tokenHashId)',
      })
    );
  }

  public async getByHashId(tokenHashId: string): Promise<SessionRecord | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { tokenHashId } })
    );
    return (result.Item as SessionRecord | undefined) ?? null;
  }

  public async markUsed(tokenHashId: string, usedAtIso: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { tokenHashId },
        UpdateExpression: 'SET usedAt = :u',
        ExpressionAttributeValues: { ':u': usedAtIso },
      })
    );
  }

  public async markRevoked(tokenHashId: string, revokedAtIso: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { tokenHashId },
        UpdateExpression: 'SET revokedAt = :r',
        ExpressionAttributeValues: { ':r': revokedAtIso },
      })
    );
  }

  public async revokeFamily(familyId: string, revokedAtIso: string): Promise<void> {
    const query = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DynamoSessionRepository.FAMILY_INDEX,
        KeyConditionExpression: 'familyId = :f',
        ExpressionAttributeValues: { ':f': familyId },
      })
    );
    const items = (query.Items ?? []) as unknown as readonly SessionRecord[];
    await Promise.all(items.map((item) => this.markRevoked(item.tokenHashId, revokedAtIso)));
  }

  public async revokeAllForUser(userId: string, revokedAtIso: string): Promise<void> {
    const query = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DynamoSessionRepository.USER_INDEX,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
      })
    );
    const items = (query.Items ?? []) as unknown as readonly SessionRecord[];
    await Promise.all(items.map((item) => this.markRevoked(item.tokenHashId, revokedAtIso)));
  }

  public async countRecentForEmail(
    email: string,
    kind: SessionArtefactKind,
    sinceSeconds: number
  ): Promise<number> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: DynamoSessionRepository.EMAIL_KIND_INDEX,
        KeyConditionExpression: 'emailKind = :ek AND createdAtSeconds >= :s',
        ExpressionAttributeValues: {
          ':ek': this.emailKind(email, kind),
          ':s': sinceSeconds,
        },
        Select: 'COUNT',
      })
    );
    return result.Count ?? 0;
  }

  public async recordEmailSend(
    email: string,
    kind: SessionArtefactKind,
    nowSeconds: number
  ): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          tokenHashId: `email-counter#${kind}#${email}#${nowSeconds}#${randomUUID()}`,
          emailKind: this.emailKind(email, kind),
          createdAtSeconds: nowSeconds,
          expiresAt: nowSeconds + DynamoSessionRepository.EMAIL_WINDOW_SECONDS,
        },
      })
    );
  }

  private emailKind(email: string, kind: SessionArtefactKind): string {
    return `${kind}#${email}`;
  }
}
