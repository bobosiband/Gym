/// <reference types="@cloudflare/vitest-pool-workers" />

/**
 * Vite's `?raw` import hint, used by integration tests to inline migration
 * and fixture SQL as strings. @cloudflare/vitest-pool-workers runs on top
 * of Vitest/Vite and understands this suffix at runtime.
 */
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
