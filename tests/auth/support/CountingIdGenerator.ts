import type { IdGenerator } from '../../../services/auth/src/util/IdGenerator.js';

/**
 * `IdGenerator` that returns `prefix-1`, `prefix-2`, ... so tests can
 * assert on the exact ids produced by the service.
 */
export class CountingIdGenerator implements IdGenerator {
  private counter = 0;

  public constructor(private readonly prefix: string = 'id') {}

  public nextId(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
