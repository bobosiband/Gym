import { randomUUID } from 'node:crypto';

/**
 * Generates stable, unique identifiers for user records, session
 * records, and event payloads. Kept behind an interface so tests can
 * swap in a counter-based generator for deterministic output.
 */
export interface IdGenerator {
  nextId(): string;
}

/**
 * `IdGenerator` backed by the Node `crypto.randomUUID` helper, which
 * produces RFC 4122 version 4 UUIDs sourced from a CSPRNG.
 */
export class UuidIdGenerator implements IdGenerator {
  public nextId(): string {
    return randomUUID();
  }
}
