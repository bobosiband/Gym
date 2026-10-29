import type { User } from '../../../services/auth/src/users/User.js';
import type { UserRepository } from '../../../services/auth/src/users/UserRepository.js';

/**
 * In-memory `UserRepository`. Behaves the same way the Dynamo
 * implementation would at normal traffic: `createUser` rejects an
 * existing id and `getUserByEmail` returns the single row with a
 * matching email. The lockout timestamp is stored but no clock
 * advancement happens inside the repo; callers supply the ISO string.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, string>();

  public async createUser(user: User): Promise<void> {
    if (this.byId.has(user.id)) throw new Error('conflict: id');
    if (this.byEmail.has(user.email)) throw new Error('conflict: email');
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user.id);
  }

  public async getUserById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const id = this.byEmail.get(email);
    if (id === undefined) return null;
    return this.byId.get(id) ?? null;
  }

  public async markEmailVerified(userId: string): Promise<void> {
    const current = this.byId.get(userId);
    if (current === undefined) return;
    this.byId.set(userId, { ...current, emailVerified: true });
  }

  public async updatePasswordHash(userId: string, newPasswordHash: string): Promise<void> {
    const current = this.byId.get(userId);
    if (current === undefined) return;
    const next: User = {
      id: current.id,
      email: current.email,
      createdAt: current.createdAt,
      emailVerified: current.emailVerified,
      passwordHash: newPasswordHash,
      failedLoginCount: 0,
    };
    this.byId.set(userId, next);
  }

  public async recordFailedLogin(userId: string, lockUntilIso?: string): Promise<void> {
    const current = this.byId.get(userId);
    if (current === undefined) return;
    const next: User = {
      ...current,
      failedLoginCount: current.failedLoginCount + 1,
      ...(lockUntilIso === undefined ? {} : { lockedUntil: lockUntilIso }),
    };
    this.byId.set(userId, next);
  }

  public async resetFailedLogins(userId: string): Promise<void> {
    const current = this.byId.get(userId);
    if (current === undefined) return;
    const next: User = {
      id: current.id,
      email: current.email,
      createdAt: current.createdAt,
      emailVerified: current.emailVerified,
      passwordHash: current.passwordHash,
      failedLoginCount: 0,
    };
    this.byId.set(userId, next);
  }
}
