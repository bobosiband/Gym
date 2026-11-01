import type { IdGenerator } from '../../../services/logging/src/util/IdGenerator.js';

/**
 * Deterministic id generator for tests. Emits predictable
 * UUID-v4-shaped strings so assertions can hard-code expected
 * values and the Zod `.uuid()` validator in the contracts still
 * accepts the output.
 */
export class CountingIdGenerator implements IdGenerator {
  private counter = 0;

  public newId(): string {
    this.counter += 1;
    const hex = this.counter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  }

  public peek(): number {
    return this.counter;
  }
}
