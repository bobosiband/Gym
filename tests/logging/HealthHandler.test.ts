import { describe, expect, it } from 'vitest';

import { HealthHandler } from '../../services/logging/src/handlers/HealthHandler.js';

describe('HealthHandler', () => {
  it('returns 200 with an HTML page', () => {
    const response = HealthHandler.handle();
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('Gym logging');
  });

  it('is dependency-free: it does not touch the environment', () => {
    const originalEnv = process.env;
    process.env = {} as NodeJS.ProcessEnv;
    try {
      const response = HealthHandler.handle();
      expect(response.statusCode).toBe(200);
    } finally {
      process.env = originalEnv;
    }
  });

  it('escapes the embedded server time', () => {
    const response = HealthHandler.handle();
    expect(response.body).not.toContain('<script>alert');
  });
});
