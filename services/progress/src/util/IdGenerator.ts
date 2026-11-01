import { randomUUID } from 'node:crypto';

/**
 * Boundary for id generation. Injected so tests can produce
 * deterministic ids. The service never calls `randomUUID` directly.
 */
export interface IdGenerator {
  newId(): string;
}

export class CryptoIdGenerator implements IdGenerator {
  public newId(): string {
    return randomUUID();
  }
}
