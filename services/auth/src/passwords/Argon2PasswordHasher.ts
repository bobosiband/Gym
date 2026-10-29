import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

import type { PasswordHasher } from './PasswordHasher.js';

/**
 * `PasswordHasher` backed by `@node-rs/argon2`.
 *
 * Parameters follow the OWASP 2024 argon2id baseline:
 * - memoryCost = 19 MiB (OWASP minimum for argon2id with t=2)
 * - timeCost = 2
 * - parallelism = 1
 *
 * These values are high enough to resist offline cracking on commodity
 * hardware while still finishing in a few hundred milliseconds on the
 * smallest Lambda size, which keeps the service inside the free tier.
 * The library produces a self-describing encoded hash so the
 * parameters can be bumped later without a migration. We pass the
 * numeric Argon2 algorithm id (`2` = argon2id) instead of importing
 * the shipped const enum, which does not survive `isolatedModules`.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  private static readonly ALGORITHM_ARGON2ID = 2;
  private static readonly MEMORY_COST_KIB = 19456;
  private static readonly TIME_COST = 2;
  private static readonly PARALLELISM = 1;

  public async hash(password: string): Promise<string> {
    return argonHash(password, {
      algorithm: Argon2PasswordHasher.ALGORITHM_ARGON2ID,
      memoryCost: Argon2PasswordHasher.MEMORY_COST_KIB,
      timeCost: Argon2PasswordHasher.TIME_COST,
      parallelism: Argon2PasswordHasher.PARALLELISM,
    });
  }

  public async verify(encodedHash: string, password: string): Promise<boolean> {
    try {
      return await argonVerify(encodedHash, password);
    } catch {
      return false;
    }
  }
}
