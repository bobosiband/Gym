import { describe, expect, it } from 'vitest';

import { HandlerSchemas } from '../../services/auth/src/handlers/HandlerSchemas.js';

describe('HandlerSchemas.register', () => {
  const schema = HandlerSchemas.register();

  it('accepts a valid payload', () => {
    expect(schema.safeParse({ email: 'a@b.co', password: 'a'.repeat(12) }).success).toBe(true);
  });

  it('rejects a short password', () => {
    expect(schema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(
      schema.safeParse({ email: 'a@b.co', password: 'a'.repeat(12), sneaky: true }).success
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(schema.safeParse({ email: 'not-an-email', password: 'a'.repeat(12) }).success).toBe(
      false
    );
  });
});

describe('HandlerSchemas.login', () => {
  const schema = HandlerSchemas.login();

  it('accepts any non-empty password (login does not enforce length)', () => {
    expect(schema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('caps password length to 128', () => {
    expect(schema.safeParse({ email: 'a@b.co', password: 'a'.repeat(129) }).success).toBe(false);
  });
});

describe('HandlerSchemas.refresh / logout', () => {
  it('requires a refreshToken string', () => {
    expect(HandlerSchemas.refresh().safeParse({ refreshToken: '' }).success).toBe(false);
    expect(HandlerSchemas.refresh().safeParse({ refreshToken: 'x'.repeat(44) }).success).toBe(true);
  });

  it('rejects a refreshToken over 200 chars', () => {
    expect(HandlerSchemas.refresh().safeParse({ refreshToken: 'x'.repeat(201) }).success).toBe(
      false
    );
  });
});
