import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @gym/infra-auth.
 *
 * The CDK stack itself is not exercised here; the suite covers pure
 * helper classes under `lib/` (for example {@link AppPublicUrl}) that
 * are extracted precisely so they can be tested without an AWS or CDK
 * harness. Tests live under the repo-root `tests/infra-auth/` folder
 * to match the rest of the repo's layout.
 */
export default defineConfig({
  test: {
    include: ['../../tests/infra-auth/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
