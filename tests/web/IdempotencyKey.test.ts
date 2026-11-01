import { describe, expect, it } from 'vitest';

import { IdempotencyKey } from '../../apps/web/src/util/IdempotencyKey.js';

describe('IdempotencyKey', () => {
  it('delegates to the injected randomUUID source', () => {
    let calls = 0;
    const source: Pick<Crypto, 'randomUUID'> = {
      randomUUID: () => {
        calls += 1;
        return `00000000-0000-4000-8000-00000000000${calls}` as `${string}-${string}-${string}-${string}-${string}`;
      },
    };
    const generator = new IdempotencyKey(source);
    expect(generator.next()).toBe('00000000-0000-4000-8000-000000000001');
    expect(generator.next()).toBe('00000000-0000-4000-8000-000000000002');
  });
});
