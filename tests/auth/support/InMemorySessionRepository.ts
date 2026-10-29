import type {
  SessionArtefactKind,
  SessionRecord,
} from '../../../services/auth/src/sessions/Session.js';
import type { SessionRepository } from '../../../services/auth/src/sessions/SessionRepository.js';

interface EmailCounterRow {
  readonly email: string;
  readonly kind: SessionArtefactKind;
  readonly createdAtSeconds: number;
}

/**
 * In-memory `SessionRepository`. Supports the whole surface area the
 * service relies on: single-row look-up, revocation by family,
 * revocation per user, and email-counter book-keeping with an
 * explicit time window. Nothing uses a real Dynamo client here.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, SessionRecord>();
  private readonly emailCounters: EmailCounterRow[] = [];

  public async create(record: SessionRecord): Promise<void> {
    if (this.rows.has(record.tokenHashId)) throw new Error('conflict: tokenHashId');
    this.rows.set(record.tokenHashId, record);
  }

  public async getByHashId(tokenHashId: string): Promise<SessionRecord | null> {
    return this.rows.get(tokenHashId) ?? null;
  }

  public async markUsed(tokenHashId: string, usedAtIso: string): Promise<void> {
    const record = this.rows.get(tokenHashId);
    if (record === undefined) return;
    this.rows.set(tokenHashId, { ...record, usedAt: usedAtIso });
  }

  public async markRevoked(tokenHashId: string, revokedAtIso: string): Promise<void> {
    const record = this.rows.get(tokenHashId);
    if (record === undefined) return;
    this.rows.set(tokenHashId, { ...record, revokedAt: revokedAtIso });
  }

  public async revokeFamily(familyId: string, revokedAtIso: string): Promise<void> {
    for (const [key, row] of this.rows.entries()) {
      if (row.familyId === familyId) {
        this.rows.set(key, { ...row, revokedAt: revokedAtIso });
      }
    }
  }

  public async revokeAllForUser(userId: string, revokedAtIso: string): Promise<void> {
    for (const [key, row] of this.rows.entries()) {
      if (row.userId === userId && row.kind === 'refresh') {
        this.rows.set(key, { ...row, revokedAt: revokedAtIso });
      }
    }
  }

  public async countRecentForEmail(
    email: string,
    kind: SessionArtefactKind,
    sinceSeconds: number
  ): Promise<number> {
    return this.emailCounters.filter(
      (row) => row.email === email && row.kind === kind && row.createdAtSeconds >= sinceSeconds
    ).length;
  }

  public async recordEmailSend(
    email: string,
    kind: SessionArtefactKind,
    nowSeconds: number
  ): Promise<void> {
    this.emailCounters.push({ email, kind, createdAtSeconds: nowSeconds });
  }

  public allRefreshRows(): readonly SessionRecord[] {
    return [...this.rows.values()].filter((row) => row.kind === 'refresh');
  }
}
